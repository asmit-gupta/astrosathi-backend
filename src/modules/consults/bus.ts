import pg from 'pg';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

/**
 * Realtime events between servers through Postgres LISTEN/NOTIFY: every server listens and passes
 * events to the phones connected to it. No Redis needed until we run many servers.
 * `to` holds socket keys: "u:<userId>" (user app) or "a:<astrologerId>" (astrologer app).
 */
const CHANNEL = 'consult_events';

export type BusHandler = (to: string[], event: Record<string, unknown>) => void;

let client: pg.Client | null = null;
let stopped = true;

export async function startBus(onEvent: BusHandler): Promise<void> {
  stopped = false;
  const connect = async () => {
    const c = new pg.Client({ connectionString: env.DIRECT_URL ?? env.DATABASE_URL });
    c.on('notification', (n) => {
      if (n.channel !== CHANNEL || !n.payload) return;
      try {
        const { to, event } = JSON.parse(n.payload) as { to: string[]; event: Record<string, unknown> };
        onEvent(to, event);
      } catch (err) {
        logger.error({ err }, 'Bad realtime event');
      }
    });
    c.on('error', (err) => {
      logger.error({ err }, 'Realtime listener lost; reconnecting');
      void c.end().catch(() => undefined);
      if (client === c) client = null;
      if (!stopped) setTimeout(() => void connect().catch(retry), 1_000);
    });
    await c.connect();
    await c.query(`LISTEN ${CHANNEL}`);
    client = c;
  };
  const retry = (err: unknown) => {
    logger.error({ err }, 'Realtime listener could not connect; retrying');
    if (!stopped) setTimeout(() => void connect().catch(retry), 2_000);
  };
  await connect().catch(retry);
}

export async function stopBus(): Promise<void> {
  stopped = true;
  const c = client;
  client = null;
  await c?.end().catch(() => undefined);
}

export async function publish(to: string[], event: Record<string, unknown>): Promise<void> {
  if (!to.length) return;
  try {
    await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${JSON.stringify({ to, event })})`;
  } catch (err) {
    logger.error({ err }, 'Could not publish realtime event');
  }
}

export const userKey = (userId: string) => `u:${userId}`;
export const astrologerKey = (astrologerId: string) => `a:${astrologerId}`;
