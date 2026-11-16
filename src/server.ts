import { createApp } from './app';
import { consultPolicy } from './config/consultPolicy';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { sweep } from './modules/consults/consults.service';
import { attachRealtime } from './modules/consults/realtime';

const server = createApp().listen(env.PORT, () => {
  // Settings summary for the deploy log. Names and shapes only, never secret values.
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      sms: env.SMS_PROVIDER,
      dbHost: safeHost(env.DATABASE_URL),
      corsOrigins: env.CORS_ORIGINS,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      adminIpAllowlist: env.ADMIN_IP_ALLOWLIST.length,
      node: process.version,
    },
    `AstroLive API listening on :${env.PORT}`,
  );
});

// Chat socket, and the billing/timeout sweep (safe to run on every server at once).
const closeRealtime = attachRealtime(server);
let sweeping = false;
const sweeper = setInterval(() => {
  if (sweeping) return;
  sweeping = true;
  sweep()
    .catch((err: unknown) => logger.error({ err }, 'Consult sweep failed'))
    .finally(() => {
      sweeping = false;
    });
}, consultPolicy.sweepEveryMs);

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid';
  }
}

process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception, exiting');
  process.exit(1);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  clearInterval(sweeper);
  await (await closeRealtime)().catch(() => undefined);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
