import type { Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { prisma } from '../../lib/prisma';

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

const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

/** Write inside the same transaction as the change it describes, so neither exists without the other. */
export async function record(db: Db, e: AuditEntry): Promise<void> {
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

export interface AuditQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

/** Newest first, cursor-paginated by id. */
export async function list(q: AuditQuery) {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: q.action,
      entityType: q.entityType,
      entityId: q.entityId,
      createdAt: { gte: q.from, lte: q.to },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null };
}
