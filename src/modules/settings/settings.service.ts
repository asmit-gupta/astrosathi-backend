import type { Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as audit from '../audit/audit.service';
import { isSettingKey, SETTINGS, type SettingKey, type SettingValue } from './registry';

const BACKDATE_TOLERANCE_MS = 5_000;

function assertKey(key: string): asserts key is SettingKey {
  if (!isSettingKey(key)) throw notFound('SETTING_NOT_FOUND', `Unknown setting "${key}"`);
}

async function inForce(db: Prisma.TransactionClient | typeof prisma, key: SettingKey, at: Date) {
  return db.setting.findFirst({
    where: { key, cancelledAt: null, effectiveFrom: { lte: at } },
    orderBy: { version: 'desc' },
  });
}

/** The value in force now. Falls back to the registry default when nothing was ever set. */
export async function get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await inForce(prisma, key, clock.now());
  return (row ? row.value : SETTINGS[key].defaultValue) as SettingValue<K>;
}

export async function listAll() {
  const now = clock.now();
  const rows = await prisma.setting.findMany({ where: { cancelledAt: null }, orderBy: { version: 'desc' } });
  return (Object.keys(SETTINGS) as SettingKey[]).map((key) => {
    const forKey = rows.filter((r) => r.key === key);
    const current = forKey.find((r) => r.effectiveFrom <= now);
    const scheduled = forKey
      .filter((r) => r.effectiveFrom > now)
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
      .map((r) => ({ version: r.version, value: r.value, effectiveFrom: r.effectiveFrom, reason: r.reason }));
    return {
      key,
      group: SETTINGS[key].group,
      description: SETTINGS[key].description,
      value: current ? current.value : SETTINGS[key].defaultValue,
      version: current?.version ?? 0,
      effectiveFrom: current?.effectiveFrom ?? null,
      isDefault: !current,
      scheduled,
    };
  });
}

export async function history(key: string) {
  assertKey(key);
  return prisma.setting.findMany({ where: { key }, orderBy: { version: 'desc' } });
}

interface Actor {
  adminId: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Adds a new version. Never edits an old one. With one admin there is no second approver
 * (handoff §4A); the route requires a fresh authenticator code instead, and every change is audited.
 */
export async function schedule(
  key: string,
  input: { value: unknown; effectiveFrom?: Date; reason: string },
  actor: Actor,
) {
  assertKey(key);
  const parsed = SETTINGS[key].schema.safeParse(input.value);
  if (!parsed.success) {
    throw badRequest('SETTING_INVALID', parsed.error.issues.map((i) => i.message).join('; '));
  }
  const now = clock.now();
  const effectiveFrom = input.effectiveFrom ?? now;
  if (effectiveFrom.getTime() < now.getTime() - BACKDATE_TOLERANCE_MS) {
    throw badRequest('SETTING_BACKDATED', 'A change can only apply from now or a future time.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'settings:' + key}))`;
    const before = await inForce(tx, key, now);
    const last = await tx.setting.findFirst({ where: { key }, orderBy: { version: 'desc' }, select: { version: true } });
    const row = await tx.setting.create({
      data: {
        key,
        version: (last?.version ?? 0) + 1,
        value: parsed.data as Prisma.InputJsonValue,
        effectiveFrom,
        reason: input.reason,
        createdBy: actor.adminId,
        createdAt: now,
      },
    });
    await audit.record(tx, {
      actorType: 'admin',
      actorId: actor.adminId,
      action: 'setting.scheduled',
      entityType: 'setting',
      entityId: key,
      before: { value: before ? before.value : SETTINGS[key].defaultValue, version: before?.version ?? 0 },
      after: { value: row.value, version: row.version, effectiveFrom: row.effectiveFrom.toISOString() },
      reason: input.reason,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return row;
  });
}

/** Cancels a version that hasn't taken effect yet. Versions already in force can only be superseded. */
export async function cancel(key: string, version: number, reason: string, actor: Actor) {
  assertKey(key);
  const now = clock.now();
  return prisma.$transaction(async (tx) => {
    const row = await tx.setting.findUnique({ where: { key_version: { key, version } } });
    if (!row) throw notFound('SETTING_VERSION_NOT_FOUND', 'No such version');
    if (row.cancelledAt) throw new AppError(409, 'SETTING_ALREADY_CANCELLED', 'Already cancelled');
    if (row.effectiveFrom <= now) {
      throw new AppError(409, 'SETTING_ALREADY_EFFECTIVE', 'This version is already in force. Schedule a new value instead.');
    }
    const updated = await tx.setting.update({ where: { id: row.id }, data: { cancelledAt: now } });
    await audit.record(tx, {
      actorType: 'admin',
      actorId: actor.adminId,
      action: 'setting.cancelled',
      entityType: 'setting',
      entityId: key,
      before: { version, value: row.value, effectiveFrom: row.effectiveFrom.toISOString() },
      after: { version, cancelled: true },
      reason,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return updated;
  });
}
