export interface UploadLink {
  url: string;
  method: 'PUT';
  /** Headers the client must send exactly (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: Date;
}

/** Object storage behind an interface, like SMS and payments, so the provider can change. */
export interface StorageProvider {
  readonly name: string;
  createUploadLink(key: string, contentType: string, sizeBytes: number, ttlSeconds: number): Promise<UploadLink>;
  createViewLink(key: string, ttlSeconds: number): Promise<string>;
  /** Size and type of a stored object, or null if it isn't there. */
  head(key: string): Promise<{ sizeBytes: number; contentType: string | undefined } | null>;
}
