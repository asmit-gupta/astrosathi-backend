import type { Astrologer, AstrologerStatus, Prisma } from '@prisma/client';
import { astrologerPolicy } from '../../config/astrologerPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { decryptPii } from '../../lib/crypto';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { decryptPhone, maskPhone } from '../../lib/phone';
import { prisma } from '../../lib/prisma';
import * as audit from '../audit/audit.service';
import { assertTopicsAndMethods } from './application.service';
import type { RevisionInput } from './astrologers.schemas';
import { assertRateAllowed, MODES } from './rates.service';
import { uploadView, viewLink } from './uploads.service';
import { applicationView } from './views';

export interface Actor {
  adminId: string;
  ip?: string;
  userAgent?: string;
}

const REVIEWABLE: AstrologerStatus[] = ['submitted', 'needs_changes', 'interview_scheduled'];

async function load(id: string): Promise<Astrologer> {
  const a = await prisma.astrologer.findUnique({ where: { id } });
  if (!a) throw notFound('ASTROLOGER_NOT_FOUND', 'Astrologer not found');
  return a;
}

const record = (db: Prisma.TransactionClient | typeof prisma, actor: Actor, a: Astrologer, action: string, extra: Partial<audit.AuditEntry> = {}) =>
  audit.record(db, {
    actorType: 'admin',
    actorId: actor.adminId,
    action,
    entityType: 'astrologer',
    entityId: a.id,
    ip: actor.ip,
    userAgent: actor.userAgent,
    ...extra,
  });

const event = (db: Prisma.TransactionClient, a: Astrologer, type: string, note?: string | null) =>
  db.astrologerEvent.create({ data: { astrologerId: a.id, type, note: note ?? null, actor: 'admin', createdAt: clock.now() } });

/** The Y2 queue: oldest first, with what's waiting on whom. */
export async function list(q: { status?: AstrologerStatus; q?: string; limit: number; offset: number }) {
  const where: Prisma.AstrologerWhereInput = {
    ...(q.status ? { status: q.status } : { status: { not: 'draft' } }),
    ...(q.q ? { OR: [{ displayName: { contains: q.q, mode: 'insensitive' } }, { legalName: { contains: q.q, mode: 'insensitive' } }] } : {}),
  };
  const [rows, total, counts] = await Promise.all([
    prisma.astrologer.findMany({
      where,
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      take: q.limit,
      skip: q.offset,
      include: { place: { select: { name: true, state: true } }, fixes: { where: { resolvedAt: null }, select: { id: true } } },
    }),
    prisma.astrologer.count({ where }),
    prisma.astrologer.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    items: rows.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      legalName: a.legalName,
      city: a.place?.name ?? null,
      primaryCategory: a.primaryCategory,
      status: a.status,
      submittedAt: a.submittedAt,
      openFixes: a.fixes.length,
      interviewAt: a.interviewAt,
      listed: a.listed,
    })),
    total,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
}

/** The whole application on one pane (Y2 note 2), with view links for every document. */
export async function detail(id: string) {
  const a = await load(id);
  const base = await applicationView(a);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: a.userId }, select: { phoneEnc: true, createdAt: true } });
  const ids = [a.photoUploadId, a.panUploadId, a.idFrontUploadId, a.idBackUploadId, a.proofUploadId, a.introVideoUploadId].filter(
    (x): x is string => !!x,
  );
  const uploads = await prisma.upload.findMany({ where: { id: { in: ids } } });
  const documents = await Promise.all(
    uploads.map(async (u) => ({ ...uploadView(u), url: await viewLink(u.storageKey) })),
  );
  const [pendingRevision, consents] = await Promise.all([
    prisma.profileRevision.findFirst({ where: { astrologerId: a.id, status: 'pending' } }),
    prisma.consent.findMany({
      where: { userId: a.userId, docType: { in: ['provider_conduct', 'provider_terms'] } },
      select: { docType: true, docVersion: true, grantedAt: true },
    }),
  ]);
  return {
    ...base,
    phone: maskPhone(decryptPhone(user.phoneEnc)),
    accountCreatedAt: user.createdAt,
    submittedAt: a.submittedAt,
    approvedAt: a.approvedAt,
    listed: a.listed,
    suspendReason: a.suspendReason,
    documentFiles: documents,
    agreements: consents,
    pendingRevision: pendingRevision ? { id: pendingRevision.id, changes: pendingRevision.changes, at: pendingRevision.createdAt } : null,
  };
}

