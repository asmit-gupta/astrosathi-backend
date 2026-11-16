import { randomUUID } from 'node:crypto';
import type { Consult, Prisma } from '@prisma/client';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import { normaliseIndianMobile, phoneHash } from '../../lib/phone';
import { prisma } from '../../lib/prisma';

type Tx = Prisma.TransactionClient;

export async function balance(db: Tx | typeof prisma, userId: string): Promise<number> {
  return (await db.wallet.findUnique({ where: { userId } }))?.balancePaise ?? 0;
}

/** W4: balance and the latest wallet entries. */
export async function walletView(userId: string) {
  const [bal, entries] = await Promise.all([
    balance(prisma, userId),
    prisma.ledgerEntry.findMany({
      where: { account: 'wallet', ownerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);
  return {
    balancePaise: bal,
    entries: entries.map((e) => ({
      id: e.id,
      kind: e.kind,
      amountPaise: e.amountPaise,
      consultId: e.consultId,
      minute: e.minute,
      at: e.createdAt,
    })),
  };
}

/**
 * Charges one started minute: wallet −rate, astrologer +their share, platform +the rest.
 * Returns false (and changes nothing) when the balance can't cover it. The unique key on
 * (consult, minute, account) makes a repeated charge fail instead of billing twice.
 */
export async function chargeMinute(tx: Tx, c: Consult, minute: number, now: Date): Promise<boolean> {
  const taken = await tx.wallet.updateMany({
    where: { userId: c.userId, balancePaise: { gte: c.ratePaise } },
    data: { balancePaise: { decrement: c.ratePaise }, updatedAt: now },
  });
  if (taken.count === 0) return false;
  const platform = Math.round((c.ratePaise * c.platformSharePct) / 100);
  const txnId = randomUUID();
  const base = { txnId, kind: 'consult_minute' as const, consultId: c.id, minute, createdAt: now };
  await tx.ledgerEntry.createMany({
    data: [
      { ...base, account: 'wallet', ownerId: c.userId, amountPaise: -c.ratePaise },
      { ...base, account: 'earnings', ownerId: c.astrologerId, amountPaise: c.ratePaise - platform },
      { ...base, account: 'platform', ownerId: null, amountPaise: platform },
    ],
  });
  return true;
}

/** Admin adds money by hand (testing, goodwill) until top-up exists. Needs a fresh authenticator code. */
export async function adminCredit(b: { mobile: string; amountPaise: number; reason: string }) {
  const mobile = normaliseIndianMobile(b.mobile);
  if (!mobile) throw badRequest('INVALID_MOBILE', 'Enter a valid 10-digit Indian mobile number.');
  const user = await prisma.user.findUnique({ where: { phoneHash: phoneHash(mobile) } });
  if (!user || user.status !== 'active') throw notFound('USER_NOT_FOUND', 'No account with this number.');
  const now = clock.now();
  const txnId = randomUUID();
  const wallet = await prisma.$transaction(async (tx) => {
    const w = await tx.wallet.upsert({
      where: { userId: user.id },
      update: { balancePaise: { increment: b.amountPaise }, updatedAt: now },
      create: { userId: user.id, balancePaise: b.amountPaise, updatedAt: now },
    });
    const base = { txnId, kind: 'admin_credit' as const, note: b.reason, createdAt: now };
    await tx.ledgerEntry.createMany({
      data: [
        { ...base, account: 'adjustment', ownerId: null, amountPaise: -b.amountPaise },
        { ...base, account: 'wallet', ownerId: user.id, amountPaise: b.amountPaise },
      ],
    });
    return w;
  });
  return { userId: user.id, name: user.name, phoneLast4: user.phoneLast4, balancePaise: wallet.balancePaise };
}
