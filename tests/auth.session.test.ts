import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, freezeTime, login, MOBILE, useFakeSms } from './helpers';

const session = (token: string) => request(app).get('/v1/auth/session').set('Authorization', `Bearer ${token}`);
const refresh = (refreshToken: string) => request(app).post('/v1/auth/token/refresh').send({ refreshToken });

describe('login', () => {
  it('creates the user once, with the phone encrypted', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    const first = await login(fake);
    expect(first.user.isNew).toBe(true);
    expect(first.user).toMatchObject({ phone: '+91 98•••••210', language: 'hi', status: 'active', roles: ['user'] });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: first.user.id } });
    expect(row.phoneEnc).not.toContain(MOBILE);
    expect(row.phoneHash).not.toContain(MOBILE);
    expect(row.phoneLast4).toBe('3210');

    advance(31);
    const second = await login(fake);
    expect(second.user).toMatchObject({ id: first.user.id, isNew: false });
    expect(await prisma.user.count()).toBe(1);
  });

  it('stores consents with versions, without duplicates', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    const { user } = await login(fake, { consents: { terms: true, age18: true, marketing: true } });
    advance(31);
    await login(fake);

    const consents = await prisma.consent.findMany({ where: { userId: user.id }, orderBy: { docType: 'asc' } });
    expect(consents.map((c) => `${c.docType}:${c.docVersion}`)).toEqual([
      'terms:v1',
      'privacy:v1',
      'age_18:v1',
      'marketing:v1',
    ]);
  });

  it('signing in on a new device signs the old one out', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    const phoneA = await login(fake, { deviceId: 'device-phone-a' });
    advance(31);
    const phoneB = await login(fake, { deviceId: 'device-phone-b' });

    const old = await session(phoneA.accessToken);
    expect(old.status).toBe(401);
    expect(old.body.error.code).toBe('SESSION_REVOKED');
    expect((await refresh(phoneA.refreshToken)).body.error.code).toBe('SESSION_REVOKED');

    expect((await session(phoneB.accessToken)).status).toBe(200);
  });
});

describe('access tokens', () => {
  it('returns the signed-in user with a masked phone', async () => {
    const fake = useFakeSms();
    const { accessToken, user } = await login(fake);
    const res = await session(accessToken);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, phone: '+91 98•••••210' });
    expect(res.body.user.phoneEnc).toBeUndefined();
  });

  it('rejects missing, malformed and expired tokens', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    const { accessToken } = await login(fake);

    expect((await request(app).get('/v1/auth/session')).body.error.code).toBe('UNAUTHORIZED');
    expect((await session('not-a-jwt')).body.error.code).toBe('TOKEN_INVALID');

    advance(15 * 60 + 1);
    const expired = await session(accessToken);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('refresh tokens', () => {
  it('rotates on every use', async () => {
    const fake = useFakeSms();
    const { refreshToken } = await login(fake);
    const res = await refresh(refreshToken);
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    expect((await session(res.body.accessToken)).status).toBe(200);
  });

  it('reusing an old token revokes the whole session', async () => {
    const fake = useFakeSms();
    const { refreshToken } = await login(fake);
    const rotated = await refresh(refreshToken);

    const reuse = await refresh(refreshToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSED');

    // The legitimate holder is signed out too: someone else has a copy.
    expect((await refresh(rotated.body.refreshToken)).body.error.code).toBe('SESSION_REVOKED');
    expect((await session(rotated.body.accessToken)).body.error.code).toBe('SESSION_REVOKED');
  });

  it('expires after 60 days', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    const { refreshToken } = await login(fake);
    advance(60 * 24 * 60 * 60);
    expect((await refresh(refreshToken)).body.error.code).toBe('REFRESH_EXPIRED');
  });

  it('rejects unknown tokens', async () => {
    const res = await refresh('x'.repeat(43));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('REFRESH_INVALID');
  });
});

describe('logout', () => {
  it('kills both the access and refresh token', async () => {
    const fake = useFakeSms();
    const { accessToken, refreshToken } = await login(fake);
    const res = await request(app).post('/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
    expect((await session(accessToken)).body.error.code).toBe('SESSION_REVOKED');
    expect((await refresh(refreshToken)).body.error.code).toBe('SESSION_REVOKED');
  });
});

describe('errors', () => {
  it('returns a request id and a stable shape', async () => {
    const res = await request(app).post('/v1/auth/otp/send').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'INVALID_JSON' } });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });
});
