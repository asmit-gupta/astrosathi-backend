import type { BirthProfile } from '@prisma/client';
import { usersPolicy } from '../../config/usersPolicy';
import { clock } from '../../lib/clock';
import { fromDbDate, toDbDate, todayInIndia, yearsBetween } from '../../lib/dates';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { hasActiveConsultSession } from '../sessions/guard';
import type { CreateBirthProfile, UpdateBirthProfile } from './users.schemas';

export function birthProfileView(p: BirthProfile) {
  return {
    id: p.id,
    isSelf: p.isSelf,
    label: p.label,
    name: p.name,
    gender: p.gender,
    dob: fromDbDate(p.dob),
    tob: p.tob,
    tobAccuracy: p.tobAccuracy,
    place: { id: p.placeId, label: p.placeText, lat: p.lat.toNumber(), lng: p.lng.toNumber(), tzId: p.tzId },
    maritalStatus: p.maritalStatus,
    occupation: p.occupation,
    updatedAt: p.updatedAt,
  };
}

function checkDob(dob: string) {
  const today = todayInIndia();
  if (dob > today) throw badRequest('DOB_IN_FUTURE', 'Date of birth cannot be in the future.');
  if (Number(dob.slice(0, 4)) < usersPolicy.earliestBirthYear) {
    throw badRequest('DOB_TOO_EARLY', 'Please check the year of birth.');
  }
  // 18+ app: profiles for minors are blocked (wireframe W6 note 4, DPDP parental-consent duties).
  if (yearsBetween(dob, today) < usersPolicy.minAgeYears) {
    throw badRequest('PROFILE_UNDER_18', 'Profiles can only be added for people aged 18 or over.');
  }
}

function checkTob(tob: string | null, tobAccuracy: string) {
  if ((tobAccuracy === 'exact') !== (tob !== null)) {
    throw badRequest('VALIDATION_FAILED', 'Some fields are missing or invalid', {
      fields: [{ path: 'tob', message: 'tob is required when tobAccuracy is exact, and must be null otherwise' }],
    });
  }
}

async function resolvePlace(placeId: number) {
  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) throw badRequest('PLACE_NOT_FOUND', 'Pick the birth place from the list.');
  return {
    placeId: place.id,
    placeText: place.state ? `${place.name}, ${place.state}` : place.name,
    lat: place.lat,
    lng: place.lng,
    tzId: place.tzId,
  };
}

async function assertNoActiveSession(userId: string) {
  if (await hasActiveConsultSession(userId)) {
    throw new AppError(409, 'SESSION_IN_PROGRESS', 'Birth details can be changed after your session ends.');
  }
}

async function getOwned(userId: string, id: string) {
  const profile = await prisma.birthProfile.findFirst({ where: { id, userId } });
  if (!profile) throw notFound('BIRTH_PROFILE_NOT_FOUND', 'Profile not found');
  return profile;
}

export async function list(userId: string) {
  const rows = await prisma.birthProfile.findMany({
    where: { userId },
    orderBy: [{ isSelf: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(birthProfileView);
}

export async function get(userId: string, id: string) {
  return birthProfileView(await getOwned(userId, id));
}

export async function create(userId: string, input: CreateBirthProfile) {
  checkDob(input.dob);
  checkTob(input.tob, input.tobAccuracy);
  const place = await resolvePlace(input.placeId);
  const now = clock.now();

  return prisma.$transaction(async (tx) => {
    // Serialise per user so the count and "one Self" checks can't race.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'birth_profiles:' + userId}))`;
    const count = await tx.birthProfile.count({ where: { userId } });
    if (count >= usersPolicy.maxBirthProfiles) {
      throw new AppError(409, 'BIRTH_PROFILE_LIMIT', `You can save up to ${usersPolicy.maxBirthProfiles} profiles.`);
    }
    if (input.isSelf && (await tx.birthProfile.count({ where: { userId, isSelf: true } })) > 0) {
      throw new AppError(409, 'SELF_PROFILE_EXISTS', 'You already have a profile for yourself.');
    }
    const row = await tx.birthProfile.create({
      data: {
        userId,
        isSelf: input.isSelf,
        label: input.label,
        name: input.name,
        gender: input.gender,
        dob: toDbDate(input.dob),
        tob: input.tob,
        tobAccuracy: input.tobAccuracy,
        maritalStatus: input.maritalStatus,
        occupation: input.occupation,
        ...place,
        createdAt: now,
      },
    });
    return birthProfileView(row);
  });
}

export async function update(userId: string, id: string, input: UpdateBirthProfile) {
  await assertNoActiveSession(userId);
  const current = await getOwned(userId, id);

  if (input.dob !== undefined) checkDob(input.dob);
  if (input.tob !== undefined || input.tobAccuracy !== undefined) {
    checkTob(input.tob !== undefined ? input.tob : current.tob, input.tobAccuracy ?? current.tobAccuracy);
  }
  const place = input.placeId !== undefined ? await resolvePlace(input.placeId) : {};
  const { placeId: _ignored, dob, ...rest } = input;

  const row = await prisma.birthProfile.update({
    where: { id: current.id },
    data: { ...rest, ...(dob !== undefined ? { dob: toDbDate(dob) } : {}), ...place },
  });
  return birthProfileView(row);
}

export async function remove(userId: string, id: string) {
  await assertNoActiveSession(userId);
  const current = await getOwned(userId, id);
  await prisma.birthProfile.delete({ where: { id: current.id } });
}
