import type { AuthApp } from '@prisma/client';
import type { Request, RequestHandler } from 'express';
import type { AuthContext } from '../types/express';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/token.service';

/**
 * Verifies the bearer token and checks the session is still live, so signing in
 * on another device or a revocation takes effect immediately, not after token expiry.
 * `app` limits the route to sessions from that app: a user-app token can't call astrologer routes, and back.
 */
export async function authenticateToken(token: string, app: AuthApp | 'any'): Promise<AuthContext> {
  const claims = verifyAccessToken(token);
  const session = await prisma.authSession.findUnique({
    where: { id: claims.sid },
    select: { userId: true, revokedAt: true, revokeReason: true, app: true },
  });
  if (!session || session.userId !== claims.sub || session.revokedAt) {
    throw unauthorized('SESSION_REVOKED', 'Signed out. Please sign in again.');
  }
  if (app !== 'any' && session.app !== app) throw forbidden('WRONG_APP', 'This session belongs to the other app.');
  return { userId: claims.sub, sessionId: claims.sid, roles: claims.roles, app: session.app };
}

const authFor =
  (app: AuthApp | 'any'): RequestHandler =>
  async (req, _res, next) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    req.auth = await authenticateToken(header.slice(7).trim(), app);
    next();
  };

/** The signed-in caller. Only valid on routes behind one of the auth guards below. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** User-app routes (/v1/me). */
export const requireAuth = authFor('user');
/** Astrologer-app routes (/v1/provider). */
export const requireProviderAuth = authFor('provider');
/** Routes both apps share (/v1/auth/session, /v1/auth/logout). */
export const requireAnyAuth = authFor('any');

export const requireRole =
  (role: string): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!req.auth.roles.includes(role)) throw forbidden();
    next();
  };