/** Full PAN and bank account. Needs a fresh authenticator code (route) and is itself audited. */
export async function revealKyc(id: string, actor: Actor) {
  const a = await load(id);
  const kyc = await prisma.astrologerKyc.findUnique({ where: { astrologerId: a.id } });
  if (!kyc) throw notFound('KYC_NOT_FOUND', 'No bank details yet.');
  await record(prisma, actor, a, 'astrologer.kyc_revealed');
  return { pan: decryptPii(kyc.panEnc), bankAccount: decryptPii(kyc.bankAccountEnc), ifsc: kyc.ifsc, accountHolder: kyc.accountHolder };
}

const REQUIRED_DOCS = (a: Astrologer) =>
  [a.panUploadId, a.idFrontUploadId, a.idBackUploadId, a.introVideoUploadId, a.photoUploadId].filter((x): x is string => !!x);

/** Verify or reject one document. When every required one is verified, the timeline shows "Documents checked". */
export async function reviewDocument(id: string, uploadId: string, b: { status: 'verified' | 'rejected'; note: string | null }, actor: Actor) {
  const a = await load(id);
  const all = [...REQUIRED_DOCS(a), a.proofUploadId].filter(Boolean);
  if (!all.includes(uploadId)) throw notFound('DOCUMENT_NOT_FOUND', 'That document is not part of this application.');
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    const before = await tx.upload.findUniqueOrThrow({ where: { id: uploadId } });
    await tx.upload.update({ where: { id: uploadId }, data: { review: b.status, reviewNote: b.note, reviewedAt: now } });
    await record(tx, actor, a, 'astrologer.document_reviewed', {
      before: { uploadId, purpose: before.purpose, review: before.review },
      after: { uploadId, purpose: before.purpose, review: b.status, note: b.note },
    });
    const required = await tx.upload.findMany({ where: { id: { in: REQUIRED_DOCS(a) } }, select: { review: true } });
    const allVerified = required.length > 0 && required.every((r) => r.review === 'verified');
    const already = await tx.astrologerEvent.findFirst({ where: { astrologerId: a.id, type: 'documents_checked' } });
    if (allVerified && !already) await event(tx, a, 'documents_checked');
  });
  return detail(id);
}

/** "One thing to fix" (X1-4): specific requests; the application goes back to the astrologer. */
export async function requestFixes(id: string, items: { field: string; message: string }[], actor: Actor) {
  const a = await load(id);
  if (!REVIEWABLE.includes(a.status)) throw new AppError(409, 'NOT_IN_REVIEW', 'This application is not waiting for review.');
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    for (const f of items) await tx.applicationFix.create({ data: { astrologerId: a.id, field: f.field, message: f.message, createdAt: now } });
    await tx.astrologer.update({ where: { id: a.id }, data: { status: 'needs_changes', updatedAt: now } });
    await event(tx, a, 'fix_requested', items.map((i) => i.message).join(' · '));
    await record(tx, actor, a, 'astrologer.fixes_requested', { before: { status: a.status }, after: { status: 'needs_changes', items } });
  });
  return detail(id);
}

export async function scheduleInterview(id: string, b: { at: Date; link: string }, actor: Actor) {
  const a = await load(id);
  if (!REVIEWABLE.includes(a.status)) throw new AppError(409, 'NOT_IN_REVIEW', 'This application is not waiting for review.');
  if (b.at <= clock.now()) throw badRequest('INTERVIEW_IN_PAST', 'Pick a time in the future.');
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    await tx.astrologer.update({ where: { id: a.id }, data: { status: 'interview_scheduled', interviewAt: b.at, interviewLink: b.link, updatedAt: now } });
    await event(tx, a, 'interview_scheduled', b.at.toISOString());
    await record(tx, actor, a, 'astrologer.interview_scheduled', { before: { status: a.status }, after: { status: 'interview_scheduled', at: b.at } });
  });
  return detail(id);
}

/**
 * Approve (Y2): confirms topics, grants capabilities and sets the rates. Refused unless the identity
 * checks are ticked and every required document is verified. Lists the astrologer and starts the rate-cap clock.
 */
