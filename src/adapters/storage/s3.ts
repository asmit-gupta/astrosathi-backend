import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider, UploadLink } from './StorageProvider';

/** AWS S3 or any S3-compatible store (set an endpoint). The bucket stays private; links are signed. */
export class S3Storage implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    opts: { region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: !!opts.endpoint,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async createUploadLink(key: string, contentType: string, sizeBytes: number, ttlSeconds: number): Promise<UploadLink> {
    // Type and length are signed, so the client can't upload a bigger or different file with this link.
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: ttlSeconds, signableHeaders: new Set(['content-type', 'content-length']) });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': String(sizeBytes) },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    };
  }

  async createViewLink(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }

  async head(key: string) {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: Number(res.ContentLength ?? 0), contentType: res.ContentType };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return null;
      throw err;
    }
  }
}
