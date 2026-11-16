import { AppError, notFound } from '../../lib/errors';
import { clock } from '../../lib/clock';
import { prisma } from '../../lib/prisma';
import { maskContacts } from './mask';

const MAX_TEXT = 500;

/** Average to one decimal, or null with no reviews. */
export const ratingOf = (a: { ratingSum: number; ratingCount: number }) =>
  a.ratingCount ? Math.round((a.ratingSum / a.ratingCount) * 10) / 10 : null;

/**
 * W3-4: the user rates a paid consult once it has ended (1–5 stars, optional text). Rating again
 * replaces the earlier one. The astrologer's running totals change in the same transaction.
 */
export async function rate(userId: string, consultId: string, b: { stars: number; text?: string }) {
  const c = await prisma.consult.findFirst({ where: { id: consultId, userId } });
  if (!c) throw notFound('CONSULT_NOT_FOUND', 'No such consult.');
  if (c.status !== 'ended' || c.minutesBilled === 0) {
    throw new AppError(409, 'CONSULT_NOT_REVIEWABLE', 'Only a finished, paid consult can be rated.');
  }
  const trimmed = b.text?.trim().slice(0, MAX_TEXT) || null;
  const text = trimmed ? maskContacts(trimmed).text : null;
  const now = clock.now();
  return prisma.$transaction(async (tx) => {
    const before = await tx.consultReview.findUnique({ where: { consultId } });
    const review = await tx.consultReview.upsert({
      where: { consultId },
      update: { stars: b.stars, text, updatedAt: now },
      create: { consultId, userId, astrologerId: c.astrologerId, stars: b.stars, text, createdAt: now, updatedAt: now },
    });
    await tx.astrologer.update({
      where: { id: c.astrologerId },
      data: before
        ? { ratingSum: { increment: b.stars - before.stars } }
        : { ratingSum: { increment: b.stars }, ratingCount: { increment: 1 } },
    });
    return { stars: review.stars, text: review.text };
  });
}

/** Latest reviews for the profile. Only the reviewer's first name is shown. */
export async function latest(astrologerId: string, take = 20) {
  const rows = await prisma.consultReview.findMany({
    where: { astrologerId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({
    stars: r.stars,
    text: r.text,
    name: r.user.name?.trim().split(/\s+/)[0] ?? null,
    at: r.createdAt,
  }));
}
