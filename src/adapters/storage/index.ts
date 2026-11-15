import { env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { S3Storage } from './s3';
import type { StorageProvider } from './StorageProvider';

export type { StorageProvider, UploadLink } from './StorageProvider';

/** Used until storage is configured: every call fails with a clear 503. */
class UnconfiguredStorage implements StorageProvider {
  readonly name = 'unconfigured';
  private fail(): never {
    throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not set up yet.');
  }
  createUploadLink = async () => this.fail();
  createViewLink = async () => this.fail();
  head = async () => this.fail();
}

function fromEnv(): StorageProvider {
  if (env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY) {
    return new S3Storage(env.STORAGE_BUCKET, {
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    });
  }
  return new UnconfiguredStorage();
}

let provider: StorageProvider = fromEnv();

export const storage = {
  get: (): StorageProvider => provider,
  /** Test-only override. */
  use: (p: StorageProvider): void => {
    provider = p;
  },
};
