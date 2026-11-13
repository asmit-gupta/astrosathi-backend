import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' }, requestId: req.id });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    const retry = err.details?.retryAfterSeconds;
    if (typeof retry === 'number') res.setHeader('Retry-After', String(retry));
    if (err.status >= 500) logger.error({ err, requestId: req.id }, err.message);
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      requestId: req.id,
    });
    return;
  }

  // Malformed JSON or oversized body from express.json().
  const status = (err as { status?: number; type?: string }).status;
  if (status === 400 || status === 413) {
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON';
    res.status(status).json({ error: { code, message: 'Request body could not be read' }, requestId: req.id });
    return;
  }

  logger.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' }, requestId: req.id });
};
