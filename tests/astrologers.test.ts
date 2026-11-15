import request from 'supertest';
import { storage, type StorageProvider } from '../src/adapters/storage';
import { clock } from '../src/lib/clock';
import { randomToken, sha256 } from '../src/lib/crypto';
import { prisma } from '../src/lib/prisma';
import { app, freezeTime, login, useFakeSms, type FakeSms } from './helpers';

/** In-memory storage: the test "uploads" by calling put(). */
class FakeStorage implements StorageProvider {
  readonly name = 'fake';
  objects = new Map<string, { sizeBytes: number; contentType: string }>();
  async createUploadLink(key: string, contentType: string, sizeBytes: number) {
    return { url: `https://fake.storage/${key}`, method: 'PUT' as const, headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) }, expiresAt: new Date() };
  }
  async createViewLink(key: string) {
    return `https://fake.storage/view/${key}`;
  }
  async head(key: string) {
    return this.objects.get(key) ?? null;
  }
  put(url: string, sizeBytes: number, contentType: string) {
    this.objects.set(url.replace('https://fake.storage/', ''), { sizeBytes, contentType });
  }
}

let sms: FakeSms;
let files: FakeStorage;
let advance: (s: number) => void;

beforeEach(() => {
  advance = freezeTime(new Date('2026-11-15T06:00:00Z'));
  sms = useFakeSms();
  files = new FakeStorage();
  storage.use(files);
});

const ASTRO = '9876500001';

async function providerLogin(mobile = ASTRO) {
  advance(31); // OTP resend cooldown between logins on the same number
  return (await login(sms, { mobile, app: 'provider' })).accessToken;
}

/** An admin session created directly; `stepUpAgoSeconds` controls whether sensitive actions need a fresh code. */
async function adminToken(stepUpAgoSeconds = 0) {
  const now = clock.now();
  const admin = await prisma.admin.upsert({
    where: { email: 'founder@example.com' },
    update: {},
    create: { email: 'founder@example.com', passwordHash: 'x', totpSecretEnc: 'x', createdAt: now, passwordAt: now },
  });
  const token = randomToken(32);
  const at = new Date(now.getTime() - stepUpAgoSeconds * 1000);
  await prisma.adminSession.create({
    data: { adminId: admin.id, tokenHash: sha256(token), createdAt: now, lastUsedAt: now, stepUpAt: at },
  });
  return token;
}

const as = (token: string) => ({ Authorization: `Bearer ${token}` });

async function upload(token: string, purpose: string, contentType = 'image/jpeg', sizeBytes = 120_000) {
  const res = await request(app).post('/v1/provider/uploads').set(as(token)).send({ purpose, contentType, sizeBytes });
  expect(res.status).toBe(201);
  files.put(res.body.upload.url, sizeBytes, contentType);
  const done = await request(app).post(`/v1/provider/uploads/${res.body.uploadId}/complete`).set(as(token));
  expect(done.status).toBe(200);
  return res.body.uploadId as string;
}

async function placeId() {
  return (await prisma.place.findFirstOrThrow({ where: { name: 'Varanasi' } })).id;
}

const BIO = 'Fifteen years of Vedic astrology. I explain timing windows and tendencies in simple Hindi.';

