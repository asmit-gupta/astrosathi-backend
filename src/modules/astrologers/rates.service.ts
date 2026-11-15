import type { Astrologer, ConsultMode, Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as settings from '../settings/settings.service';

export const MODES: ConsultMode[] = ['chat', 'voice', 'video'];
export type RateMap = Partial<Record<ConsultMode, number>>;

type Db = Prisma.TransactionClient | typeof prisma;

/** Rates in force now: the latest approved row per mode whose start time has passed. */
export async function currentRates(db: Db, astrologerId: string): Promise<RateMap> {
  const now = clock.now();
  const rows = await db.astrologerRate.findMany({
    where: { astrologerId, status: 'approved', effectiveFrom: { lte: now } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  const out: RateMap = {};
  for (const r of rows) if (out[r.mode] === undefined) out[r.mode] = r.ratePaise;
  return out;
}

/** Same as currentRates for many astrologers at once (lists). */
export async function currentRatesMany(ids: string[]): Promise<Map<string, RateMap>> {
  const now = clock.now();
  const rows = await prisma.astrologerRate.findMany({
    where: { astrologerId: { in: ids }, status: 'approved', effectiveFrom: { lte: now } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  const out = new Map<string, RateMap>();
  for (const r of rows) {
    const m = out.get(r.astrologerId) ?? {};
    if (m[r.mode] === undefined) m[r.mode] = r.ratePaise;
    out.set(r.astrologerId, m);
  }
  return out;
}

/** The new-astrologer cap (handoff D9) if it applies to this astrologer now; null once the cap period is over. */
export async function rateCap(a: Pick<Astrologer, 'approvedAt'>): Promise<number | null> {
  const [cap, days] = await Promise.all([
    settings.get('new_astrologer_rate_cap_paise'),
    settings.get('new_astrologer_cap_days'),
  ]);
  if (!a.approvedAt) return cap; // not approved yet: the cap applies from day one
  const ends = a.approvedAt.getTime() + days * 86_400_000;
  return clock.now().getTime() < ends ? cap : null;
}

/** Checks one rate against the minimum and the cap. */
export async function assertRateAllowed(a: Pick<Astrologer, 'approvedAt'>, mode: ConsultMode, ratePaise: number) {
  const [min, cap] = await Promise.all([settings.get('rate_min_paise'), rateCap(a)]);
  if (!Number.isInteger(ratePaise) || ratePaise < min) {
    throw badRequest('RATE_TOO_LOW', `The ${mode} rate must be at least ₹${min / 100}/min.`, { mode, minPaise: min });
  }
  if (cap !== null && ratePaise > cap) {
    throw badRequest('RATE_ABOVE_CAP', `New astrologers can charge at most ₹${cap / 100}/min for their first months.`, {
      mode,
      capPaise: cap,
    });
  }
}
