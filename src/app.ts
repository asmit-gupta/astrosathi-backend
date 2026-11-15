import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { cors } from './middleware/cors';
import { requestId } from './middleware/requestId';
import { requestLog } from './middleware/requestLog';
import { adminRouter } from './modules/admin/admin.routes';
import { providerRouter } from './modules/astrologers/provider.routes';
import { astrologersPublicRouter } from './modules/astrologers/public.routes';
import { authRouter } from './modules/auth/auth.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { meRouter } from './modules/users/users.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Needed for correct client IPs (OTP per-IP limits) behind a load balancer.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(requestId);
  app.use(requestLog);
  app.use(cors);
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  // Liveness: the process is up.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Readiness: the database is reachable and migrated. Use this for load-balancer checks.
  app.get('/health/ready', async (_req, res) => {
    try {
      const [row] = await prisma.$queryRaw<
        { users: string | null }[]
      >`SELECT to_regclass('public.users')::text AS users`;
      if (!row?.users) {
        res.status(503).json({ status: 'not_ready', db: 'unmigrated' });
        return;
      }
      res.json({ status: 'ready', db: 'ok' });
    } catch (err) {
      logger.error({ err }, 'Readiness check failed');
      res.status(503).json({ status: 'not_ready', db: 'unreachable' });
    }
  });

  app.use('/v1/auth', authRouter);
  app.use('/v1/me', meRouter);
  app.use('/v1/provider', providerRouter);
  app.use('/v1', catalogRouter);
  app.use('/v1', astrologersPublicRouter);
  app.use('/admin/v1', adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
