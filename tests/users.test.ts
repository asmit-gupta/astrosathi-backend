import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, freezeTime, login, useFakeSms } from './helpers';

const LUCKNOW = 1264733;

async function signedIn() {
  const fake = useFakeSms();
  const { accessToken, user } = await login(fake);
  const auth = { Authorization: `Bearer ${accessToken}` };
  return {
    userId: user.id,
    get: (path: string) => request(app).get(path).set(auth),
    post: (path: string, body?: object) => request(app).post(path).set(auth).send(body ?? {}),
    put: (path: string, body: object) => request(app).put(path).set(auth).send(body),
    patch: (path: string, body: object) => request(app).patch(path).set(auth).send(body),
    del: (path: string) => request(app).delete(path).set(auth),
  };
}

const profile = (over: Record<string, unknown> = {}) => ({
  label: 'Self',
  isSelf: true,
  name: 'Aman Verma',
  gender: 'male',
  dob: '1996-03-14',
  tob: '06:40',
  tobAccuracy: 'exact',
  placeId: LUCKNOW,
  ...over,
});

describe('public catalogue', () => {
  it('lists the nine topic categories in order, in Hindi and English', async () => {
    const res = await request(app).get('/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(9);
    expect(res.body.categories[0]).toMatchObject({ slug: 'love-relationships', nameHi: 'प्रेम और रिश्ते' });
    expect(res.body.categories.map((c: { slug: string }) => c.slug)).not.toContain('health');
  });

  it('searches places by English prefix, biggest first', async () => {
    const res = await request(app).get('/v1/places').query({ q: 'luck' });
    expect(res.status).toBe(200);
    expect(res.body.places[0]).toMatchObject({
      id: LUCKNOW,
      label: 'Lucknow, Uttar Pradesh',
      tzId: 'Asia/Kolkata',
    });
    expect(res.body.places[0].lat).toBeCloseTo(26.839, 2);
  });

  it('searches places by Hindi alias', async () => {
    const res = await request(app).get('/v1/places').query({ q: 'लखनऊ' });
    expect(res.body.places[0]).toMatchObject({ id: LUCKNOW });
  });

  it('needs at least 2 characters', async () => {
    expect((await request(app).get('/v1/places').query({ q: 'l' })).status).toBe(400);
  });
});

describe('/v1/me', () => {
  it('requires sign-in', async () => {
    expect((await request(app).get('/v1/me')).status).toBe(401);
  });

  it('returns and updates the profile', async () => {
    const me = await signedIn();
    const res = await me.get('/v1/me');
    expect(res.body).toMatchObject({ phone: '+91 98•••••210', name: null, language: 'hi', deletion: null });

    const updated = await me.patch('/v1/me', { name: 'अमन वर्मा', language: 'en' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'अमन वर्मा', language: 'en' });

    expect((await me.patch('/v1/me', { name: 'A1' })).status).toBe(400);
    expect((await me.patch('/v1/me', { status: 'active' })).status).toBe(400);
  });
});

describe('birth profiles', () => {
  it('creates a profile with place, coordinates and timezone filled from the place', async () => {
    const me = await signedIn();
    const res = await me.post('/v1/me/birth-profiles', profile());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      isSelf: true,
      dob: '1996-03-14',
      tob: '06:40',
      place: { id: LUCKNOW, label: 'Lucknow, Uttar Pradesh', tzId: 'Asia/Kolkata' },
    });
  });

  it('accepts "I don\'t know the time" as a rough window', async () => {
    const me = await signedIn();
    const ok = await me.post('/v1/me/birth-profiles', profile({ tob: null, tobAccuracy: 'morning' }));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ tob: null, tobAccuracy: 'morning' });

    // Exact needs a time; a window must not carry one.
    expect((await me.post('/v1/me/birth-profiles', profile({ isSelf: false, tob: null }))).status).toBe(400);
    expect((await me.post('/v1/me/birth-profiles', profile({ isSelf: false, tobAccuracy: 'night' }))).status).toBe(400);
  });

  it('blocks future dates, impossible dates and under-18s (by the Indian date)', async () => {
    freezeTime(new Date('2026-11-13T19:00:00Z')); // already 14 Nov in India
    const me = await signedIn();

    const future = await me.post('/v1/me/birth-profiles', profile({ dob: '2026-11-15' }));
    expect(future.body.error.code).toBe('DOB_IN_FUTURE');
    expect((await me.post('/v1/me/birth-profiles', profile({ dob: '1996-02-30' }))).status).toBe(400);

    const minor = await me.post('/v1/me/birth-profiles', profile({ dob: '2008-11-15' }));
    expect(minor.body.error.code).toBe('PROFILE_UNDER_18');
    // Turns 18 today in India (still 13 Nov in UTC).
    expect((await me.post('/v1/me/birth-profiles', profile({ dob: '2008-11-14' }))).status).toBe(201);
  });

  it('allows one Self profile and family profiles, up to 10', async () => {
    const me = await signedIn();
    expect((await me.post('/v1/me/birth-profiles', profile())).status).toBe(201);
    const second = await me.post('/v1/me/birth-profiles', profile());
    expect(second.body.error.code).toBe('SELF_PROFILE_EXISTS');

    for (let i = 0; i < 9; i++) {
      const res = await me.post('/v1/me/birth-profiles', profile({ isSelf: false, label: `Family ${i}` }));
      expect(res.status).toBe(201);
    }
    const eleventh = await me.post('/v1/me/birth-profiles', profile({ isSelf: false, label: 'One more' }));
    expect(eleventh.status).toBe(409);
    expect(eleventh.body.error.code).toBe('BIRTH_PROFILE_LIMIT');

    const list = await me.get('/v1/me/birth-profiles');
    expect(list.body.profiles).toHaveLength(10);
    expect(list.body.profiles[0].isSelf).toBe(true);
  });

  it('rejects unknown places', async () => {
    const me = await signedIn();
    const res = await me.post('/v1/me/birth-profiles', profile({ placeId: 999999999 }));
    expect(res.body.error.code).toBe('PLACE_NOT_FOUND');
  });

  it('updates and deletes, checking time consistency against stored values', async () => {
    const me = await signedIn();
    const { body: created } = await me.post('/v1/me/birth-profiles', profile());

    const toWindow = await me.patch(`/v1/me/birth-profiles/${created.id}`, { tob: null, tobAccuracy: 'evening' });
    expect(toWindow.status).toBe(200);
    expect(toWindow.body).toMatchObject({ tob: null, tobAccuracy: 'evening' });

    // Setting a time alone while the stored accuracy is a window is inconsistent.
    expect((await me.patch(`/v1/me/birth-profiles/${created.id}`, { tob: '07:00' })).status).toBe(400);

    expect((await me.del(`/v1/me/birth-profiles/${created.id}`)).status).toBe(204);
    expect((await me.get(`/v1/me/birth-profiles/${created.id}`)).status).toBe(404);
  });

  it("can't see or touch another user's profile", async () => {
    const owner = await signedIn();
    const { body: created } = await owner.post('/v1/me/birth-profiles', profile());

    // A second account, signing in with a different number.
    const fake = useFakeSms();
    const other = await login(fake, { mobile: '9123456789', deviceId: 'device-other-01' });
    const auth = { Authorization: `Bearer ${other.accessToken}` };

    expect((await request(app).get(`/v1/me/birth-profiles/${created.id}`).set(auth)).status).toBe(404);
    expect((await request(app).delete(`/v1/me/birth-profiles/${created.id}`).set(auth)).status).toBe(404);
    expect(await prisma.birthProfile.count()).toBe(1);
  });
});