export async function approve(
  id: string,
  b: {
    primaryCategory: string;
    secondaryCategories: string[];
    capabilities: string[];
    rates: Partial<Record<'chat' | 'voice' | 'video', number>>;
    note?: string;
  },
  actor: Actor,
) {
  const a = await load(id);
  if (!REVIEWABLE.includes(a.status)) throw new AppError(409, 'NOT_IN_REVIEW', 'This application is not waiting for review.');
  const required = await prisma.upload.findMany({ where: { id: { in: REQUIRED_DOCS(a) } }, select: { review: true, purpose: true } });
  const unverified = required.filter((r) => r.review !== 'verified').map((r) => r.purpose);
  if (unverified.length || required.length === 0) {
    throw new AppError(409, 'DOCUMENTS_NOT_VERIFIED', 'Verify every required document first.', { unverified });
  }
  if (b.secondaryCategories.includes(b.primaryCategory)) throw badRequest('VALIDATION_FAILED', 'Primary topic repeated as secondary.');
  const consultModes = MODES.filter((m) => b.capabilities.includes(`consult_${m}`));
  if (consultModes.length === 0) throw badRequest('NO_CONSULT_MODE', 'Grant at least one of chat, voice or video.');
  for (const m of consultModes) {
    const rate = b.rates[m];
    if (rate === undefined) throw badRequest('RATE_MISSING', `Set the ${m} rate.`, { mode: m });
    await assertRateAllowed({ approvedAt: null }, m, rate);
  }

  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    await assertTopicsAndMethods(tx, [b.primaryCategory, ...b.secondaryCategories]);
    await tx.astrologerRate.updateMany({ where: { astrologerId: a.id, status: 'requested' }, data: { status: 'cancelled', decidedAt: now } });
    for (const m of consultModes) {
      await tx.astrologerRate.create({
        data: { astrologerId: a.id, mode: m, ratePaise: b.rates[m]!, status: 'approved', effectiveFrom: now, createdAt: now, decidedAt: now },
      });
    }
    await tx.astrologer.update({
      where: { id: a.id },
      data: {
        status: 'approved',
        approvedAt: a.approvedAt ?? now,
        listed: true,
        primaryCategory: b.primaryCategory,
        secondaryCategories: [...new Set(b.secondaryCategories)],
        capabilities: [...new Set(b.capabilities)],
        rejectReason: null,
        updatedAt: now,
      },
    });
    await tx.astrologerAvailability.upsert({
      where: { astrologerId: a.id },
      update: { updatedAt: now },
      create: { astrologerId: a.id, updatedAt: now },
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: a.userId }, select: { roles: true } });
    if (!user.roles.includes('astrologer')) {
      await tx.user.update({ where: { id: a.userId }, data: { roles: [...user.roles, 'astrologer'] } });
    }
    await event(tx, a, 'approved', b.note);
    await record(tx, actor, a, 'astrologer.approved', {
      before: { status: a.status, capabilities: a.capabilities },
      after: { status: 'approved', capabilities: b.capabilities, rates: b.rates, primaryCategory: b.primaryCategory },
      reason: b.note,
    });
  });
  return detail(id);
}

/** Reject with a reason they will see, and when they may apply again (X1-4 note 4: no silent rejections). */
export async function reject(id: string, b: { reason: string; reapplyAfterDays?: number }, actor: Actor) {
  const a = await load(id);
  if (!REVIEWABLE.includes(a.status)) throw new AppError(409, 'NOT_IN_REVIEW', 'This application is not waiting for review.');
  const now = clock.now();
  const reapplyAfter = addSeconds(now, (b.reapplyAfterDays ?? astrologerPolicy.rejectReapplyDays) * 86_400);
  await prisma.$transaction(async (tx) => {
    await tx.astrologer.update({ where: { id: a.id }, data: { status: 'rejected', rejectReason: b.reason, reapplyAfter, updatedAt: now } });
    await event(tx, a, 'rejected', b.reason);
    await record(tx, actor, a, 'astrologer.rejected', { before: { status: a.status }, after: { status: 'rejected', reapplyAfter }, reason: b.reason });
  });
  return detail(id);
}

/** Suspend: unlisted and offline at once. Reinstate puts them back. */
export async function suspend(id: string, reason: string, actor: Actor) {
  const a = await load(id);
  if (a.status !== 'approved') throw new AppError(409, 'NOT_APPROVED', 'Only an approved astrologer can be suspended.');
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    await tx.astrologer.update({ where: { id: a.id }, data: { status: 'suspended', listed: false, suspendReason: reason, updatedAt: now } });
    await tx.astrologerAvailability.updateMany({ where: { astrologerId: a.id }, data: { chat: false, voice: false, video: false, updatedAt: now } });
    await event(tx, a, 'suspended', reason);
    await record(tx, actor, a, 'astrologer.suspended', { before: { status: a.status }, after: { status: 'suspended' }, reason });
  });
  return detail(id);
}

