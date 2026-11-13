import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { authenticate, hasFreshStepUp } from '../modules/admin/adminAuth.service';

/** Applied to all of /admin. With no allowlist configured, every IP passes. */
export const adminIpAllowlist: RequestHandler = (req, _res, next) => {
  if (env.ADMIN_IP_ALLOWLIST.length > 0 && !env.ADMIN_IP_ALLOWLIST.includes(req.ip ?? '')) {
    throw forbidden('ADMIN_IP_NOT_ALLOWED', 'Not allowed from this network.');
  }
  next();
};

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
