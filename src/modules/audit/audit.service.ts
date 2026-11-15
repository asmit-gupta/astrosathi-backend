import type { Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { type prisma } from '../../lib/prisma';

export interface AuditEntry {
  actorType: 'admin' | 'system' | 'user';
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
}

type Db = Prisma.TransactionClient | typeof prisma;

const AUDIT_OFF = true;

const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

/** Write inside the same transaction as the change it describes, so neither exists without the other. */
export async function record(db: Db, e: AuditEntry): Promise<void> {
  // Audit logging is off (founder's decision, 15 Nov 2026). Calls stay in place so it can be switched back on here.
  if (AUDIT_OFF) return;
  await db.auditLog.create({
    data: {
      actorType: e.actorType,
      actorId: e.actorId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      before: json(e.before),
      after: json(e.after),
      reason: e.reason,
      ip: e.ip,
      userAgent: e.userAgent?.slice(0, 256),
      createdAt: clock.now(),
    },
  });
}
