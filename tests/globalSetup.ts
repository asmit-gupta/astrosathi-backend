import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

/**
 * Starts a throwaway Postgres for the test run (no Docker needed) and applies
 * the real migrations. Set TEST_DATABASE_URL to use an existing database instead.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export default async function setup() {
  let pg: EmbeddedPostgres | undefined;
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    const dir = path.resolve(__dirname, '../.test-pg');
    rmSync(dir, { recursive: true, force: true });
    const port = await freePort();
    pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {} });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('astrolive_test');
    url = `postgresql://test:test@localhost:${port}/astrolive_test`;
  }

  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    await pg?.stop();
    throw new Error(`Refusing to run tests against non-local database host "${host}"`);
  }

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: 'pipe' });

  return async () => {
    await pg?.stop();
  };
}
