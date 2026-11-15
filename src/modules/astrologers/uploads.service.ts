import type { Prisma, Upload, UploadPurpose } from '@prisma/client';
import { storage } from '../../adapters/storage';
import { astrologerPolicy } from '../../config/astrologerPolicy';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';

const rules = astrologerPolicy.uploads;

/**
 * Step 1 of an upload: records it and returns a short-lived link the app PUTs the file to.
 * Type and size are signed into the link, so a different or bigger file is refused by storage.
 */
export async function createUpload(userId: string, purpose: UploadPurpose, contentType: string, sizeBytes: number) {
  const rule = rules.byPurpose[purpose];
  if (!(rule.types as readonly string[]).includes(contentType)) {
    throw badRequest('UPLOAD_TYPE_NOT_ALLOWED', 'This file type is not allowed here.', { allowed: rule.types });
  }
  if (sizeBytes <= 0 || sizeBytes > rule.maxBytes) {
    throw badRequest('UPLOAD_TOO_LARGE', 'This file is too large.', { maxBytes: rule.maxBytes });
  }
  const now = clock.now();
  const upload = await prisma.upload.create({
    data: { ownerUserId: userId, purpose, storageKey: 'pending', contentType, sizeBytes, createdAt: now },
  });
  const key = `astrologers/${userId}/${purpose}/${upload.id}`;
  await prisma.upload.update({ where: { id: upload.id }, data: { storageKey: key } });
  const link = await storage.get().createUploadLink(key, contentType, sizeBytes, rules.linkTtlSeconds);
  return { uploadId: upload.id, upload: link };
}

/** Step 2: the app says it's done; we check storage really has the file, with the declared size and type. */
export async function completeUpload(userId: string, uploadId: string) {
  const upload = await prisma.upload.findFirst({ where: { id: uploadId, ownerUserId: userId } });
  if (!upload) throw notFound('UPLOAD_NOT_FOUND', 'Upload not found');
  if (upload.status === 'uploaded') return uploadView(upload);
  const head = await storage.get().head(upload.storageKey);
  if (!head) throw badRequest('UPLOAD_MISSING', 'The file has not arrived yet. Please upload it again.');
  if (head.sizeBytes !== upload.sizeBytes || (head.contentType && head.contentType !== upload.contentType)) {
    logger.warn({ uploadId, head, expected: { sizeBytes: upload.sizeBytes, contentType: upload.contentType } }, 'Upload mismatch');
    throw badRequest('UPLOAD_MISMATCH', 'The uploaded file does not match. Please upload it again.');
  }
  const updated = await prisma.upload.update({ where: { id: upload.id }, data: { status: 'uploaded', uploadedAt: clock.now() } });
  return uploadView(updated);
}

/** An upload the caller owns, finished, and of the right kind; throws otherwise. Used when a step references a file. */
export async function assertUsableUpload(db: Prisma.TransactionClient, userId: string, uploadId: string, purpose: UploadPurpose) {
  const upload = await db.upload.findFirst({ where: { id: uploadId, ownerUserId: userId } });
  if (!upload || upload.purpose !== purpose || upload.status !== 'uploaded') {
    throw badRequest('UPLOAD_INVALID', `Upload ${uploadId} is not a finished ${purpose} upload.`, { uploadId, purpose });
  }
  return upload;
}

export function uploadView(u: Upload) {
  return {
    id: u.id,
    purpose: u.purpose,
    contentType: u.contentType,
    sizeBytes: u.sizeBytes,
    status: u.status,
    review: u.review,
    reviewNote: u.reviewNote,
  };
}

/** A short-lived view link, or null when storage isn't set up (public pages must not fail on a missing photo). */
export async function viewLink(storageKey: string | undefined | null): Promise<string | null> {
  if (!storageKey) return null;
  try {
    return await storage.get().createViewLink(storageKey, rules.viewTtlSeconds);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Could not create view link');
    return null;
  }
}
