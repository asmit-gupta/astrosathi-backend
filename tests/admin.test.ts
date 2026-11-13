import request from 'supertest';
import { encryptPii } from '../src/lib/crypto';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import { base32Decode, base32Encode, hotp, newTotpSecret, totpAt } from '../src/lib/totp';
import * as settings from '../src/modules/settings/settings.service';
import { app, freezeTime } from './helpers';

const EMAIL = 'founder@example.com';
const PASSWORD = 'correct horse battery';

// Each step's code is single-use, so tests move the clock 30 s before every new code.
async function createAdmin() {
  const secret = newTotpSecret();
  const now = new Date();
  await prisma.admin.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      totpSecretEnc: encryptPii(secret),
      createdAt: now,
      passwordAt: now,
    },
  });
  return secret;
}

async function setup() {
  const advance = freezeTime(new Date('2026-11-14T10:00:00Z'));
  const secret = await createAdmin();
  let at = new Date('2026-11-14T10:00:00Z').getTime();
  const nextCode = () => {
    advance(30);
    at += 30_000;
    return totpAt(secret, new Date(at));
  };
  const login = () =>
    request(app).post('/admin/v1/auth/login').send({ email: EMAIL, password: PASSWORD, code: nextCode() });
  return { secret, advance: (s: number) => ((at += s * 1000), advance(s)), nextCode, login };
}

describe('TOTP', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    const secret = Buffer.from('12345678901234567890');
    expect(hotp(secret, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(hotp(secret, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    expect(hotp(secret, Math.floor(1234567890 / 30), 8)).toBe('89005924');
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('hello astrolive');
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });
});

describe('admin login', () => {
  it('signs in with email, password and code', async () => {
    const t = await setup();
    const res = await t.login();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const session = await request(app).get('/admin/v1/auth/session').set('Authorization', `Bearer ${res.body.token}`);
    expect(session.body).toMatchObject({ admin: { email: EMAIL }, stepUpActive: true });
  });

  it('gives one generic error for any wrong part, and audits it', async () => {
    const t = await setup();
    const wrongPassword = await request(app)
      .post('/admin/v1/auth/login')
      .send({ email: EMAIL, password: 'nope-nope-nope', code: t.nextCode() });
    const wrongCode = await request(app).post('/admin/v1/auth/login').send({ email: EMAIL, password: PASSWORD, code: '000000' });
    const wrongEmail = await request(app)
      .post('/admin/v1/auth/login')
      .send({ email: 'x@example.com', password: PASSWORD, code: t.nextCode() });

    for (const res of [wrongPassword, wrongCode, wrongEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ADMIN_LOGIN_FAILED');
    }
    expect(await prisma.auditLog.count({ where: { action: 'admin.login_failed' } })).toBe(3);
  });

  it('refuses a replayed code', async () => {
    const t = await setup();
    const code = t.nextCode();
    const body = { email: EMAIL, password: PASSWORD, code };
    expect((await request(app).post('/admin/v1/auth/login').send(body)).status).toBe(200);
    expect((await request(app).post('/admin/v1/auth/login').send(body)).body.error.code).toBe('ADMIN_LOGIN_FAILED');
  });

  it('locks an IP after 5 failures for 15 minutes', async () => {
    const t = await setup();
    for (let i = 0; i < 5; i++) {
      await request(app).post('/admin/v1/auth/login').send({ email: EMAIL, password: 'wrong-wrong-wrong', code: '123456' });
    }
    const locked = await t.login();
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ADMIN_LOGIN_LOCKED');

    t.advance(15 * 60);
    expect((await t.login()).status).toBe(200);
  });

  it('a new login ends the previous session', async () => {
    const t = await setup();
    const first = (await t.login()).body.token;
    const second = (await t.login()).body.token;
    const old = await request(app).get('/admin/v1/auth/session').set('Authorization', `Bearer ${first}`);
    expect(old.body.error.code).toBe('ADMIN_SESSION_INVALID');
    expect((await request(app).get('/admin/v1/auth/session').set('Authorization', `Bearer ${second}`)).status).toBe(200);
  });

  it('expires after 30 idle minutes', async () => {
    const t = await setup();
    const token = (await t.login()).body.token;
    t.advance(30 * 60);
    const res = await request(app).get('/admin/v1/auth/session').set('Authorization', `Bearer ${token}`);
    expect(res.body.error.code).toBe('ADMIN_SESSION_EXPIRED');
  });

  it('user tokens do not work on admin routes', async () => {
    const res = await request(app).get('/admin/v1/settings').set('Authorization', 'Bearer some.user.jwt');
    expect(res.status).toBe(401);
  });
});

describe('step-up', () => {
  it('sensitive actions need a code from the last 5 minutes', async () => {
    const t = await setup();
    const token = (await t.login()).body.token;
    const auth = { Authorization: `Bearer ${token}` };
    const change = () =>
      request(app).put('/admin/v1/settings/platform_share_pct').set(auth).send({ value: 38, reason: 'Founding offer' });

    t.advance(5 * 60); // login counted as step-up; now stale
    const blocked = await change();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('STEP_UP_REQUIRED');

    const bad = await request(app).post('/admin/v1/auth/step-up').set(auth).send({ code: '000000' });
    expect(bad.body.error.code).toBe('ADMIN_CODE_INVALID');

    expect((await request(app).post('/admin/v1/auth/step-up').set(auth).send({ code: t.nextCode() })).status).toBe(200);
    expect((await change()).status).toBe(201);
  });

  it('changes the password with the current one', async () => {
    const t = await setup();
    const auth = { Authorization: `Bearer ${(await t.login()).body.token}` };
    const short = await request(app).post('/admin/v1/auth/password').set(auth).send({ currentPassword: PASSWORD, newPassword: 'short' });
    expect(short.body.error.code).toBe('PASSWORD_TOO_SHORT');
    const ok = await request(app)
      .post('/admin/v1/auth/password')
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: 'a much longer passphrase' });
    expect(ok.status).toBe(204);
    expect(await prisma.auditLog.count({ where: { action: 'admin.password_changed' } })).toBe(1);
  });
});

