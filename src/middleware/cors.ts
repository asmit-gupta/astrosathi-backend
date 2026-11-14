import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * CORS for browser clients (Flutter web, admin web). Only exact origins listed in
 * CORS_ORIGINS are allowed; empty means no browser origin is allowed (mobile apps don't need CORS).
 * Auth is a Bearer header, never cookies, so credentials are not enabled.
 */
export function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.header('origin');
  if (!origin || !env.CORS_ORIGINS.includes(origin)) return next();

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return;
  }
  next();
}