export async function reinstate(id: string, reason: string, actor: Actor) {
  const a = await load(id);
  if (a.status !== 'suspended') throw new AppError(409, 'NOT_SUSPENDED', 'This astrologer is not suspended.');
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    await tx.astrologer.update({ where: { id: a.id }, data: { status: 'approved', listed: true, suspendReason: null, updatedAt: now } });
    await event(tx, a, 'reinstated', reason);
    await record(tx, actor, a, 'astrologer.reinstated', { before: { status: a.status }, after: { status: 'approved' }, reason });
  });
  return detail(id);
}

/** Profile edits waiting for review (X4-2). */
export async function listRevisions() {
  const rows = await prisma.profileRevision.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { astrologer: { select: { id: true, displayName: true, bio: true, languages: true, methods: true } } },
  });
  return rows.map((r) => ({ id: r.id, astrologer: r.astrologer, changes: r.changes, at: r.createdAt }));
}

export async function decideRevision(revisionId: string, b: { approve: boolean; note: string | null }, actor: Actor) {
  const r = await prisma.profileRevision.findUnique({ where: { id: revisionId } });
  if (!r || r.status !== 'pending') throw notFound('REVISION_NOT_FOUND', 'No pending change with that id.');
  const a = await load(r.astrologerId);
  const changes = r.changes as RevisionInput;
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    if (b.approve) {
      await tx.astrologer.update({
        where: { id: a.id },
        data: {
          ...(changes.displayName ? { displayName: changes.displayName } : {}),
          ...(changes.bio ? { bio: changes.bio } : {}),
          ...(changes.photoUploadId ? { photoUploadId: changes.photoUploadId } : {}),
          ...(changes.languages ? { languages: changes.languages } : {}),
          ...(changes.methods ? { methods: changes.methods } : {}),
          updatedAt: now,
        },
      });
    }
    await tx.profileRevision.update({ where: { id: r.id }, data: { status: b.approve ? 'approved' : 'rejected', note: b.note, decidedAt: now } });
    await record(tx, actor, a, b.approve ? 'astrologer.revision_approved' : 'astrologer.revision_rejected', {
      before: { displayName: a.displayName, bio: a.bio, languages: a.languages, methods: a.methods },
      after: changes,
      reason: b.note ?? undefined,
    });
  });
  return { ok: true };
}

/** Rate rises above the review threshold (Y4A). */
export async function listRateRequests() {
  const rows = await prisma.astrologerRate.findMany({
    where: { status: 'requested', astrologer: { status: 'approved' } },
    orderBy: { createdAt: 'asc' },
    include: { astrologer: { select: { id: true, displayName: true } } },
  });
  return rows.map((r) => ({ id: r.id, astrologer: r.astrologer, mode: r.mode, ratePaise: r.ratePaise, at: r.createdAt }));
}

/** An approved rise still waits 24 hours, so repeat users never see an overnight jump. */
export async function decideRate(rateId: string, b: { approve: boolean; note: string | null }, actor: Actor) {
  const r = await prisma.astrologerRate.findUnique({ where: { id: rateId } });
  if (!r || r.status !== 'requested') throw notFound('RATE_REQUEST_NOT_FOUND', 'No pending rate request with that id.');
  const a = await load(r.astrologerId);
  const now = clock.now();
  const effectiveFrom = addSeconds(now, astrologerPolicy.rateChangeDelayHours * 3600);
  await prisma.$transaction(async (tx) => {
    await tx.astrologerRate.update({
      where: { id: r.id },
      data: b.approve ? { status: 'approved', effectiveFrom, decidedAt: now, note: b.note } : { status: 'rejected', decidedAt: now, note: b.note },
    });
    await record(tx, actor, a, b.approve ? 'astrologer.rate_approved' : 'astrologer.rate_rejected', {
      after: { mode: r.mode, ratePaise: r.ratePaise, effectiveFrom: b.approve ? effectiveFrom : null },
      reason: b.note ?? undefined,
    });
  });
  return { ok: true };
}
