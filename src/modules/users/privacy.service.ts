import { usersPolicy } from '../../config/usersPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { hasActiveConsultSession } from '../sessions/guard';

const DAY = 24 * 60 * 60;
const OPEN = ['received', 'in_progress'] as const;

export async function listConsents(userId: string) {
  const rows = await prisma.consent.findMany({
    where: { userId },
    orderBy: { grantedAt: 'asc' },
    select: { docType: true, docVersion: true, channel: true, grantedAt: true, withdrawnAt: true },
  });
  return rows;
}

/** Marketing is opt-in and can be withdrawn at any time (DPDP; spec §8.3). */
export async function setMarketing(userId: string, granted: boolean, ip: string | undefined) {
  const now = clock.now();
  const active = await prisma.consent.findFirst({ where: { userId, docType: 'marketing', withdrawnAt: null } });
  if (granted && !active) {
    await prisma.consent.create({
      data: {
        userId,
        docType: 'marketing',
        docVersion: usersPolicy.marketingConsentVersion,
        channel: 'app_settings',
        ip,
        grantedAt: now,
      },
    });
  }
  if (!granted && active) {
    await prisma.consent.updateMany({
      where: { userId, docType: 'marketing', withdrawnAt: null },
      data: { withdrawnAt: now },
    });
  }
  return { marketing: granted };
}

const requestView = (r: { id: string; type: string; status: string; dueAt: Date; createdAt: Date }) => ({
  id: r.id,
  type: r.type,
  status: r.status,
  dueAt: r.dueAt,
  createdAt: r.createdAt,
});

/** "Download my data". Fulfilment is done by the compliance module; this records the request and its deadline. */
export async function requestExport(userId: string) {
  const open = await prisma.dataRequest.findFirst({ where: { userId, type: 'export', status: { in: [...OPEN] } } });
  if (open) return requestView(open);
  const now = clock.now();
  const row = await prisma.dataRequest.create({
    data: { userId, type: 'export', dueAt: addSeconds(now, usersPolicy.exportDueDays * DAY), createdAt: now },
  });
  return requestView(row);
}

/**
 * "Delete my account" with a 7-day cool-off (spec §8.17). The account keeps working
 * and the request can be cancelled until dueAt; the erasure job runs after that.
 * TODO(wallet): show the remaining balance and refund it first (wireframe W6 note 3).
 */
export async function requestDeletion(userId: string) {
  if (await hasActiveConsultSession(userId)) {
    throw new AppError(409, 'SESSION_IN_PROGRESS', 'Please end your session first.');
  }
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true } });
    if (user.status === 'suspended') {
      // A suspension may involve a dispute or legal hold; support handles these by hand.
      throw new AppError(409, 'ACCOUNT_SUSPENDED', 'Your account is on hold. Please contact support.');
    }
    const open = await tx.dataRequest.findFirst({ where: { userId, type: 'erasure', status: { in: [...OPEN] } } });
    if (open) return requestView(open);

    const now = clock.now();
    const row = await tx.dataRequest.create({
      data: {
        userId,
        type: 'erasure',
        dueAt: addSeconds(now, usersPolicy.deletionCoolOffDays * DAY),
        createdAt: now,
      },
    });
    await tx.user.update({ where: { id: userId }, data: { status: 'deletion_pending' } });
    return requestView(row);
  });
}

export async function cancelDeletion(userId: string) {
  return prisma.$transaction(async (tx) => {
    const open = await tx.dataRequest.findFirst({ where: { userId, type: 'erasure', status: 'received' } });
    if (!open) throw new AppError(404, 'NO_DELETION_PENDING', 'There is no deletion request to cancel.');
    await tx.dataRequest.update({ where: { id: open.id }, data: { status: 'cancelled', cancelledAt: clock.now() } });
    await tx.user.updateMany({ where: { id: userId, status: 'deletion_pending' }, data: { status: 'active' } });
  });
}

export async function pendingDeletion(userId: string) {
  const open = await prisma.dataRequest.findFirst({
    where: { userId, type: 'erasure', status: { in: [...OPEN] } },
    select: { dueAt: true },
  });
  return open ? { dueAt: open.dueAt } : null;
}
