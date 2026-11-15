import { astrologerPolicy } from '../../config/astrologerPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { load, record, type Actor } from './review.shared';

/** Rate rises above the review threshold (Y4A). */
export async function listRateRequests() {
  const rows = await prisma.astrologerRate.findMany({
    where: { status: 'requested', astrologer: { status: 'approved' } },
    orderBy: { createdAt: 'asc' },
    include: { astrologer: { select: { id: true, displayName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    astrologer: r.astrologer,
    mode: r.mode,
    ratePaise: r.ratePaise,
    at: r.createdAt,
  }));
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
      data: b.approve
        ? { status: 'approved', effectiveFrom, decidedAt: now, note: b.note }
        : { status: 'rejected', decidedAt: now, note: b.note },
    });
    await record(tx, actor, a, b.approve ? 'astrologer.rate_approved' : 'astrologer.rate_rejected', {
      after: { mode: r.mode, ratePaise: r.ratePaise, effectiveFrom: b.approve ? effectiveFrom : null },
      reason: b.note ?? undefined,
    });
  });
  return { ok: true };
}
