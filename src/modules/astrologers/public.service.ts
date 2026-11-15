import type { ConsultMode, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { currentRatesMany } from './rates.service';
import { publicCard } from './views';

export interface ListQuery {
  category?: string;
  method?: string;
  language?: string;
  mode?: ConsultMode;
  gender?: 'female' | 'male' | 'other';
  online?: boolean;
  /** Only astrologers who host live shows (W2-3 "Live host"). */
  live?: boolean;
  /** Price range in paise per minute, checked against the cheapest mode (or the chosen mode). */
  minRatePaise?: number;
  maxRatePaise?: number;
  sort: 'recommended' | 'price_asc' | 'price_desc' | 'experience';
  limit: number;
  offset: number;
}

const include = { availability: true, place: { select: { name: true, state: true } } } as const;

/**
 * Listed astrologers for the user app (spec §8.6). Ranking (quality gate, preference match) arrives
 * with discovery; until then "recommended" puts online astrologers first, then experience.
 * Filtering and sorting happen in memory: fine at launch scale; move to SQL with ranking.
 */
export async function list(q: ListQuery) {
  const where: Prisma.AstrologerWhereInput = {
    status: 'approved',
    listed: true,
    ...(q.category ? { OR: [{ primaryCategory: q.category }, { secondaryCategories: { has: q.category } }] } : {}),
    ...(q.method ? { methods: { has: q.method } } : {}),
    ...(q.language ? { languages: { has: q.language } } : {}),
    ...(q.gender ? { gender: q.gender } : {}),
    ...(q.mode ? { capabilities: { has: `consult_${q.mode}` } } : {}),
    ...(q.live ? { AND: [{ capabilities: { has: 'host_live' } }] } : {}),
  };
  const rows = await prisma.astrologer.findMany({ where, include });
  const rates = await currentRatesMany(rows.map((r) => r.id));
  const photos = await prisma.upload.findMany({
    where: { id: { in: rows.map((r) => r.photoUploadId).filter((x): x is string => !!x) } },
    select: { id: true, storageKey: true },
  });
  const photoKey = (id: string | null) => photos.find((p) => p.id === id)?.storageKey ?? null;

  let cards = await Promise.all(rows.map((r) => publicCard(r, rates.get(r.id) ?? {}, photoKey(r.photoUploadId))));
  const { mode, minRatePaise, maxRatePaise } = q;
  if (mode) cards = cards.filter((c) => c.modes.includes(mode));
  if (q.online) cards = cards.filter((c) => c.status === 'online');

  const price = (c: (typeof cards)[number]) => (q.mode ? c.rates[q.mode] : c.fromRatePaise) ?? Number.MAX_SAFE_INTEGER;
  // Live min and max for the price slider, before the price filter applies (W2-3 note 1).
  const prices = cards.map(price).filter((p) => p !== Number.MAX_SAFE_INTEGER);
  const priceRange = prices.length ? { minPaise: Math.min(...prices), maxPaise: Math.max(...prices) } : null;
  if (minRatePaise !== undefined) cards = cards.filter((c) => price(c) >= minRatePaise);
  if (maxRatePaise !== undefined) cards = cards.filter((c) => price(c) <= maxRatePaise);
  cards.sort((a, b) => {
    switch (q.sort) {
      case 'price_asc':
        return price(a) - price(b);
      case 'price_desc':
        return price(b) - price(a);
      case 'experience':
        return (b.experienceYears ?? 0) - (a.experienceYears ?? 0);
      default:
        return (
          (a.status === 'online' ? 0 : 1) - (b.status === 'online' ? 0 : 1) ||
          (b.experienceYears ?? 0) - (a.experienceYears ?? 0)
        );
    }
  });
  return { items: cards.slice(q.offset, q.offset + q.limit), total: cards.length, priceRange };
}

/** Profile page (spec §8.7): the card plus about, and a trust panel showing only what's true. */
export async function get(id: string) {
  const a = await prisma.astrologer.findFirst({ where: { id, status: 'approved', listed: true }, include });
  if (!a) return null;
  const rates = (await currentRatesMany([a.id])).get(a.id) ?? {};
  const docIds = [a.photoUploadId, a.panUploadId, a.idFrontUploadId, a.proofUploadId].filter((x): x is string => !!x);
  const docs = await prisma.upload.findMany({
    where: { id: { in: docIds } },
    select: { id: true, storageKey: true, review: true, purpose: true },
  });
  const card = await publicCard(a, rates, docs.find((d) => d.id === a.photoUploadId)?.storageKey ?? null);
  const verified = (purpose: string) => docs.some((d) => d.purpose === purpose && d.review === 'verified');
  const methodTags = await prisma.methodTag.findMany({ where: { slug: { in: a.methods } } });
  return {
    ...card,
    bio: a.bio,
    methodNames: a.methods.map((m) => methodTags.find((t) => t.slug === m) ?? { slug: m, nameEn: m, nameHi: m }),
    trust: {
      identityVerified: verified('pan') && verified('id_front'),
      qualificationChecked: !!a.proofUploadId && verified('experience_proof'),
      passedReview: true,
      memberSince: a.approvedAt,
    },
  };
}
