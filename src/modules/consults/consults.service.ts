import type { Consult, ConsultMode, ConsultStatus, Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';
import { consultPolicy } from '../../config/consultPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { currentRates } from '../astrologers/rates.service';
import { viewLink } from '../astrologers/uploads.service';
import { onlineModes } from '../astrologers/views';
import * as settings from '../settings/settings.service';
import { birthProfileView } from '../users/birthProfiles.service';
import { astrologerKey, publish, userKey } from './bus';
import { maskContacts } from './mask';
import { balance, chargeMinute } from './wallet.service';

/** Who is acting: the user app, or the astrologer app for one astrologer. */
/** Wire name for the astrologer side is 'provider', matching the /v1/provider app routes. */
export type Party = { side: 'user'; userId: string } | { side: 'provider'; userId: string; astrologerId: string };

const OPEN: ConsultStatus[] = ['requested', 'active'];
const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new AppError(409, code, message, details);

const partyWhere = (p: Party): Prisma.ConsultWhereInput =>
  p.side === 'user' ? { userId: p.userId } : { astrologerId: p.astrologerId };
const keysOf = (c: Pick<Consult, 'userId' | 'astrologerId'>) => [userKey(c.userId), astrologerKey(c.astrologerId)];
const otherKey = (p: Party, c: Pick<Consult, 'userId' | 'astrologerId'>) =>
  p.side === 'user' ? astrologerKey(c.astrologerId) : userKey(c.userId);

/** The astrologer behind an astrologer-app session. Only approved astrologers take consults. */
export async function astrologerParty(userId: string): Promise<Party> {
  const a = await prisma.astrologer.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!a || a.status !== 'approved') throw new AppError(403, 'NOT_APPROVED_YET', 'Your profile is not live.');
  return { side: 'provider', userId, astrologerId: a.id };
}

async function own(p: Party, id: string): Promise<Consult> {
  const c = await prisma.consult.findFirst({ where: { id, ...partyWhere(p) } });
  if (!c) throw notFound('CONSULT_NOT_FOUND', 'No such consult.');
  return c;
}

// ---------- Views ----------

async function views(c: Consult) {
  const [timeout, a, u, bal] = await Promise.all([
    settings.get('request_timeout_seconds'),
    prisma.astrologer.findUniqueOrThrow({
      where: { id: c.astrologerId },
      select: { displayName: true, photoUploadId: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: c.userId }, select: { name: true } }),
    balance(prisma, c.userId),
  ]);
  const photo = a.photoUploadId
    ? await viewLink((await prisma.upload.findUnique({ where: { id: a.photoUploadId } }))?.storageKey)
    : null;
  const share = c.chargedPaise - Math.round((c.chargedPaise * c.platformSharePct) / 100);
  const common = {
    id: c.id,
    mode: c.mode,
    status: c.status,
    ratePaise: c.ratePaise,
    requestedAt: c.requestedAt,
    expiresAt: c.status === 'requested' ? addSeconds(c.requestedAt, timeout) : null,
    acceptedAt: c.acceptedAt,
    endedAt: c.endedAt,
    endReason: c.endReason,
    minutesBilled: c.minutesBilled,
    paidUntil: c.nextChargeAt,
    lastSeq: c.lastSeq,
    readSeq: { user: c.userReadSeq, provider: c.astrologerReadSeq },
  };
  return {
    user: {
      ...common,
      chargedPaise: c.chargedPaise,
      balancePaise: bal,
      provider: { id: c.astrologerId, displayName: a.displayName, photoUrl: photo },
    },
    provider: {
      ...common,
      earnedPaise: share,
      client: { name: u.name, birth: c.birth },
    },
  };
}

export async function viewFor(p: Party, c: Consult) {
  return (await views(c))[p.side];
}

/** Sends both sides their own view of the consult. */
async function announce(c: Consult): Promise<void> {
  const v = await views(c);
  await Promise.all([
    publish([userKey(c.userId)], { t: 'consult', consult: v.user }),
    publish([astrologerKey(c.astrologerId)], { t: 'consult', consult: v.provider }),
  ]);
}

// ---------- Lifecycle ----------

async function birthFor(userId: string, birthProfileId?: string) {
  const p = await prisma.birthProfile.findFirst({
    where: birthProfileId ? { id: birthProfileId, userId } : { userId, isSelf: true },
  });
  if (birthProfileId && !p) throw notFound('BIRTH_PROFILE_NOT_FOUND', 'No such birth profile.');
  if (!p) return null;
  const v = birthProfileView(p);
  return { name: v.name, gender: v.gender, dob: v.dob, tob: v.tob, tobAccuracy: v.tobAccuracy, place: v.place.label };
}