/** Fills all five steps. Returns the uploaded document ids. */
async function fillApplication(token: string, rates: Record<string, number> = { chat: 3000, voice: 4000 }) {
  const photo = await upload(token, 'photo');
  const put = (step: string, body: object) => request(app).put(`/v1/provider/application/${step}`).set(as(token)).send(body);
  expect(
    (
      await put('basics', {
        legalName: 'Mohan Sharma',
        displayName: 'Pt. Mohan Sharma',
        gender: 'male',
        placeId: await placeId(),
        languages: ['hi', 'en'],
        experienceYears: 15,
        photoUploadId: photo,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await put('expertise', {
        methods: ['vedic', 'numerology'],
        primaryCategory: 'career-job',
        secondaryCategories: ['marriage-kundli-matching'],
        capabilities: ['consult_chat', 'consult_voice'],
        bio: BIO,
      })
    ).status,
  ).toBe(200);
  const docs = {
    pan: await upload(token, 'pan'),
    idFront: await upload(token, 'id_front'),
    idBack: await upload(token, 'id_back'),
    video: await upload(token, 'intro_video', 'video/mp4', 20_000_000),
  };
  expect(
    (
      await put('documents', {
        panUploadId: docs.pan,
        idType: 'aadhaar',
        idFrontUploadId: docs.idFront,
        idBackUploadId: docs.idBack,
        introVideoUploadId: docs.video,
      })
    ).status,
  ).toBe(200);
  expect((await put('payout', { pan: 'abcde1234f', bankAccount: '123456789012', ifsc: 'hdfc0001234' })).status).toBe(200);
  expect((await put('rates', rates)).status).toBe(200);
  return { photo, ...docs };
}

const submit = (token: string) =>
  request(app).post('/v1/provider/application/submit').set(as(token)).send({ agreements: { conduct: true, terms: true } });

const APPROVE = {
  primaryCategory: 'career-job',
  secondaryCategories: ['marriage-kundli-matching'],
  capabilities: ['consult_chat', 'consult_voice'],
  rates: { chat: 3000, voice: 4000 },
  checks: { panNameMatchesBank: true, faceMatchesId: true },
};

/** Submitted, all documents verified, approved. Returns tokens and the astrologer id. */
async function approvedAstrologer() {
  const token = await providerLogin();
  const docs = await fillApplication(token);
  expect((await submit(token)).status).toBe(200);
  const admin = await adminToken();
  const { id } = (await request(app).get('/v1/provider/application').set(as(token))).body;
  for (const doc of [docs.photo, docs.pan, docs.idFront, docs.idBack, docs.video]) {
    await request(app).post(`/admin/v1/astrologers/${id}/documents/${doc}/review`).set(as(admin)).send({ status: 'verified' });
  }
  const res = await request(app).post(`/admin/v1/astrologers/${id}/approve`).set(as(admin)).send(APPROVE);
  expect(res.status).toBe(200);
  return { token, admin, id: id as string };
}

describe('sessions per app', () => {
  it('signing in to the astrologer app keeps the user app signed in, and tokens stay in their app', async () => {
    const user = (await login(sms, { mobile: ASTRO })).accessToken;
    const provider = await providerLogin();

    expect((await request(app).get('/v1/me').set(as(user))).status).toBe(200);
    expect((await request(app).get('/v1/provider/application').set(as(provider))).status).toBe(200);
    const wrong1 = await request(app).get('/v1/provider/application').set(as(user));
    const wrong2 = await request(app).get('/v1/me').set(as(provider));
    expect([wrong1.status, wrong1.body.error.code]).toEqual([403, 'WRONG_APP']);
    expect([wrong2.status, wrong2.body.error.code]).toEqual([403, 'WRONG_APP']);
    expect((await request(app).get('/v1/auth/session').set(as(provider))).status).toBe(200);
  });
});

describe('uploads', () => {
  it('limits type and size, and only completes once the file is in storage', async () => {
    const t = await providerLogin();
    const send = (body: object) => request(app).post('/v1/provider/uploads').set(as(t)).send(body);
    expect((await send({ purpose: 'photo', contentType: 'application/pdf', sizeBytes: 1000 })).body.error.code).toBe('UPLOAD_TYPE_NOT_ALLOWED');
    expect((await send({ purpose: 'photo', contentType: 'image/jpeg', sizeBytes: 50_000_000 })).body.error.code).toBe('UPLOAD_TOO_LARGE');

    const res = await send({ purpose: 'photo', contentType: 'image/jpeg', sizeBytes: 1000 });
    expect(res.body.upload).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1000' } });
    const complete = () => request(app).post(`/v1/provider/uploads/${res.body.uploadId}/complete`).set(as(t));
    expect((await complete()).body.error.code).toBe('UPLOAD_MISSING');
    files.put(res.body.upload.url, 999, 'image/jpeg');
    expect((await complete()).body.error.code).toBe('UPLOAD_MISMATCH');
    files.put(res.body.upload.url, 1000, 'image/jpeg');
    expect((await complete()).body).toMatchObject({ status: 'uploaded', purpose: 'photo' });
  });

  it("won't let a step use someone else's upload or the wrong kind", async () => {
    const other = await providerLogin('9876500002');
    const theirs = await upload(other, 'photo');
    const t = await providerLogin();
    const pan = await upload(t, 'pan');
    const basics = (photoUploadId: string) =>
      request(app)
        .put('/v1/provider/application/basics')
        .set(as(t))
        .send({ legalName: 'Mohan Sharma', displayName: 'Mohan', gender: 'male', placeId: 1259229, languages: ['hi'], experienceYears: 5, photoUploadId });
    await prisma.place.findFirstOrThrow();
    const p = await placeId();
    const withPlace = (photoUploadId: string) =>
      request(app)
        .put('/v1/provider/application/basics')
        .set(as(t))
        .send({ legalName: 'Mohan Sharma', displayName: 'Mohan', gender: 'male', placeId: p, languages: ['hi'], experienceYears: 5, photoUploadId });
    void basics;
    expect((await withPlace(theirs)).body.error.code).toBe('UPLOAD_INVALID');
    expect((await withPlace(pan)).body.error.code).toBe('UPLOAD_INVALID');
  });
});

describe('application', () => {
  it('enforces the rules: topics, bio claims, the new-astrologer rate cap, completeness', async () => {
    const t = await providerLogin();
    const put = (step: string, body: object) => request(app).put(`/v1/provider/application/${step}`).set(as(t)).send(body);
    const expertise = { methods: ['vedic'], primaryCategory: 'career-job', capabilities: ['consult_chat'], bio: BIO };

    expect((await put('expertise', { ...expertise, primaryCategory: 'health' })).body.error.code).toBe('UNKNOWN_TOPIC');
    expect((await put('expertise', { ...expertise, methods: ['black-magic'] })).body.error.code).toBe('UNKNOWN_METHOD');
    expect((await put('expertise', { ...expertise, capabilities: ['host_live'] })).body.error.code).toBe('VALIDATION_FAILED');
    const claim = await put('expertise', { ...expertise, bio: `${BIO} 100% guaranteed results, call me on 98765 43210.` });
    expect(claim.body.error.code).toBe('BIO_NOT_ALLOWED');
    expect((await put('expertise', expertise)).status).toBe(200);

    expect((await put('rates', { chat: 6000 })).body.error.code).toBe('RATE_ABOVE_CAP');
    expect((await put('rates', { chat: 100 })).body.error.code).toBe('RATE_TOO_LOW');
    expect((await put('payout', { pan: 'ABC', bankAccount: '12', ifsc: 'x' })).body.error.code).toBe('VALIDATION_FAILED');

    const res = await submit(t);
    expect(res.body.error.code).toBe('APPLICATION_INCOMPLETE');
    expect(res.body.error.details.missing).toEqual(['basics', 'documents', 'payout', 'rates']);
  });

  it('submits once complete, records the agreements and locks editing', async () => {
    const t = await providerLogin();
    await fillApplication(t);
    const noTerms = await request(app).post('/v1/provider/application/submit').set(as(t)).send({ agreements: { conduct: true } });
    expect(noTerms.body.error.code).toBe('VALIDATION_FAILED');

    const res = await submit(t);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');
    expect(res.body.timeline.steps[0].doneAt).toBeTruthy();
    expect(res.body.payout).toMatchObject({ panLast4: '234F', bankAccountLast4: '9012', ifsc: 'HDFC0001234' });
    expect(JSON.stringify(res.body)).not.toContain('ABCDE1234F');
    const consents = await prisma.consent.findMany({ where: { docType: { in: ['provider_conduct', 'provider_terms'] } } });
    expect(consents).toHaveLength(2);

    const edit = await request(app).put('/v1/provider/application/rates').set(as(t)).send({ chat: 2000 });
    expect(edit.body.error.code).toBe('APPLICATION_LOCKED');
  });

  it('withdraw returns it to a draft', async () => {
    const t = await providerLogin();
    await fillApplication(t);
    await submit(t);
    const res = await request(app).post('/v1/provider/application/withdraw').set(as(t));
    expect(res.body.status).toBe('draft');
  });
});

describe('admin review', () => {
  it('lists, shows masked KYC, and reveals it only with a fresh authenticator code', async () => {
    const t = await providerLogin();
    await fillApplication(t);
    await submit(t);
    const stale = await adminToken(600);

    const list = await request(app).get('/admin/v1/astrologers?status=submitted').set(as(stale));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.counts.submitted).toBe(1);
    const id = list.body.items[0].id;

    const detail = await request(app).get(`/admin/v1/astrologers/${id}`).set(as(stale));
    expect(detail.body.payout.panLast4).toBe('234F');
    expect(detail.body.documentFiles.every((d: { url: string }) => d.url.startsWith('https://fake.storage/view/'))).toBe(true);
    expect(JSON.stringify(detail.body)).not.toContain('123456789012');

    const blocked = await request(app).post(`/admin/v1/astrologers/${id}/kyc/reveal`).set(as(stale));
    expect(blocked.body.error.code).toBe('STEP_UP_REQUIRED');
    const fresh = await adminToken(0);
    const revealed = await request(app).post(`/admin/v1/astrologers/${id}/kyc/reveal`).set(as(fresh));
    expect(revealed.body).toMatchObject({ pan: 'ABCDE1234F', bankAccount: '123456789012' });
  });

  it('asks for a fix, the astrologer fixes and resubmits, documents get verified, then approval', async () => {
    const t = await providerLogin();
    const docs = await fillApplication(t);
    await submit(t);
    const admin = await adminToken();
    const { id } = (await request(app).get('/v1/provider/application').set(as(t))).body;

    // Approval is refused until documents are verified and both checks are ticked.
    expect((await request(app).post(`/admin/v1/astrologers/${id}/approve`).set(as(admin)).send(APPROVE)).body.error.code).toBe(
      'DOCUMENTS_NOT_VERIFIED',
    );

    const rejectDoc = await request(app)
      .post(`/admin/v1/astrologers/${id}/documents/${docs.pan}/review`)
      .set(as(admin))
      .send({ status: 'rejected', note: 'PAN photo is blurry' });
    expect(rejectDoc.status).toBe(200);
    const fix = await request(app)
      .post(`/admin/v1/astrologers/${id}/fixes`)
      .set(as(admin))
      .send({ items: [{ field: 'pan', message: 'Your PAN photo is blurry. Please upload it again.' }] });
    expect(fix.body.status).toBe('needs_changes');

    const seen = (await request(app).get('/v1/provider/application').set(as(t))).body;
    expect(seen.fixes).toHaveLength(1);
    expect(seen.documents.pan).toMatchObject({ review: 'rejected', reviewNote: 'PAN photo is blurry' });

    const newPan = await upload(t, 'pan');
    await request(app)
      .put('/v1/provider/application/documents')
      .set(as(t))
      .send({ panUploadId: newPan, idType: 'aadhaar', idFrontUploadId: docs.idFront, idBackUploadId: docs.idBack, introVideoUploadId: docs.video });
    const resubmitted = await submit(t);
    expect(resubmitted.body.status).toBe('submitted');
    expect(resubmitted.body.fixes).toHaveLength(0);

    for (const doc of [docs.photo, newPan, docs.idFront, docs.idBack, docs.video]) {
      await request(app).post(`/admin/v1/astrologers/${id}/documents/${doc}/review`).set(as(admin)).send({ status: 'verified' });
    }
    const afterDocs = (await request(app).get('/v1/provider/application').set(as(t))).body;
    expect(afterDocs.timeline.steps[1].doneAt).toBeTruthy();

    const interview = await request(app)
      .post(`/admin/v1/astrologers/${id}/interview`)
      .set(as(admin))
      .send({ at: '2026-11-16T05:30:00Z', link: 'https://meet.google.com/abc-defg-hij' });
    expect(interview.body.status).toBe('interview_scheduled');

    const unchecked = await request(app)
      .post(`/admin/v1/astrologers/${id}/approve`)
      .set(as(admin))
      .send({ ...APPROVE, checks: { panNameMatchesBank: true } });
    expect(unchecked.body.error.code).toBe('VALIDATION_FAILED');
    const overCap = await request(app)
      .post(`/admin/v1/astrologers/${id}/approve`)
      .set(as(admin))
      .send({ ...APPROVE, rates: { chat: 9000, voice: 4000 } });
    expect(overCap.body.error.code).toBe('RATE_ABOVE_CAP');

    const approved = await request(app).post(`/admin/v1/astrologers/${id}/approve`).set(as(admin)).send(APPROVE);
    expect(approved.body).toMatchObject({ status: 'approved', listed: true, capabilities: ['consult_chat', 'consult_voice'] });
    const user = await prisma.user.findFirstOrThrow({ where: { phoneLast4: '0001' } });
    expect(user.roles).toContain('astrologer');
  });

  it('rejects with a reason and a reapply date', async () => {
    const t = await providerLogin();
    await fillApplication(t);
    await submit(t);
    const admin = await adminToken();
    const { id } = (await request(app).get('/v1/provider/application').set(as(t))).body;
    const res = await request(app).post(`/admin/v1/astrologers/${id}/reject`).set(as(admin)).send({ reason: 'Could not verify the ID' });
    expect(res.body.rejection.reason).toBe('Could not verify the ID');
    expect((await request(app).post('/v1/provider/application/reapply').set(as(t))).body.error.code).toBe('REAPPLY_TOO_SOON');
    advance(31 * 86_400);
    const again = await providerLogin(); // the 15-minute access token expired meanwhile
    expect((await request(app).post('/v1/provider/application/reapply').set(as(again))).body.status).toBe('draft');
  });
});

describe('after approval', () => {
  it('appears in the public list and profile; drafts never do', async () => {
    const draft = await providerLogin('9876500002');
    await fillApplication(draft);
    const { id } = await approvedAstrologer();

    const list = await request(app).get('/v1/astrologers');
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ id, displayName: 'Pt. Mohan Sharma', status: 'offline', fromRatePaise: 3000, modes: ['chat', 'voice'] });
    expect((await request(app).get('/v1/astrologers?category=career-job')).body.total).toBe(1);
    expect((await request(app).get('/v1/astrologers?category=love-relationships')).body.total).toBe(0);
    expect((await request(app).get('/v1/astrologers?mode=video')).body.total).toBe(0);
    expect((await request(app).get('/v1/astrologers?online=1')).body.total).toBe(0);
    expect(list.body.priceRange).toEqual({ minPaise: 3000, maxPaise: 3000 });
    expect((await request(app).get('/v1/astrologers?maxRatePaise=2000')).body.total).toBe(0);
    expect((await request(app).get('/v1/astrologers?minRatePaise=2000&maxRatePaise=3000')).body.total).toBe(1);
    expect((await request(app).get('/v1/astrologers?live=1')).body.total).toBe(0);

    const profile = await request(app).get(`/v1/astrologers/${id}`);
    expect(profile.body.trust).toMatchObject({ identityVerified: true, passedReview: true });
    expect(profile.body.methodNames[0]).toMatchObject({ slug: 'vedic', nameHi: 'वैदिक' });
    expect(JSON.stringify(profile.body)).not.toMatch(/legalName|pan|bank/i);
  });

  it('goes online per granted mode only; away pauses everything', async () => {
    const { token } = await approvedAstrologer();
    const put = (body: object) => request(app).put('/v1/provider/availability').set(as(token)).send(body);
    expect((await put({ video: true })).body.error.code).toBe('MODE_NOT_ENABLED');

    const on = await put({ chat: true });
    expect(on.body.status).toBe('online');
    expect((await request(app).get('/v1/astrologers?online=1')).body.total).toBe(1);

    const away = await put({ awayMinutes: 15 });
    expect(away.body.status).toBe('offline');
    advance(16 * 60);
    const again = await providerLogin();
    expect((await request(app).get('/v1/provider/home').set(as(again))).body.status).toBe('online');
  });

  it('rate changes: cuts apply now, small rises after 24 hours, big rises wait for the admin', async () => {
    let { token } = await approvedAstrologer();
    advance(1);
    const change = (mode: string, ratePaise: number) => request(app).post('/v1/provider/rates').set(as(token)).send({ mode, ratePaise });
    const chatRate = async () => (await request(app).get('/v1/provider/home').set(as(token))).body.modes[0].ratePaise;

    expect((await change('chat', 2500)).body.result).toBe('applied');
    expect(await chatRate()).toBe(2500);

    advance(1);
    expect((await change('chat', 2800)).body.result).toBe('scheduled');
    expect(await chatRate()).toBe(2500);
    advance(24 * 3600 + 1);
    token = await providerLogin();
    expect(await chatRate()).toBe(2800);

    expect((await change('chat', 5100)).body.error.code).toBe('RATE_ABOVE_CAP');
    expect((await change('chat', 4000)).body.result).toBe('in_review');
    const admin = await adminToken();
    const pending = await request(app).get('/admin/v1/astrologer-rate-requests').set(as(admin));
    expect(pending.body.items).toHaveLength(1);
    await request(app).post(`/admin/v1/astrologer-rate-requests/${pending.body.items[0].id}/decide`).set(as(admin)).send({ approve: true });
    expect(await chatRate()).toBe(2800);
    advance(24 * 3600 + 1);
    token = await providerLogin();
    expect(await chatRate()).toBe(4000);
  });

  it('profile edits wait for review while the live profile stays', async () => {
    const { token, admin, id } = await approvedAstrologer();
    const edit = await request(app).post('/v1/provider/profile/revisions').set(as(token)).send({ displayName: 'Acharya Mohan' });
    expect(edit.status).toBe(202);
    expect((await request(app).post('/v1/provider/profile/revisions').set(as(token)).send({ bio: BIO })).body.error.code).toBe('REVISION_PENDING');
    expect((await request(app).get(`/v1/astrologers/${id}`)).body.displayName).toBe('Pt. Mohan Sharma');

    const pending = await request(app).get('/admin/v1/astrologer-revisions').set(as(admin));
    await request(app).post(`/admin/v1/astrologer-revisions/${pending.body.items[0].id}/decide`).set(as(admin)).send({ approve: true });
    expect((await request(app).get(`/v1/astrologers/${id}`)).body.displayName).toBe('Acharya Mohan');
  });

  it('suspension takes them offline and off the list at once', async () => {
    const { token, admin, id } = await approvedAstrologer();
    await request(app).put('/v1/provider/availability').set(as(token)).send({ chat: true });
    const res = await request(app).post(`/admin/v1/astrologers/${id}/suspend`).set(as(admin)).send({ reason: 'Asked a user to pay outside the app' });
    expect(res.body.status).toBe('suspended');
    expect((await request(app).get('/v1/astrologers')).body.total).toBe(0);
    expect((await request(app).get('/v1/provider/home').set(as(token))).body.error.code).toBe('ASTROLOGER_SUSPENDED');
  });
});
