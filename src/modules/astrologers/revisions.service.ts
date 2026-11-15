import { clock } from '../../lib/clock';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { RevisionInput } from './astrologers.schemas';
import { load, record, type Actor } from './review.shared';

/** Profile edits waiting for review (X4-2). */
export async function listRevisions() {
  const rows = await prisma.profileRevision.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { astrologer: { select: { id: true, displayName: true, bio: true, languages: true, methods: true } } },
  });
  return rows.map((r) => ({ id: r.id, astrologer: r.astrologer, changes: r.changes, at: r.createdAt }));
}

export async function decideRevision(revisionId: string, b: { approve: boolean; note: string | null }, actor: Actor) {
  const r = await prisma.profileRevision.findUnique({ where: { id: revisionId } });
  if (!r || r.status !== 'pending') throw notFound('REVISION_NOT_FOUND', 'No pending change with that id.');
  const a = await load(r.astrologerId);
  const changes = r.changes as RevisionInput;
  const now = clock.now();
  await prisma.$transaction(async (tx) => {
    if (b.approve) {
      await tx.astrologer.update({
        where: { id: a.id },
        data: {
          ...(changes.displayName ? { displayName: changes.displayName } : {}),
          ...(changes.bio ? { bio: changes.bio } : {}),
          ...(changes.photoUploadId ? { photoUploadId: changes.photoUploadId } : {}),
          ...(changes.languages ? { languages: changes.languages } : {}),
          ...(changes.methods ? { methods: changes.methods } : {}),
          updatedAt: now,
        },
      });
    }
    await tx.profileRevision.update({
      where: { id: r.id },
      data: { status: b.approve ? 'approved' : 'rejected', note: b.note, decidedAt: now },
    });
    await record(tx, actor, a, b.approve ? 'astrologer.revision_approved' : 'astrologer.revision_rejected', {
      before: { displayName: a.displayName, bio: a.bio, languages: a.languages, methods: a.methods },
      after: changes,
      reason: b.note ?? undefined,
    });
  });
  return { ok: true };
}
