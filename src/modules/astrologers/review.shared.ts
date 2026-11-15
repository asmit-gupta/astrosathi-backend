import type { Astrologer, Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as audit from '../audit/audit.service';

/** Shared by the admin review services: who acted, loading, audit and timeline entries. */
export interface Actor {
  adminId: string;
  ip?: string;
  userAgent?: string;
}

export async function load(id: string): Promise<Astrologer> {
  const a = await prisma.astrologer.findUnique({ where: { id } });
  if (!a) throw notFound('ASTROLOGER_NOT_FOUND', 'Astrologer not found');
  return a;
}

export const record = (
  db: Prisma.TransactionClient | typeof prisma,
  actor: Actor,
  a: Astrologer,
  action: string,
  extra: Partial<audit.AuditEntry> = {},
) =>
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

export const event = (db: Prisma.TransactionClient, a: Astrologer, type: string, note?: string | null) =>
  db.astrologerEvent.create({
    data: { astrologerId: a.id, type, note: note ?? null, actor: 'admin', createdAt: clock.now() },
  });
