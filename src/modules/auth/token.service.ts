import jwt from 'jsonwebtoken';
import { type Prisma } from '@prisma/client';
import { authPolicy } from '../../config/authPolicy';
import { env } from '../../config/env';
import { addSeconds, clock } from '../../lib/clock';
import { randomToken, sha256 } from '../../lib/crypto';
import { unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const ISSUER = 'astrolive';
const AUDIENCE = 'astrolive-app';

export interface AccessClaims {
  sub: string; // user id
  sid: string; // auth session id
  roles: string[];
}

export function issueAccessToken(claims: AccessClaims): string {
  const iat = Math.floor(clock.now().getTime() / 1000);
  return jwt.sign({ sid: claims.sid, roles: claims.roles, typ: 'access', iat }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: authPolicy.tokens.accessTtlSeconds,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      clockTimestamp: Math.floor(clock.now().getTime() / 1000),
    }) as jwt.JwtPayload;
    if (payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw unauthorized('TOKEN_INVALID', 'Invalid token');
    }
    return { sub: payload.sub, sid: payload.sid, roles: Array.isArray(payload.roles) ? payload.roles : [] };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw unauthorized('TOKEN_EXPIRED', 'Access token expired');
    if (err instanceof jwt.JsonWebTokenError) throw unauthorized('TOKEN_INVALID', 'Invalid token');
    throw err;
  }
}

/** Creates a refresh token row and returns the plain token (only ever sent to the client once). */
export async function createRefreshToken(db: Prisma.TransactionClient, sessionId: string): Promise<string> {
  const token = randomToken(32);
  const now = clock.now();
  await db.refreshToken.create({
    data: {
      sessionId,
      tokenHash: sha256(token),
      expiresAt: addSeconds(now, authPolicy.tokens.refreshTtlSeconds),
      createdAt: now,
    },
  });
  return token;
}

/**
 * Rotation with reuse detection: each refresh token works once. If a used token
 * comes back, someone else has a copy, so the whole session is revoked.
 */
export async function rotateRefreshToken(token: string) {
  const now = clock.now();
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { session: { include: { user: { select: { id: true, roles: true, status: true } } } } },
  });
  if (!row) throw unauthorized('REFRESH_INVALID', 'Invalid refresh token');

  const { session } = row;
  if (session.revokedAt) throw unauthorized('SESSION_REVOKED', 'Signed out. Please sign in again.');

  if (row.usedAt) {
    await revokeSession(session.id, 'refresh_reuse');
    throw unauthorized('REFRESH_REUSED', 'Signed out for safety. Please sign in again.');
  }
  if (row.expiresAt <= now) throw unauthorized('REFRESH_EXPIRED', 'Signed out. Please sign in again.');
  if (session.user.status === 'deleted') {
    await revokeSession(session.id, 'account_deleted');
    throw unauthorized('SESSION_REVOKED', 'Signed out. Please sign in again.');
  }

  return prisma.$transaction(async (tx) => {
    const marked = await tx.refreshToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (marked.count === 0) {
      // Lost a race with another refresh using the same token: treat as reuse.
      await tx.authSession.update({
        where: { id: session.id },
        data: { revokedAt: now, revokeReason: 'refresh_reuse' },
      });
      throw unauthorized('REFRESH_REUSED', 'Signed out for safety. Please sign in again.');
    }
    await tx.authSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    const refreshToken = await createRefreshToken(tx, session.id);
    const accessToken = issueAccessToken({ sub: session.user.id, sid: session.id, roles: session.user.roles });
    return { accessToken, refreshToken, accessTokenExpiresIn: authPolicy.tokens.accessTtlSeconds };
  });
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: clock.now(), revokeReason: reason },
  });
}
