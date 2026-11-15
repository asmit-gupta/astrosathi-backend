import type { ConsentDoc, Prisma } from '@prisma/client';
import { authPolicy } from '../../config/authPolicy';
import { env } from '../../config/env';
import { clock } from '../../lib/clock';
import { AppError, badRequest } from '../../lib/errors';
import { encryptPhone, maskPhone, normaliseIndianMobile, phoneHash } from '../../lib/phone';
import { prisma } from '../../lib/prisma';
import type { VerifyOtpBody } from './auth.schemas';
import * as otp from './otp.service';
import { createRefreshToken, issueAccessToken } from './token.service';

interface RequestMeta {
  ip: string | undefined;
  userAgent: string | undefined;
}

function parseMobile(input: string): string {
  const mobile = normaliseIndianMobile(input);
  if (!mobile) throw badRequest('INVALID_MOBILE', 'Enter a valid 10-digit Indian mobile number.');
  return mobile;
}

export async function requestOtp(body: { mobile: string; deviceId: string }, meta: RequestMeta) {
  const mobile = parseMobile(body.mobile);
  return otp.sendOtp({ mobile, phoneHash: phoneHash(mobile), deviceId: body.deviceId, ip: meta.ip });
}

export async function login(body: VerifyOtpBody, meta: RequestMeta) {
  const mobile = parseMobile(body.mobile);
  const hash = phoneHash(mobile);

  await otp.verifyOtp(hash, body.code);

  const now = clock.now();
  const existing = await prisma.user.findUnique({ where: { phoneHash: hash } });
  if (existing?.status === 'deleted') {
    // Erasure must clear phone_hash, so this only happens if anonymisation didn't run.
    throw new AppError(403, 'ACCOUNT_DELETED', 'This account was deleted.');
  }

  return prisma.$transaction(async (tx) => {
    const user =
      existing ??
      (await tx.user.create({
        data: {
          phoneHash: hash,
          phoneEnc: encryptPhone(mobile),
          phoneLast4: mobile.slice(-4),
          language: body.language ?? 'hi',
          ageDeclaredAt: now,
          createdAt: now,
        },
      }));

    await recordConsents(tx, user.id, body.consents.marketing, meta.ip, now);

    // One active session per account per app (spec §8.20): signing in signs other devices out of that app.
    await tx.authSession.updateMany({
      where: { userId: user.id, app: body.app, revokedAt: null },
      data: { revokedAt: now, revokeReason: 'signed_in_elsewhere' },
    });

    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        deviceId: body.deviceId,
        platform: body.platform,
        appVersion: body.appVersion,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 256),
        app: body.app,
        createdAt: now,
        lastUsedAt: now,
      },
    });

    const refreshToken = await createRefreshToken(tx, session.id);
    const accessToken = issueAccessToken({ sub: user.id, sid: session.id, roles: user.roles });

    return {
      accessToken,
      accessTokenExpiresIn: authPolicy.tokens.accessTtlSeconds,
      refreshToken,
      user: {
        id: user.id,
        phone: maskPhone(mobile),
        name: user.name,
        language: user.language,
        status: user.status,
        roles: user.roles,
        isNew: !existing,
      },
    };
  });
}

/**
 * Stores consent rows for the current document versions. Re-accepting an
 * already-accepted version adds nothing. Marketing is only ever granted here:
 * an unticked box at login never withdraws it (that's done in Settings).
 */
async function recordConsents(
  tx: Prisma.TransactionClient,
  userId: string,
  marketing: boolean,
  ip: string | undefined,
  now: Date,
) {
  const wanted: { docType: ConsentDoc; docVersion: string }[] = [
    { docType: 'terms', docVersion: env.TERMS_VERSION },
    { docType: 'privacy', docVersion: env.PRIVACY_VERSION },
    { docType: 'age_18', docVersion: 'v1' },
  ];
  if (marketing) wanted.push({ docType: 'marketing', docVersion: 'v1' });

  const active = await tx.consent.findMany({
    where: { userId, withdrawnAt: null, docType: { in: wanted.map((w) => w.docType) } },
    select: { docType: true, docVersion: true },
  });
  const missing = wanted.filter((w) => !active.some((a) => a.docType === w.docType && a.docVersion === w.docVersion));
  if (missing.length === 0) return;

  await tx.consent.createMany({
    data: missing.map((m) => ({ userId, ...m, channel: 'app_login', ip, grantedAt: now })),
  });
}