/** W3: the user asks; the astrologer has `request_timeout_seconds` to accept. */
export async function request(userId: string, b: { astrologerId: string; mode: ConsultMode; birthProfileId?: string }) {
  if (b.mode !== 'chat') throw badRequest('MODE_NOT_AVAILABLE', 'Only chat is available for now.');
  const now = clock.now();
  const [minMinutes, sharePct, birth] = await Promise.all([
    settings.get('min_balance_minutes'),
    settings.get('platform_share_pct'),
    birthFor(userId, b.birthProfileId),
  ]);
  const consult = await prisma.$transaction(async (tx) => {
    // Always astrologer first, then user, so two locks never wait on each other in reverse.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'consult:a:' + b.astrologerId}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'consult:u:' + userId}))`;
    if (await tx.consult.findFirst({ where: { userId, status: { in: OPEN } }, select: { id: true } })) {
      throw conflict('CONSULT_IN_PROGRESS', 'You already have a consult going.');
    }
    const a = await tx.astrologer.findFirst({
      where: { id: b.astrologerId, status: 'approved', listed: true },
      include: { availability: true, scheduleSlots: true },
    });
    if (!a) throw notFound('PROVIDER_NOT_FOUND', 'Not available.');
    if (a.userId === userId) throw badRequest('OWN_PROFILE', 'You cannot consult yourself.');
    const rates = await currentRates(tx, a.id);
    const rate = rates[b.mode];
    if (rate === undefined || !onlineModes(a, a.availability, rates, a.scheduleSlots)[b.mode]) {
      throw conflict('PROVIDER_OFFLINE', 'Not online right now.');
    }
    if (await tx.consult.findFirst({ where: { astrologerId: a.id, status: { in: OPEN } }, select: { id: true } })) {
      throw conflict('PROVIDER_BUSY', 'In another consult right now.');
    }
    const bal = await balance(tx, userId);
    if (bal < rate * minMinutes) {
      throw new AppError(402, 'LOW_BALANCE', 'Add money to start.', {
        needPaise: rate * minMinutes,
        balancePaise: bal,
      });
    }
    return tx.consult.create({
      data: {
        userId,
        astrologerId: a.id,
        mode: b.mode,
        status: 'requested',
        ratePaise: rate,
        platformSharePct: sharePct,
        birth: birth ?? P.DbNull,
        requestedAt: now,
      },
    });
  });
  await announce(consult);
  return (await views(consult)).user;
}

/** X2: the astrologer accepts. The first minute is charged at once (every started minute is billed). */
export async function accept(p: Party, id: string) {
  const c = await own(p, id);
  const now = clock.now();
  const timeout = await settings.get('request_timeout_seconds');
  if (c.status !== 'requested' || addSeconds(c.requestedAt, timeout) <= now) {
    throw conflict('CONSULT_NOT_PENDING', 'This request is no longer waiting.');
  }
  const started = await prisma.$transaction(async (tx) => {
    const moved = await tx.consult.updateMany({
      where: { id, status: 'requested' },
      data: {
        status: 'active',
        acceptedAt: now,
        minutesBilled: 1,
        chargedPaise: c.ratePaise,
        nextChargeAt: addSeconds(now, consultPolicy.billingSeconds),
        userSeenAt: now,
        astrologerSeenAt: now,
      },
    });
    if (moved.count === 0) throw conflict('CONSULT_NOT_PENDING', 'This request is no longer waiting.');
    return chargeMinute(tx, c, 1, now);
  });
  if (!started) {
    // The balance dropped below one minute; nothing was charged.
    await prisma.consult.update({
      where: { id },
      data: {
        status: 'cancelled',
        endedAt: now,
        endReason: 'balance',
        nextChargeAt: null,
        minutesBilled: 0,
        chargedPaise: 0,
      },
    });
  }
  const after = await prisma.consult.findUniqueOrThrow({ where: { id } });
  await announce(after);
  return (await views(after)).provider;
}

export async function decline(p: Party, id: string) {
  await own(p, id);
  const now = clock.now();
  const r = await prisma.consult.updateMany({
    where: { id, status: 'requested' },
    data: { status: 'declined', endedAt: now, endReason: 'declined' },
  });
  if (r.count === 0) throw conflict('CONSULT_NOT_PENDING', 'This request is no longer waiting.');
  const c = await prisma.consult.findUniqueOrThrow({ where: { id } });
  await announce(c);
  return viewFor(p, c);
}