describe('preferences', () => {
  const answers = {
    topics: ['career-job', 'marriage-kundli-matching'],
    languages: ['hi'],
    modes: ['voice'],
    budgetBand: 'from_20_to_50',
    genderPref: 'no_preference',
    source: 'device_sync',
    consent: true,
  };

  it('saves answers only with consent, and returns them', async () => {
    const me = await signedIn();
    expect((await me.get('/v1/me/preferences')).body).toEqual({ preferences: null });

    const { consent: _c, ...noConsent } = answers;
    expect((await me.put('/v1/me/preferences', noConsent)).status).toBe(400);

    const res = await me.put('/v1/me/preferences', answers);
    expect(res.status).toBe(200);
    expect(res.body.preferences).toMatchObject({
      topics: ['career-job', 'marriage-kundli-matching'],
      languages: ['hi'],
      budgetBand: 'from_20_to_50',
      showEveryone: false,
    });
    expect(res.body.preferences.answeredAt).toBeTruthy();

    const row = await prisma.userPreference.findUniqueOrThrow({ where: { userId: me.userId } });
    expect(row.consentVersion).toBe('v1');
  });

  it('rejects unknown topics and more than 3', async () => {
    const me = await signedIn();
    const unknown = await me.put('/v1/me/preferences', { ...answers, topics: ['health'] });
    expect(unknown.body.error).toMatchObject({ code: 'UNKNOWN_TOPIC', details: { topics: ['health'] } });

    const tooMany = await me.put('/v1/me/preferences', {
      ...answers,
      topics: ['career-job', 'love-relationships', 'business-money', 'education-exams'],
    });
    expect(tooMany.status).toBe(400);
  });

  it('records "skip all" without answers', async () => {
    const me = await signedIn();
    const res = await me.put('/v1/me/preferences', { source: 'device_sync', consent: true, skipped: true });
    expect(res.body.preferences).toMatchObject({ topics: [], answeredAt: null });
    expect(res.body.preferences.skippedAt).toBeTruthy();
  });

  it('toggles "show everyone" and deletes', async () => {
    const me = await signedIn();
    expect((await me.patch('/v1/me/preferences', { showEveryone: true })).status).toBe(404);
    await me.put('/v1/me/preferences', answers);
    expect((await me.patch('/v1/me/preferences', { showEveryone: true })).body.preferences.showEveryone).toBe(true);

    expect((await me.del('/v1/me/preferences')).status).toBe(204);
    expect((await me.get('/v1/me/preferences')).body.preferences).toBeNull();
  });
});

