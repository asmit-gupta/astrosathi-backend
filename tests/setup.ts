import { afterAll, beforeEach } from 'vitest';

// Tests TRUNCATE every table. Refuse to run against anything but a local database.
const dbHost = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid').hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
  throw new Error(`Refusing to run tests against non-local database host "${dbHost}"`);
}

import { clock } from '../src/lib/clock';
import { prisma } from '../src/lib/prisma';

beforeEach(async () => {
  clock.set(null);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE data_requests, user_preferences, birth_profiles, refresh_tokens, auth_sessions, consents, otp_requests, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
