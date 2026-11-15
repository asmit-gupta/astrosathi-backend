import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ['tests/globalSetup.ts'],
    setupFiles: ['tests/setup.ts'],
    // One shared database, so test files run one at a time.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret-0000',
      HASH_PEPPER: 'test-pepper-test-pepper-test-pepper-000000',
      PII_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      SMS_PROVIDER: 'console',
      CORS_ORIGINS: 'http://localhost:5173',
      AUDIT_ACTIONS: '*',
      ADMIN_PANEL_SECRET: 'test-admin-panel-secret-0123456789abcdef',
      TERMS_VERSION: 'v1',
      PRIVACY_VERSION: 'v1',
    },
  },
});