describe('consents and data rights', () => {
  it('lists login consents and lets marketing be turned on and off', async () => {
    const me = await signedIn();
    const before = await me.get('/v1/me/consents');
    expect(before.body.consents.map((c: { docType: string }) => c.docType)).toEqual(['terms', 'privacy', 'age_18']);

    await me.put('/v1/me/consents/marketing', { granted: true });
    await me.put('/v1/me/consents/marketing', { granted: true }); // no duplicate
    await me.put('/v1/me/consents/marketing', { granted: false });

    const marketing = await prisma.consent.findMany({ where: { userId: me.userId, docType: 'marketing' } });
    expect(marketing).toHaveLength(1);
    expect(marketing[0]!.withdrawnAt).not.toBeNull();
  });

  it('records one open export request at a time', async () => {
    const me = await signedIn();
    const first = await me.post('/v1/me/data-export');
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ type: 'export', status: 'received' });
    const again = await me.post('/v1/me/data-export');
    expect(again.body.id).toBe(first.body.id);
  });

  it('deletion has a 7-day cool-off and can be cancelled', async () => {
    freezeTime(new Date('2026-11-14T10:00:00Z'));
    const me = await signedIn();

    const res = await me.post('/v1/me/deletion');
    expect(res.status).toBe(202);
    expect(res.body.dueAt).toBe('2026-11-21T10:00:00.000Z');

    const pending = await me.get('/v1/me');
    expect(pending.body).toMatchObject({ status: 'deletion_pending', deletion: { dueAt: '2026-11-21T10:00:00.000Z' } });

    expect((await me.del('/v1/me/deletion')).status).toBe(204);
    expect((await me.get('/v1/me')).body).toMatchObject({ status: 'active', deletion: null });
    expect((await me.del('/v1/me/deletion')).status).toBe(404);
  });

  it('suspended accounts are sent to support instead', async () => {
    const me = await signedIn();
    await prisma.user.update({ where: { id: me.userId }, data: { status: 'suspended' } });
    const res = await me.post('/v1/me/deletion');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});
