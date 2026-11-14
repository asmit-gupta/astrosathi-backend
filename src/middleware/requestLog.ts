import type { RequestHandler } from 'express';
import { logger } from '../lib/logger';

/**
 * One line per request: method, path, status, time, request id, client and app version.
 * Never logs bodies, headers with tokens, or query strings that could hold personal data
 * (only the path; place search keeps its query because it is a town name).
 * Health checks are logged at debug so platform probes don't drown real traffic.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
    const entry = {
      requestId: req.id,
      method: req.method,
      path: path === '/v1/places' ? req.originalUrl.slice(0, 120) : path,
      status: res.statusCode,
      ms: Math.round(ms),
      ip: req.ip,
      ua: req.header('user-agent')?.slice(0, 80),
      // Error code from our JSON error body, set by errorHandler.
      ...(res.locals.errorCode ? { code: res.locals.errorCode as string } : {}),
    };
    const msg = `${req.method} ${entry.path} ${res.statusCode} ${entry.ms}ms`;
    if (path.startsWith('/health')) logger.debug(entry, msg);
    else if (res.statusCode >= 500) logger.error(entry, msg);
    else if (res.statusCode >= 400) logger.warn(entry, msg);
    else logger.info(entry, msg);
  });
  next();
};
