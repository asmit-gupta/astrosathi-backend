import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { clock } from '../src/lib/clock';
import { randomToken, sha256 } from '../src/lib/crypto';
import { prisma } from '../src/lib/prisma';
import { sweep, touch } from '../src/modules/consults/consults.service';
import { maskContacts } from '../src/modules/consults/mask';
import { app, freezeTime, login, useFakeSms, type FakeSms } from './helpers';

let sms: FakeSms;
let advance: (s: number) => void;
const open: WebSocket[] = [];

beforeEach(() => {
  advance = freezeTime(new Date('2026-11-16T06:00:00Z'));
  sms = useFakeSms();
});
afterEach(() => {
  for (const ws of open.splice(0)) ws.close();
});

const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const RATE = 3000; // ₹30/min

async function signIn(mobile: string, appName: 'user' | 'provider' = 'user') {
  advance(31); // OTP resend cooldown
  return login(sms, { mobile, app: appName });
}

/** A live astrologer with chat at ₹30/min, created directly. */
async function liveAstrologer(mobile = '9876500001') {
  const { accessToken, user } = await signIn(mobile, 'provider');
  const now = clock.now();
  const a = await prisma.astrologer.create({
    data: {
      userId: user.id,
      status: 'approved',
      listed: true,
      displayName: 'Pt. Mohan Sharma',
      capabilities: ['consult_chat'],
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.astrologerRate.create({
    data: { astrologerId: a.id, mode: 'chat', ratePaise: RATE, status: 'approved', effectiveFrom: now, createdAt: now },
  });
  await prisma.astrologerAvailability.create({ data: { astrologerId: a.id, chat: true, updatedAt: now } });
  return { token: accessToken, id: a.id };
}

async function adminToken() {
  const now = clock.now();
  const admin = await prisma.admin.create({
    data: { email: 'founder@example.com', passwordHash: 'x', totpSecretEnc: 'x', createdAt: now, passwordAt: now },
  });
  const token = randomToken(32);
  await prisma.adminSession.create({
    data: { adminId: admin.id, tokenHash: sha256(token), createdAt: now, lastUsedAt: now, stepUpAt: now },
  });
  return token;
}

/** A socket that records every event it receives. */
async function socket(token: string) {
  const { port } = app.address() as AddressInfo;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/v1/ws?token=${token}`);
  open.push(ws);
  const events: Record<string, unknown>[] = [];
  ws.on('message', (d) => events.push(JSON.parse(String(d)) as Record<string, unknown>));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const waitFor = async (pred: (e: Record<string, unknown>) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const hit = events.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`event not received; got ${JSON.stringify(events)}`);
  };
  return { ws, events, waitFor };
}

const credit = (admin: string, mobile: string, amountPaise: number) =>
  request(app).post('/admin/v1/wallet-credits').set(as(admin)).send({ mobile, amountPaise, reason: 'Testing' });

describe('masking', () => {
  it('hides contact details and payment apps, keeps birth dates and times', () => {
    expect(maskContacts('call me on 98765 43210 or +91-9876543210')).toEqual({
      text: 'call me on ••• or •••',
      flagged: true,
    });
    expect(maskContacts('pay me directly on gpay, mohan@okaxis').flagged).toBe(true);
    expect(maskContacts('Born 12-05-1990 at 10:30, Varanasi')).toEqual({
      text: 'Born 12-05-1990 at 10:30, Varanasi',
      flagged: false,
    });
  });
});

describe('chat consults', () => {
  it('request → accept → chat in real time → billed per started minute → end', async () => {
    const astro = await liveAstrologer();
    const { accessToken: user } = await signIn('9876511111');
    const admin = await adminToken();
    const start = (token = user) =>
      request(app).post('/v1/me/consults').set(as(token)).send({ providerId: astro.id, mode: 'chat' });

    // 5 minutes of balance are needed to start.
    expect((await start()).body.error).toMatchObject({ code: 'LOW_BALANCE', details: { needPaise: RATE * 5 } });
    expect((await credit(admin, '9876511111', 20_000)).body.balancePaise).toBe(20_000);

    const other = await signIn('9876522222');
    await credit(admin, '9876522222', 20_000);
    const astroWs = await socket(astro.token);
    const userWs = await socket(user);
    const req = await start();
    expect(req.status).toBe(201);
    expect(req.body).toMatchObject({ status: 'requested', ratePaise: RATE, balancePaise: 20_000 });
    const id = req.body.id as string;
    await astroWs.waitFor((e) => e.t === 'consult' && (e.consult as { status: string }).status === 'requested');

    // Busy while waiting; can't double-book.
    expect((await request(app).get('/v1/astrologers')).body.items[0].status).toBe('busy');
    expect((await start(other.accessToken)).body.error.code).toBe('PROVIDER_BUSY');

    // Accept charges the first minute: ₹30 → astrologer ₹12 (40%), platform ₹18.
    const acc = await request(app).post(`/v1/provider/consults/${id}/accept`).set(as(astro.token));
    expect(acc.body).toMatchObject({ status: 'active', minutesBilled: 1, earnedPaise: 1200 });
    await userWs.waitFor((e) => e.t === 'consult' && (e.consult as { status: string }).status === 'active');
    expect((await request(app).get('/v1/me/wallet').set(as(user))).body.balancePaise).toBe(20_000 - RATE);

    // Messages over the socket: ack to the sender, event to the other side, masked contacts.
    const msgId = randomUUID();
    userWs.ws.send(JSON.stringify({ t: 'send', consultId: id, id: msgId, body: 'Namaste, my number is 9876543210' }));
    const ack = await userWs.waitFor((e) => e.t === 'ack' && e.id === msgId);
    expect(ack.message).toMatchObject({ seq: 1, body: 'Namaste, my number is •••', flagged: true });
    await astroWs.waitFor((e) => e.t === 'message' && (e.message as { id: string }).id === msgId);

    // A resend after a network drop is stored once.
    const again = await request(app)
      .post(`/v1/me/consults/${id}/messages`)
      .set(as(user))
      .send({ id: msgId, body: 'Namaste, my number is 9876543210' });
    expect(again.body.seq).toBe(1);
    await request(app)
      .post(`/v1/provider/consults/${id}/messages`)
      .set(as(astro.token))
      .send({ id: randomUUID(), body: 'Namaste. Your chart, please.' });
    const history = await request(app).get(`/v1/me/consults/${id}/messages?after=1`).set(as(user));
    expect(history.body.items.map((m: { sender: string }) => m.sender)).toEqual(['provider']);

    // Ticks: the reply is unread until the user opens it; then the astrologer sees it was read.
    expect((await request(app).get('/v1/me/consults').set(as(user))).body.items[0]).toMatchObject({ unread: 1 });
    userWs.ws.send(JSON.stringify({ t: 'read', consultId: id, seq: 2 }));
    await astroWs.waitFor((e) => e.t === 'read' && e.side === 'user' && e.seq === 2);
    expect((await request(app).get('/v1/me/consults').set(as(user))).body.items[0]).toMatchObject({ unread: 0 });
    expect((await request(app).get(`/v1/provider/consults/${id}`).set(as(astro.token))).body.readSeq).toEqual({
      user: 2,
      provider: 2,
    });

    // Typing passes through.
    astroWs.ws.send(JSON.stringify({ t: 'typing', consultId: id }));
    await userWs.waitFor((e) => e.t === 'typing');

    // Minute 2 starts → charged again.
    advance(60);
    await sweep();
    const cur = await request(app).get('/v1/me/consults/current').set(as(user));
    expect(cur.body.consult).toMatchObject({ minutesBilled: 2, chargedPaise: 2 * RATE });

    // The user ends 20 seconds into minute 2: nothing more is charged.
    advance(20);
    const end = await request(app).post(`/v1/me/consults/${id}/end`).set(as(user));
    expect(end.body).toMatchObject({ status: 'ended', endReason: 'user_ended', chargedPaise: 2 * RATE });
    advance(60);
    await sweep();
    expect((await request(app).get('/v1/me/wallet').set(as(user))).body.balancePaise).toBe(20_000 - 2 * RATE);

    // Ledger balances to zero; astrologer sees today's earnings.
    const sum = await prisma.ledgerEntry.aggregate({ where: { consultId: id }, _sum: { amountPaise: true } });
    expect(sum._sum.amountPaise).toBe(0);
    const home = await request(app).get('/v1/provider/home').set(as(astro.token));
    expect(home.body.today).toMatchObject({ earningsPaise: 2400, sessions: 1 });
    expect((await request(app).get('/v1/astrologers')).body.items[0].status).toBe('online');

    // Rating (W3-4): once ended and paid, 1–5 stars and optional text; contact details hidden.
    const rate = (body: object) => request(app).put(`/v1/me/consults/${id}/review`).set(as(user)).send(body);
    expect((await rate({ stars: 6 })).status).toBe(400);
    expect((await rate({ stars: 5, text: 'Very clear guidance. Call 9876543210' })).body).toEqual({
      stars: 5,
      text: 'Very clear guidance. Call •••',
    });
    let profile = (await request(app).get(`/v1/astrologers/${astro.id}`)).body;
    expect(profile).toMatchObject({ rating: 5, ratingCount: 1 });
    expect(profile.reviews[0]).toMatchObject({ stars: 5, text: 'Very clear guidance. Call •••' });
    // Rating again replaces it; the count stays one.
    await rate({ stars: 3 });
    profile = (await request(app).get(`/v1/astrologers/${astro.id}`)).body;
    expect(profile).toMatchObject({ rating: 3, ratingCount: 1 });
    expect((await request(app).get(`/v1/me/consults/${id}`).set(as(user))).body.review).toEqual({
      stars: 3,
      text: null,
    });
    expect((await request(app).get('/v1/provider/home').set(as(astro.token))).body.today.rating).toBe(3);
    // Only the user of that consult.
    expect(
      (await request(app).put(`/v1/me/consults/${id}/review`).set(as(other.accessToken)).send({ stars: 1 })).status,
    ).toBe(404);
  });

  it('a request nobody answers is missed', async () => {
    const astro = await liveAstrologer();
    const { accessToken: user } = await signIn('9876511111');
    await credit(await adminToken(), '9876511111', 20_000);
    const req = await request(app).post('/v1/me/consults').set(as(user)).send({ providerId: astro.id, mode: 'chat' });
    expect(
      (await request(app).put(`/v1/me/consults/${req.body.id}/review`).set(as(user)).send({ stars: 5 })).body.error
        .code,
    ).toBe('CONSULT_NOT_REVIEWABLE');
    advance(31);
    await sweep();
    const c = await request(app).get(`/v1/me/consults/${req.body.id}`).set(as(user));
    expect(c.body).toMatchObject({ status: 'missed', endReason: 'no_answer', chargedPaise: 0 });
    expect((await request(app).post(`/v1/provider/consults/${req.body.id}/accept`).set(as(astro.token))).status).toBe(
      409,
    );
  });

  it('silence never ends it (apps open); the money running out or a lost connection does', async () => {
    const astro = await liveAstrologer();
    const { accessToken: user, user: u } = await signIn('9876511111');
    const admin = await adminToken();
    await credit(admin, '9876511111', RATE * 5);
    const start = async () => {
      const r = await request(app).post('/v1/me/consults').set(as(user)).send({ providerId: astro.id, mode: 'chat' });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      await request(app).post(`/v1/provider/consults/${r.body.id}/accept`).set(as(astro.token));
      return r.body.id as string;
    };

    const id = await start();
    for (let m = 2; m <= 6; m++) {
      advance(60); // nobody writes for five minutes, but both apps stay open (heartbeats)
      await touch({ side: 'user', userId: u.id });
      await touch({ side: 'provider', userId: '', astrologerId: astro.id });
      await sweep();
    }
    const c = await request(app).get(`/v1/me/consults/${id}`).set(as(user));
    expect(c.body).toMatchObject({ status: 'ended', endReason: 'balance', minutesBilled: 5, balancePaise: 0 });

    // History (Chats tab): newest first, with the money and the other side.
    const mine = await request(app).get('/v1/me/consults').set(as(user));
    expect(mine.body.items[0]).toMatchObject({ id, status: 'ended', minutesBilled: 5, amountPaise: 5 * RATE });
    expect(mine.body.items[0].name).toBe('Pt. Mohan Sharma');
    const theirs = await request(app).get('/v1/provider/consults').set(as(astro.token));
    expect(theirs.body.items[0]).toMatchObject({ id, amountPaise: 5 * 1200 });
    // Lost connection: the astrologer's app stops sending heartbeats → the chat ends after the grace window.
    await prisma.adminSession.updateMany({ data: { stepUpAt: clock.now() } }); // a fresh admin code
    await credit(admin, '9876511111', RATE * 5);
    const id2 = await start();
    advance(60);
    await touch({ side: 'user', userId: u.id });
    await sweep();
    advance(70); // 130 s without the astrologer's app
    await touch({ side: 'user', userId: u.id });
    await sweep();
    const c2 = await request(app).get(`/v1/me/consults/${id2}`).set(as(user));
    expect(c2.body).toMatchObject({ status: 'ended', endReason: 'disconnected', minutesBilled: 2 });
  });

  it('keeps the other side out', async () => {
    const astro = await liveAstrologer();
    const { accessToken: user } = await signIn('9876511111');
    await credit(await adminToken(), '9876511111', 20_000);
    const req = await request(app).post('/v1/me/consults').set(as(user)).send({ providerId: astro.id, mode: 'chat' });
    const stranger = await signIn('9876533333');
    expect((await request(app).get(`/v1/me/consults/${req.body.id}`).set(as(stranger.accessToken))).status).toBe(404);
    expect((await request(app).get('/v1/me/consults/not-a-uuid').set(as(user))).status).toBe(404);
    // A user-app token can't accept.
    expect((await request(app).post(`/v1/provider/consults/${req.body.id}/accept`).set(as(user))).status).toBe(403);
    // Sockets need a valid token.
    await expect(socket('nope')).rejects.toThrow();
  });
});
