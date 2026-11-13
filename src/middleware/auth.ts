import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/token.service';

/**
 * Verifies the bearer token and checks the session is still live, so signing in
 * on another device or a revocation takes effect immediately, not after token expiry.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const claims = verifyAccessToken(header.slice(7).trim());
  const session = await prisma.authSession.findUnique({
    where: { id: claims.sid },
    select: { userId: true, revokedAt: true, revokeReason: true },
  });
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    throw unauthorized('SESSION_REVOKED', 'Signed out. Please sign in again.');
  }

  req.auth = { userId: claims.sub, sessionId: claims.sid, roles: claims.roles };
  next();
};

export const requireRole =
  (role: string): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!req.auth.roles.includes(role)) throw forbidden();
    next();
  };
