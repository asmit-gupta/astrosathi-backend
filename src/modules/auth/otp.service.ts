import { Prisma } from '@prisma/client';
import { sms } from '../../adapters/sms';
import { authPolicy } from '../../config/authPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { hmac, numericCode, safeEqualHex } from '../../lib/crypto';
import { AppError, badRequest, tooManyRequests } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const policy = authPolicy.otp;

const codeHash = (phoneHash: string, code: string) => hmac('otp', `${phoneHash}:${code}`);
const secondsUntil = (later: Date, now: Date) => Math.max(1, Math.ceil((later.getTime() - now.getTime()) / 1000));

type Tx = Prisma.TransactionClient;

async function assertNotLocked(db: Tx, phoneHash: string, now: Date) {
  const locked = await db.otpRequest.findFirst({
    where: { phoneHash, lockedUntil: { gt: now } },
    orderBy: { lockedUntil: 'desc' },
    select: { lockedUntil: true },
  });
  if (locked?.lockedUntil) {
    throw tooManyRequests('OTP_LOCKED', 'Too many wrong codes. Try again later.', secondsUntil(locked.lockedUntil, now));
  }
}

/** Sliding-window limit. Failed SMS sends don't count, so a provider outage can't lock people out. */
async function assertWindow(
  db: Tx,
  where: Prisma.OtpRequestWhereInput,
  limit: { max: number; windowSeconds: number },
  code: string,
  now: Date,
) {
  const since = addSeconds(now, -limit.windowSeconds);
  const recent = await db.otpRequest.findMany({
    where: { ...where, createdAt: { gt: since }, delivery: { not: 'failed' } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
    take: limit.max,
  });
  if (recent.length >= limit.max) {
    const oldest = recent[0]!.createdAt;
    throw tooManyRequests(code, 'Too many code requests. Try again later.', secondsUntil(addSeconds(oldest, limit.windowSeconds), now));
  }
}

export interface SendOtpParams {
  mobile: string; // normalised
  phoneHash: string;
  deviceId: string;
  ip: string | undefined;
}

export async function sendOtp({ mobile, phoneHash, deviceId, ip }: SendOtpParams) {
  const now = clock.now();
  const code = numericCode(policy.length);

  // Serialise sends per number so two parallel requests can't both pass the limits.
  const request = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'otp:' + phoneHash}))`;
    await assertNotLocked(tx, phoneHash, now);

    const last = await tx.otpRequest.findFirst({
      where: { phoneHash },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const cooldownEnds = last && addSeconds(last.createdAt, policy.resendCooldownSeconds);
    if (cooldownEnds && cooldownEnds > now) {
      throw tooManyRequests('OTP_RESEND_COOLDOWN', 'Please wait before asking for a new code.', secondsUntil(cooldownEnds, now));
    }

    await assertWindow(tx, { phoneHash }, policy.perPhone, 'OTP_RATE_LIMITED', now);
    await assertWindow(tx, { deviceId }, policy.perDevice, 'OTP_RATE_LIMITED', now);
    if (ip) await assertWindow(tx, { ip }, policy.perIp, 'OTP_RATE_LIMITED', now);

    // A new code replaces any earlier one still open.
    await tx.otpRequest.updateMany({
      where: { phoneHash, consumedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });

    return tx.otpRequest.create({
      data: {
        phoneHash,
        codeHash: codeHash(phoneHash, code),
        expiresAt: addSeconds(now, policy.ttlSeconds),
        ip,
        deviceId,
        createdAt: now,
      },
      select: { id: true, expiresAt: true },
    });
  });

  const result = await sms.get().sendOtp({
    mobile,
    code,
    ttlMinutes: Math.ceil(policy.ttlSeconds / 60),
    requestId: request.id,
  });

  await prisma.otpRequest.update({
    where: { id: request.id },
    data: {
      delivery: result.accepted ? 'sent' : 'failed',
      providerRef: (result.providerRef ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  if (!result.accepted) {
    throw new AppError(502, 'SMS_SEND_FAILED', 'Could not send the code. Please try again.');
  }

  return {
    requestId: request.id,
    expiresInSeconds: policy.ttlSeconds,
    resendInSeconds: policy.resendCooldownSeconds,
  };
}

/** Checks the code against the latest open request. Returns normally only on a correct, unused code. */
export async function verifyOtp(phoneHash: string, code: string): Promise<void> {
  const now = clock.now();
  await assertNotLocked(prisma, phoneHash, now);

  const request = await prisma.otpRequest.findFirst({
    where: { phoneHash, consumedAt: null, delivery: { not: 'failed' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!request) throw badRequest('OTP_NOT_REQUESTED', 'Ask for a code first.');
  if (request.expiresAt <= now) throw badRequest('OTP_EXPIRED', 'This code has expired. Ask for a new one.');

  // Count the attempt atomically before comparing, so parallel guesses can't exceed the limit.
  const counted = await prisma.otpRequest.updateMany({
    where: { id: request.id, consumedAt: null, attempts: { lt: policy.maxVerifyAttempts } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) {
    throw tooManyRequests('OTP_LOCKED', 'Too many wrong codes. Try again later.', policy.lockSeconds);
  }
  const attempts = request.attempts + 1;

  if (!safeEqualHex(request.codeHash, codeHash(phoneHash, code))) {
    if (attempts >= policy.maxVerifyAttempts) {
      await prisma.otpRequest.update({
        where: { id: request.id },
        data: { lockedUntil: addSeconds(now, policy.lockSeconds) },
      });
      throw tooManyRequests('OTP_LOCKED', 'Too many wrong codes. Try again later.', policy.lockSeconds);
    }
    throw badRequest('OTP_INVALID', 'That code is not right.', {
      attemptsLeft: policy.maxVerifyAttempts - attempts,
    });
  }

  const consumed = await prisma.otpRequest.updateMany({
    where: { id: request.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) throw badRequest('OTP_EXPIRED', 'This code was already used. Ask for a new one.');
}
