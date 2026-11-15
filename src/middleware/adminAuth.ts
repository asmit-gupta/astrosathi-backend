import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env';
import { safeEqualHex, sha256 } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import { authenticate, hasFreshStepUp, type AdminContext } from '../modules/admin/adminAuth.service';

/**
 * The admin panel calls this API from its own server, so req.ip is the panel's address.
 * When the panel proves itself with ADMIN_PANEL_SECRET, its X-Admin-Client-Ip header
 * (the admin's real browser IP) is used for the login lockout, the allowlist and the audit log.
 * Without the secret the header is ignored, so nobody else can spoof an IP.
 */
export function adminClientIp(req: Request): string {
  const secret = env.ADMIN_PANEL_SECRET;
  const presented = req.header('x-admin-panel-secret');
  const forwarded = req.header('x-admin-client-ip')?.trim();
  if (secret && presented && forwarded && isIP(forwarded) && safeEqualHex(sha256(presented), sha256(secret))) {
    return forwarded;
  }
  return req.ip ?? 'unknown';
}

/** Applied to all of /admin. With no allowlist configured, every IP passes. */
export const adminIpAllowlist: RequestHandler = (req, _res, next) => {
  if (env.ADMIN_IP_ALLOWLIST.length > 0 && !env.ADMIN_IP_ALLOWLIST.includes(adminClientIp(req))) {
    throw forbidden('ADMIN_IP_NOT_ALLOWED', 'Not allowed from this network.');
  }
  next();
};

/** The signed-in admin. Only valid on routes behind requireAdmin. */
export function adminOf(req: Request): AdminContext {
  if (!req.admin) throw unauthorized('ADMIN_SESSION_INVALID', 'Please sign in.');
  return req.admin;
}

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw unauthorized('ADMIN_SESSION_INVALID', 'Please sign in.');
  req.admin = await authenticate(header.slice(7).trim());
  next();
};

/**
 * Sensitive actions need an authenticator code entered within the last 5 minutes.
 * With a single admin this replaces the spec's second approver (maker-checker).
 */
export const requireStepUp: RequestHandler = (req, _res, next) => {
  if (!req.admin) throw unauthorized('ADMIN_SESSION_INVALID', 'Please sign in.');
  if (!hasFreshStepUp(req.admin)) {
    throw forbidden('STEP_UP_REQUIRED', 'Enter a code from your authenticator app to continue.');
  }
  next();
};
