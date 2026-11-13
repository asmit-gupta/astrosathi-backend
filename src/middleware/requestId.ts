import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const VALID = /^[A-Za-z0-9._-]{8,64}$/;

/** Reuses a sane incoming X-Request-Id (from the load balancer) or makes one. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming && VALID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
