import type { Astrologer, ConsultMode, Prisma } from '@prisma/client';
import { astrologerPolicy } from '../../config/astrologerPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { AppError, badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as settings from '../settings/settings.service';
import { assertTopicsAndMethods, bioProblems } from './application.service';
import type { RevisionInput } from './astrologers.schemas';
import { assertRateAllowed, currentRates, MODES } from './rates.service';
import { assertUsableUpload } from './uploads.service';
import { onlineModes, statusWord } from './views';

async function approvedAstrologer(userId: string): Promise<Astrologer> {
  const a = await prisma.astrologer.findUnique({ where: { userId } });
  if (!a) throw new AppError(404, 'NOT_AN_ASTROLOGER', 'No astrologer profile for this account.');
  if (a.status === 'suspended') throw new AppError(403, 'ASTROLOGER_SUSPENDED', 'Your profile is on hold.', { reason: a.suspendReason });
  if (a.status !== 'approved') throw new AppError(409, 'NOT_APPROVED_YET', 'Your application has not been approved yet.');
  return a;
}

/** Home (X2-1): availability per mode with the rate, what's pending, and the cap. */
export async function home(userId: string) {
  const a = await approvedAstrologer(userId);
  const [av, rates, pendingRates, pendingRevision] = await Promise.all([
    prisma.astrologerAvailability.findUnique({ where: { astrologerId: a.id } }),
    currentRates(prisma, a.id),
    prisma.astrologerRate.findMany({
      where: { astrologerId: a.id, OR: [{ status: 'requested' }, { status: 'approved', effectiveFrom: { gt: clock.now() } }] },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.profileRevision.findFirst({ where: { astrologerId: a.id, status: 'pending' } }),
  ]);
  const online = onlineModes(a, av, rates);
  return {
    displayName: a.displayName,
    status: statusWord(online),
    modes: MODES.map((m) => ({
      mode: m,
      granted: a.capabilities.includes(`consult_${m}`),
      ratePaise: rates[m] ?? null,
      on: !!av?.[m],
      online: online[m],
    })),
    awayUntil: av?.awayUntil && av.awayUntil > clock.now() ? av.awayUntil : null,
    capabilities: a.capabilities,
    pendingRateChanges: pendingRates.map((r) => ({
      mode: r.mode,
      ratePaise: r.ratePaise,
      status: r.status === 'requested' ? 'in_review' : 'scheduled',
      effectiveFrom: r.effectiveFrom,
    })),
    profileEditInReview: !!pendingRevision,
    // Earnings, sessions and rating arrive with consult sessions (build step 5).
    today: { earningsPaise: 0, sessions: 0, rating: null },
  };
}

/** X2-1: one switch per mode; only granted modes with a rate can go on. "Away for a bit" pauses all. */
export async function setAvailability(userId: string, b: { chat?: boolean; voice?: boolean; video?: boolean; awayMinutes?: number | null }) {
  const a = await approvedAstrologer(userId);
  const rates = await currentRates(prisma, a.id);
  const now = clock.now();
  const data: Prisma.AstrologerAvailabilityUncheckedUpdateInput = { updatedAt: now };
  for (const m of MODES) {
    const want = b[m];
    if (want === undefined) continue;
    if (want && (!a.capabilities.includes(`consult_${m}`) || rates[m] === undefined)) {
      throw new AppError(403, 'MODE_NOT_ENABLED', `${m} consults are not enabled for you.`, { mode: m });
    }
    data[m] = want;
  }
  if (b.awayMinutes !== undefined) data.awayUntil = b.awayMinutes === null ? null : addSeconds(now, b.awayMinutes * 60);
  await prisma.astrologerAvailability.upsert({
    where: { astrologerId: a.id },
    update: data,
    create: { astrologerId: a.id, ...(data as object), updatedAt: now },
  });
  return home(userId);
}

/**
 * Rate change (X4-2, spec §9.10, Y4A): reductions apply at once; small rises after 24 hours so
 * prices don't jump overnight; rises above the review threshold wait for the admin.
 */
export async function requestRateChange(userId: string, mode: ConsultMode, ratePaise: number) {
  const a = await approvedAstrologer(userId);
  if (!a.capabilities.includes(`consult_${mode}`)) throw new AppError(403, 'MODE_NOT_ENABLED', `${mode} consults are not enabled for you.`);
  await assertRateAllowed(a, mode, ratePaise);
  const current = (await currentRates(prisma, a.id))[mode];
  if (current === ratePaise) throw badRequest('RATE_UNCHANGED', 'That is already your rate.');

  const now = clock.now();
  const reviewPct = await settings.get('rate_rise_review_pct');
  const rise = current ? ((ratePaise - current) / current) * 100 : 0;
  const needsReview = current !== undefined && rise > reviewPct;
  const effectiveFrom = current === undefined || ratePaise < current ? now : addSeconds(now, astrologerPolicy.rateChangeDelayHours * 3600);

  await prisma.$transaction(async (tx) => {
    // A new ask replaces any pending or scheduled change for this mode.
    await tx.astrologerRate.updateMany({
      where: { astrologerId: a.id, mode, OR: [{ status: 'requested' }, { status: 'approved', effectiveFrom: { gt: now } }] },
      data: { status: 'cancelled', decidedAt: now },
    });
    await tx.astrologerRate.create({
      data: {
        astrologerId: a.id,
        mode,
        ratePaise,
        status: needsReview ? 'requested' : 'approved',
        effectiveFrom: needsReview ? null : effectiveFrom,
        createdAt: now,
        decidedAt: needsReview ? null : now,
      },
    });
  });
  return { result: needsReview ? 'in_review' : effectiveFrom > now ? 'scheduled' : 'applied', effectiveFrom: needsReview ? null : effectiveFrom, home: await home(userId) };
}

/** Profile edits (X4-2): checked now, applied after the admin approves; the live profile stays meanwhile. */
export async function requestRevision(userId: string, b: RevisionInput) {
  const a = await approvedAstrologer(userId);
  if (await prisma.profileRevision.findFirst({ where: { astrologerId: a.id, status: 'pending' } })) {
    throw new AppError(409, 'REVISION_PENDING', 'Your last change is still being reviewed.');
  }
  await prisma.$transaction(async (tx) => {
    if (b.photoUploadId) await assertUsableUpload(tx, userId, b.photoUploadId, 'photo');
    if (b.methods) await assertTopicsAndMethods(tx, [], b.methods);
  });
  if (b.bio && bioProblems(b.bio).length) {
    throw badRequest('BIO_NOT_ALLOWED', 'Your bio has words we cannot allow (guarantees, cures, contact details or links).', {
      matches: bioProblems(b.bio),
    });
  }
  await prisma.profileRevision.create({ data: { astrologerId: a.id, changes: b, createdAt: clock.now() } });
  return { inReview: true };
}
