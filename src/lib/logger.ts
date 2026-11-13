import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  // Never log secrets or PII, even by accident.
  redact: {
    paths: [
      'req.headers.authorization',
      '*.otp',
      '*.code',
      '*.mobile',
      '*.refreshToken',
      '*.accessToken',
      'headers.authorization',
      'headers.Authorization',
    ],
    censor: '[redacted]',
  },
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
});