describe('settings', () => {
  async function signedIn() {
    const t = await setup();
    const auth = { Authorization: `Bearer ${(await t.login()).body.token}` };
    return { ...t, auth };
  }

  it('lists every setting with its default', async () => {
    const { auth } = await signedIn();
    const res = await request(app).get('/admin/v1/settings').set(auth);
    const share = res.body.settings.find((s: { key: string }) => s.key === 'platform_share_pct');
    expect(share).toMatchObject({ value: 40, version: 0, isDefault: true, scheduled: [] });
    expect(await settings.get('platform_share_pct')).toBe(40);
  });

  it('applies an immediate change and audits before/after', async () => {
    const { auth } = await signedIn();
    const res = await request(app)
      .put('/admin/v1/settings/topup_min_paise')
      .set(auth)
      .send({ value: 10_000, reason: 'Raise minimum to ₹100' });
    expect(res.status).toBe(201);
    expect(await settings.get('topup_min_paise')).toBe(10_000);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'setting.scheduled' } });
    expect(log).toMatchObject({ entityId: 'topup_min_paise', before: { value: 5000, version: 0 } });
    expect(log.after).toMatchObject({ value: 10_000, version: 1 });
  });

  it('schedules a future change that takes effect at its time, and can cancel it before', async () => {
    const t = await signedIn();
    const effectiveFrom = '2026-12-01T00:00:00+05:30';
    const res = await request(app)
      .put('/admin/v1/settings/platform_share_pct')
      .set(t.auth)
      .send({ value: 38, effectiveFrom, reason: 'December promotion' });
    expect(res.status).toBe(201);
    expect(await settings.get('platform_share_pct')).toBe(40);

    const list = await request(app).get('/admin/v1/settings').set(t.auth);
    const share = list.body.settings.find((s: { key: string }) => s.key === 'platform_share_pct');
    expect(share.scheduled).toEqual([expect.objectContaining({ version: 1, value: 38 })]);

    // A second future version, then cancel it.
    await request(app)
      .put('/admin/v1/settings/platform_share_pct')
      .set(t.auth)
      .send({ value: 35, effectiveFrom: '2027-01-01T00:00:00+05:30', reason: 'January plan' });
    const cancel = await request(app)
      .post('/admin/v1/settings/platform_share_pct/versions/2/cancel')
      .set(t.auth)
      .send({ reason: 'Plan dropped' });
    expect(cancel.status).toBe(200);

    t.advance(60 * 24 * 60 * 60); // into February 2027
    expect(await settings.get('platform_share_pct')).toBe(38);

    // The old session has long expired; sign in again.
    expect((await request(app).get('/admin/v1/settings').set(t.auth)).body.error.code).toBe('ADMIN_SESSION_EXPIRED');
    const fresh = { Authorization: `Bearer ${(await t.login()).body.token}` };

    // Versions already in force can't be cancelled, only superseded.
    const late = await request(app)
      .post('/admin/v1/settings/platform_share_pct/versions/1/cancel')
      .set(fresh)
      .send({ reason: 'Too late now' });
    expect(late.body.error.code).toBe('SETTING_ALREADY_EFFECTIVE');
  });

  it('validates values and refuses backdating and unknown keys', async () => {
    const { auth } = await signedIn();
    const put = (key: string, body: object) => request(app).put(`/admin/v1/settings/${key}`).set(auth).send(body);

    expect((await put('platform_share_pct', { value: 140, reason: 'Typo test' })).body.error.code).toBe('SETTING_INVALID');
    expect((await put('platform_share_pct', { value: '40', reason: 'Type test' })).body.error.code).toBe('SETTING_INVALID');
    expect(
      (await put('platform_share_pct', { value: 39, effectiveFrom: '2026-11-01T00:00:00Z', reason: 'Backdate test' })).body
        .error.code,
    ).toBe('SETTING_BACKDATED');
    expect((await put('no_such_key', { value: 1, reason: 'Unknown key' })).status).toBe(404);
    expect((await put('platform_share_pct', { value: 39 })).body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('audit log', () => {
  it('cannot be edited or deleted, even directly in the database', async () => {
    const t = await setup();
    await t.login();
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: 'admin.login' } });
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });

  it('lists newest first with filters and cursor paging', async () => {
    const t = await setup();
    const auth = { Authorization: `Bearer ${(await t.login()).body.token}` };
    for (let i = 0; i < 3; i++) {
      await request(app)
        .put('/admin/v1/settings/pack_validity_days')
        .set(auth)
        .send({ value: 60 + i, reason: `Change ${i}` });
      t.advance(1);
    }
    const page1 = await request(app).get('/admin/v1/audit-logs').query({ action: 'setting.scheduled', limit: 2 }).set(auth);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].after.value).toBe(62);
    const page2 = await request(app)
      .get('/admin/v1/audit-logs')
      .query({ action: 'setting.scheduled', limit: 2, cursor: page1.body.nextCursor })
      .set(auth);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();
  });
});

describe('single admin', () => {
  it('the database refuses a second admin', async () => {
    await createAdmin();
    await expect(
      prisma.admin.create({
        data: {
          email: 'second@example.com',
          passwordHash: 'x',
          totpSecretEnc: 'x',
          createdAt: new Date(),
          passwordAt: new Date(),
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.admin.count()).toBe(1);
  });
});