/** Either side ends. A waiting request is cancelled; nothing more is charged (the minute was paid upfront). */
export async function end(p: Party, id: string) {
  const c = await own(p, id);
  const now = clock.now();
  if (c.status === 'requested' && p.side === 'user') {
    await prisma.consult.updateMany({
      where: { id, status: 'requested' },
      data: { status: 'cancelled', endedAt: now, endReason: 'user_cancelled' },
    });
  } else if (c.status === 'active') {
    await finish(id, p.side === 'user' ? 'user_ended' : 'astrologer_ended', now);
  } else if (c.status === 'requested') {
    return decline(p, id);
  }
  const after = await prisma.consult.findUniqueOrThrow({ where: { id } });
  await announce(after);
  return viewFor(p, after);
}

async function finish(id: string, reason: string, now: Date): Promise<boolean> {
  const r = await prisma.consult.updateMany({
    where: { id, status: 'active' },
    data: { status: 'ended', endedAt: now, endReason: reason, nextChargeAt: null },
  });
  return r.count > 0;
}

/** The open consult (waiting or active), so an app can return to it after a restart. */
export async function current(p: Party) {
  const c = await prisma.consult.findFirst({
    where: { ...partyWhere(p), status: { in: OPEN } },
    orderBy: { requestedAt: 'desc' },
  });
  return c ? viewFor(p, c) : null;
}

export async function get(p: Party, id: string) {
  return viewFor(p, await own(p, id));
}

/** Spec §8.20: birth details and account deletion wait while a consult is open. */
export async function hasOpenConsult(userId: string): Promise<boolean> {
  return !!(await prisma.consult.findFirst({ where: { userId, status: { in: OPEN } }, select: { id: true } }));
}

// ---------- Billing and timeouts ----------

/**
 * Runs every couple of seconds on every server. Each step is a conditional update, so two servers
 * running it at once can't double-charge or double-end.
 */
export async function sweep(): Promise<void> {
  const now = clock.now();
  const [timeout, reconnect] = await Promise.all([
    settings.get('request_timeout_seconds'),
    settings.get('reconnect_window_seconds'),
  ]);

  const expired = await prisma.consult.findMany({
    where: { status: 'requested', requestedAt: { lte: addSeconds(now, -timeout) } },
  });
  for (const c of expired) {
    const r = await prisma.consult.updateMany({
      where: { id: c.id, status: 'requested' },
      data: { status: 'missed', endedAt: now, endReason: 'no_answer' },
    });
    if (r.count) await announce({ ...c, status: 'missed', endedAt: now, endReason: 'no_answer' });
  }

  const due = await prisma.consult.findMany({ where: { status: 'active', nextChargeAt: { lte: now } } });
  for (const c of due) {
    try {
      await nextMinute(c, now, addSeconds(now, -reconnect));
    } catch (err) {
      logger.error({ err, consultId: c.id }, 'Consult billing step failed');
    }
  }
}

async function nextMinute(c: Consult, now: Date, staleBefore: Date): Promise<void> {
  const gone = (c.userSeenAt && c.userSeenAt < staleBefore) || (c.astrologerSeenAt && c.astrologerSeenAt < staleBefore);
  if (gone) {
    if (await finish(c.id, 'disconnected', now))
      await announce(await prisma.consult.findUniqueOrThrow({ where: { id: c.id } }));
    return;
  }
  const minute = c.minutesBilled + 1;
  const paid = await prisma
    .$transaction(async (tx) => {
      const moved = await tx.consult.updateMany({
        where: { id: c.id, status: 'active', nextChargeAt: c.nextChargeAt },
        data: {
          minutesBilled: minute,
          chargedPaise: { increment: c.ratePaise },
          nextChargeAt: addSeconds(c.nextChargeAt ?? now, consultPolicy.billingSeconds),
        },
      });
      if (moved.count === 0) return 'skipped' as const; // another server did it
      if (!(await chargeMinute(tx, c, minute, now))) throw new NoBalance();
      return 'charged' as const;
    })
    .catch((err: unknown) => {
      if (err instanceof NoBalance) return 'empty' as const;
      throw err;
    });
  if (paid === 'skipped') return;
  if (paid === 'empty') await finish(c.id, 'balance', now);
  await announce(await prisma.consult.findUniqueOrThrow({ where: { id: c.id } }));
}

