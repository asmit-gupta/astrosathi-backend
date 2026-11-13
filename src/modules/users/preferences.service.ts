import type { UserPreference } from '@prisma/client';
import { usersPolicy } from '../../config/usersPolicy';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { PreferencesInput } from './users.schemas';

const view = (p: UserPreference | null) =>
  p && {
    topics: p.topics,
    languages: p.languages,
    modes: p.modes,
    budgetBand: p.budgetBand,
    genderPref: p.genderPref,
    firstTime: p.firstTime,
    showEveryone: p.showEveryone,
    answeredAt: p.answeredAt,
    skippedAt: p.skippedAt,
    updatedAt: p.updatedAt,
  };

export async function get(userId: string) {
  return view(await prisma.userPreference.findUnique({ where: { userId } }));
}

/** Saves the onboarding answers to the account (spec §8.2.1). Replaces any previous answers. */
export async function save(userId: string, input: PreferencesInput) {
  const topics = [...new Set(input.topics)];
  if (topics.length > 0) {
    const known = await prisma.category.findMany({
      where: { slug: { in: topics }, active: true },
      select: { slug: true },
    });
    const unknown = topics.filter((t) => !known.some((k) => k.slug === t));
    if (unknown.length > 0) throw badRequest('UNKNOWN_TOPIC', 'Unknown topic', { topics: unknown });
  }

  const now = clock.now();
  const answered =
    topics.length > 0 ||
    input.languages.length > 0 ||
    input.modes.length > 0 ||
    input.budgetBand !== null ||
    input.genderPref !== null ||
    input.firstTime !== null;

  const data = {
    topics,
    languages: [...new Set(input.languages)],
    modes: [...new Set(input.modes)],
    budgetBand: input.budgetBand,
    genderPref: input.genderPref,
    firstTime: input.firstTime,
    showEveryone: input.showEveryone,
    answeredAt: answered ? now : null,
    skippedAt: input.skipped ? now : null,
    source: input.source,
    consentVersion: usersPolicy.preferencesConsentVersion,
    updatedAt: now,
  };
  const row = await prisma.userPreference.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return view(row);
}

/** The "Show everyone" switch (spec §7.11 rule 7). */
export async function setShowEveryone(userId: string, showEveryone: boolean) {
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  if (!existing) throw notFound('PREFERENCES_NOT_FOUND', 'No saved preferences');
  const row = await prisma.userPreference.update({
    where: { userId },
    data: { showEveryone, updatedAt: clock.now() },
  });
  return view(row);
}

/** Preferences are deletable at any time (spec §7.11 rule 7). */
export async function remove(userId: string) {
  await prisma.userPreference.deleteMany({ where: { userId } });
}
