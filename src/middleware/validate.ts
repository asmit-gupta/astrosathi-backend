import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors';

/** Replaces req.body with the parsed, typed value, or fails with VALIDATION_FAILED. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fields = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw badRequest('VALIDATION_FAILED', 'Some fields are missing or invalid', { fields });
    }
    req.body = result.data;
    next();
  };