class NoBalance extends Error {}

// ---------- Messages ----------

/** Same-statement sequence number and insert: one round trip per message. */
export async function send(p: Party, consultId: string, id: string, body: string) {
  const text = body.trim();
  if (!text) throw badRequest('MESSAGE_EMPTY', 'Type a message.');
  if (text.length > consultPolicy.maxMessageChars) throw badRequest('MESSAGE_TOO_LONG', 'This message is too long.');
  const masked = maskContacts(text);
  const at = clock.now();
  const ts = at.toISOString().replace('Z', '');
  const seen = P.raw(p.side === 'user' ? 'user_seen_at' : 'astrologer_seen_at');
  const mine = p.side === 'user' ? P.sql`user_id = ${p.userId}::uuid` : P.sql`astrologer_id = ${p.astrologerId}::uuid`;
  const rows = await prisma.$queryRaw<{ seq: number; user_id: string; astrologer_id: string }[]>`
    WITH c AS (
      UPDATE consults SET last_seq = last_seq + 1, ${seen} = ${ts}::timestamp
      WHERE id = ${consultId}::uuid AND status = 'active' AND ${mine}
      RETURNING last_seq, user_id, astrologer_id
    )
    INSERT INTO consult_messages (id, consult_id, seq, sender, body, flagged, created_at)
    SELECT ${id}::uuid, ${consultId}::uuid, c.last_seq, ${p.side}::"MessageSender", ${masked.text}, ${masked.flagged}, ${ts}::timestamp
    FROM c
    ON CONFLICT (id) DO NOTHING
    RETURNING seq, (SELECT user_id FROM c)::text AS user_id, (SELECT astrologer_id FROM c)::text AS astrologer_id`;
  const row = rows[0];
  if (!row) {
    // A resend of a message we already have, or the consult isn't active.
    const existing = await prisma.consultMessage.findUnique({ where: { id } });
    if (existing?.consultId === consultId) return messageView(existing);
    const c = await own(p, consultId);
    if (existing) throw badRequest('MESSAGE_ID_TAKEN', 'Use a new message id.');
    throw conflict('CONSULT_NOT_ACTIVE', 'This consult is not active.', { status: c.status });
  }
  const message = { id, seq: row.seq, sender: p.side, body: masked.text, flagged: masked.flagged, createdAt: at };
  await publish(keysOf({ userId: row.user_id, astrologerId: row.astrologer_id }), { t: 'message', consultId, message });
  return message;
}

const messageView = (m: Prisma.ConsultMessageGetPayload<object>) => ({
  id: m.id,
  seq: m.seq,
  sender: m.sender,
  body: m.body,
  flagged: m.flagged,
  createdAt: m.createdAt,
});

export async function messages(p: Party, consultId: string, after: number) {
  await own(p, consultId);
  const items = await prisma.consultMessage.findMany({
    where: { consultId, seq: { gt: after } },
    orderBy: { seq: 'asc' },
    take: consultPolicy.messagesPage,
  });
  return { items: items.map(messageView) };
}

export async function markRead(p: Party, consultId: string, seq: number): Promise<void> {
  const c = await own(p, consultId);
  const upto = Math.min(seq, c.lastSeq);
  await prisma.consult.updateMany({
    where: {
      id: consultId,
      ...(p.side === 'user' ? { userReadSeq: { lt: upto } } : { astrologerReadSeq: { lt: upto } }),
    },
    data: p.side === 'user' ? { userReadSeq: upto } : { astrologerReadSeq: upto },
  });
  await publish([otherKey(p, c)], { t: 'read', consultId, side: p.side, seq: upto });
}

/** Typing is passed on, never stored. */
export async function typing(p: Party, consultId: string): Promise<void> {
  const c = await prisma.consult.findFirst({
    where: { id: consultId, status: 'active', ...partyWhere(p) },
    select: { userId: true, astrologerId: true },
  });
  if (c) await publish([otherKey(p, c)], { t: 'typing', consultId, side: p.side });
}

/** The app is still there (socket connect and heartbeat). Long silence ends the consult in the sweep. */
export async function touch(p: Party): Promise<void> {
  const now = clock.now();
  await prisma.consult.updateMany({
    where: { ...partyWhere(p), status: 'active' },
    data: p.side === 'user' ? { userSeenAt: now } : { astrologerSeenAt: now },
  });
}
