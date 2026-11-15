import type { Astrologer, Prisma } from '@prisma/client';
import { astrologerPolicy } from '../../config/astrologerPolicy';
import { clock } from '../../lib/clock';
import { encryptPii } from '../../lib/crypto';
import { AppError, badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { MODES, assertRateAllowed } from './rates.service';
import type { BasicsInput, DocumentsInput, ExpertiseInput, PayoutInput, RatesInput } from './astrologers.schemas';
import { assertUsableUpload } from './uploads.service';
import { applicationView } from './views';

/** Agreement versions accepted at submit. Bump when the text changes. */
export const PROVIDER_AGREEMENT_VERSION = 'v1';

const EDITABLE = new Set(['draft', 'needs_changes']);

/** The caller's application, created as a draft on first use. */
export async function getOrCreate(userId: string): Promise<Astrologer> {
  const existing = await prisma.astrologer.findUnique({ where: { userId } });
  if (existing) return existing;
  const now = clock.now();
  return prisma.astrologer.upsert({
    where: { userId },
    update: {},
    create: { userId, createdAt: now, updatedAt: now },
  });
}

export async function view(userId: string) {
  return applicationView(await getOrCreate(userId));
}

/** Runs a step save inside a transaction with the row locked, only while the application can be edited. */
async function editStep(userId: string, fn: (tx: Prisma.TransactionClient, a: Astrologer) => Promise<void>) {
  const a = await getOrCreate(userId);
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Astrologer[]>`SELECT * FROM astrologers WHERE id = ${a.id}::uuid FOR UPDATE`;
    if (!row || !EDITABLE.has(row.status)) {
      throw new AppError(
        409,
        'APPLICATION_LOCKED',
        'Your application is being reviewed and cannot be changed right now.',
      );
    }
    await fn(tx, a);
    await tx.astrologer.update({ where: { id: a.id }, data: { updatedAt: clock.now() } });
  });
  return view(userId);
}

export const saveBasics = (userId: string, b: BasicsInput) =>
  editStep(userId, async (tx, a) => {
    const place = await tx.place.findUnique({ where: { id: b.placeId }, select: { id: true } });
    if (!place) throw badRequest('PLACE_NOT_FOUND', 'Pick your city from the list.');
    await assertUsableUpload(tx, userId, b.photoUploadId, 'photo');
    await tx.astrologer.update({
      where: { id: a.id },
      data: {
        legalName: b.legalName,
        displayName: b.displayName,
        gender: b.gender,
        placeId: b.placeId,
        languages: [...new Set(b.languages)],
        experienceYears: b.experienceYears,
        photoUploadId: b.photoUploadId,
      },
    });
  });

/** Bio rules (spec §9.2): no guarantees, cures, contact details or links. */
export function bioProblems(bio: string): string[] {
  return astrologerPolicy.bannedClaims.filter((re) => re.test(bio)).map((re) => bio.match(re)?.[0] ?? '');
}

export async function assertTopicsAndMethods(db: Prisma.TransactionClient, categories: string[], methods?: string[]) {
  const cats = await db.category.findMany({
    where: { slug: { in: categories }, active: true },
    select: { slug: true },
  });
  const unknownCats = categories.filter((c) => !cats.some((k) => k.slug === c));
  if (unknownCats.length) throw badRequest('UNKNOWN_TOPIC', 'Unknown topic', { topics: unknownCats });
  if (methods) {
    const tags = await db.methodTag.findMany({
      where: { slug: { in: methods }, active: true },
      select: { slug: true },
    });
    const unknown = methods.filter((m) => !tags.some((t) => t.slug === m));
    if (unknown.length) throw badRequest('UNKNOWN_METHOD', 'Unknown method', { methods: unknown });
  }
}

export const saveExpertise = (userId: string, b: ExpertiseInput) =>
  editStep(userId, async (tx, a) => {
    await assertTopicsAndMethods(tx, [b.primaryCategory, ...b.secondaryCategories], b.methods);
    const problems = bioProblems(b.bio);
    if (problems.length) {
      throw badRequest(
        'BIO_NOT_ALLOWED',
        'Your bio has words we cannot allow (guarantees, cures, contact details or links).',
        {
          matches: problems,
        },
      );
    }
    await tx.astrologer.update({
      where: { id: a.id },
      data: {
        methods: [...new Set(b.methods)],
        primaryCategory: b.primaryCategory,
        secondaryCategories: [...new Set(b.secondaryCategories)],
        capabilitiesRequested: [...new Set(b.capabilities)],
        bio: b.bio,
      },
    });
  });

export const saveDocuments = (userId: string, b: DocumentsInput) =>
  editStep(userId, async (tx, a) => {
    await assertUsableUpload(tx, userId, b.panUploadId, 'pan');
    await assertUsableUpload(tx, userId, b.idFrontUploadId, 'id_front');
    if (b.idBackUploadId) await assertUsableUpload(tx, userId, b.idBackUploadId, 'id_back');
    if (b.proofUploadId) await assertUsableUpload(tx, userId, b.proofUploadId, 'experience_proof');
    await assertUsableUpload(tx, userId, b.introVideoUploadId, 'intro_video');
    await tx.astrologer.update({
      where: { id: a.id },
      data: {
        panUploadId: b.panUploadId,
        idType: b.idType,
        idFrontUploadId: b.idFrontUploadId,
        idBackUploadId: b.idBackUploadId,
        proofUploadId: b.proofUploadId,
        introVideoUploadId: b.introVideoUploadId,
      },
    });
  });

export const savePayout = (userId: string, b: PayoutInput) =>
  editStep(userId, async (tx, a) => {
    const data = {
      panEnc: encryptPii(b.pan),
      panLast4: b.pan.slice(-4),
      bankAccountEnc: encryptPii(b.bankAccount),
      bankAccountLast4: b.bankAccount.slice(-4),
      ifsc: b.ifsc,
      accountHolder: b.accountHolder,
      gstin: b.gstin,
      updatedAt: clock.now(),
    };
    await tx.astrologerKyc.upsert({
      where: { astrologerId: a.id },
      update: data,
      create: { astrologerId: a.id, ...data },
    });
  });

export const saveRates = (userId: string, b: RatesInput) =>
  editStep(userId, async (tx, a) => {
    const now = clock.now();
    for (const mode of MODES) {
      const rate = b[mode];
      if (rate === undefined) continue;
      await assertRateAllowed(a, mode, rate);
    }
    // Asking again replaces the earlier ask.
    await tx.astrologerRate.updateMany({
      where: { astrologerId: a.id, status: 'requested' },
      data: { status: 'cancelled', decidedAt: now },
    });
    for (const mode of MODES) {
      const rate = b[mode];
      if (rate !== undefined)
        await tx.astrologerRate.create({
          data: { astrologerId: a.id, mode, ratePaise: rate, status: 'requested', createdAt: now },
        });
    }
  });

/** Which required parts are missing, per step. Empty means ready to submit. */
export async function missingParts(db: Prisma.TransactionClient, a: Astrologer): Promise<string[]> {
  const missing: string[] = [];
  if (
    !a.legalName ||
    !a.displayName ||
    !a.gender ||
    !a.placeId ||
    a.languages.length === 0 ||
    a.experienceYears === null ||
    !a.photoUploadId
  ) {
    missing.push('basics');
  }
  if (
    a.methods.length === 0 ||
    !a.primaryCategory ||
    !a.bio ||
    !a.capabilitiesRequested.some((c) => c.startsWith('consult_'))
  ) {
    missing.push('expertise');
  }
  if (!a.panUploadId || !a.idType || !a.idFrontUploadId || !a.introVideoUploadId) missing.push('documents');
  if (!(await db.astrologerKyc.findUnique({ where: { astrologerId: a.id }, select: { astrologerId: true } })))
    missing.push('payout');
  const requested = await db.astrologerRate.findMany({
    where: { astrologerId: a.id, status: 'requested' },
    select: { mode: true },
  });
  const wantedModes = a.capabilitiesRequested.filter((c) => c.startsWith('consult_')).map((c) => c.slice(8));
  if (wantedModes.length === 0 || wantedModes.some((m) => !requested.some((r) => r.mode === m))) missing.push('rates');
  return missing;
}

export async function submit(userId: string, ip: string | undefined) {
  const a = await getOrCreate(userId);
  await prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<Astrologer[]>`SELECT * FROM astrologers WHERE id = ${a.id}::uuid FOR UPDATE`;
    if (!row || !EDITABLE.has(row.status))
      throw new AppError(409, 'APPLICATION_LOCKED', 'This application was already submitted.');
    const fresh = await tx.astrologer.findUniqueOrThrow({ where: { id: a.id } });
    const missing = await missingParts(tx, fresh);
    if (missing.length) throw badRequest('APPLICATION_INCOMPLETE', 'Some steps are not finished.', { missing });

    const now = clock.now();
    const resubmit = fresh.status === 'needs_changes';
    for (const docType of ['provider_conduct', 'provider_terms'] as const) {
      const has = await tx.consent.findFirst({
        where: { userId, docType, docVersion: PROVIDER_AGREEMENT_VERSION, withdrawnAt: null },
      });
      if (!has) {
        await tx.consent.create({
          data: {
            userId,
            docType,
            docVersion: PROVIDER_AGREEMENT_VERSION,
            channel: 'provider_application',
            ip,
            grantedAt: now,
          },
        });
      }
    }
    await tx.applicationFix.updateMany({ where: { astrologerId: a.id, resolvedAt: null }, data: { resolvedAt: now } });
    await tx.astrologer.update({
      where: { id: a.id },
      data: { status: 'submitted', submittedAt: now, updatedAt: now },
    });
    await tx.astrologerEvent.create({
      data: { astrologerId: a.id, type: resubmit ? 'resubmitted' : 'submitted', actor: 'astrologer', createdAt: now },
    });
  });
  return view(userId);
}

/** "Withdraw application" (X1-4): back to a draft they can edit. */
export async function withdraw(userId: string) {
  const a = await getOrCreate(userId);
  if (!['submitted', 'needs_changes', 'interview_scheduled'].includes(a.status)) {
    throw new AppError(409, 'NOTHING_TO_WITHDRAW', 'There is no application under review.');
  }
  const now = clock.now();
  await prisma.$transaction([
    prisma.astrologer.update({
      where: { id: a.id },
      data: { status: 'draft', interviewAt: null, interviewLink: null, updatedAt: now },
    }),
    prisma.astrologerEvent.create({
      data: { astrologerId: a.id, type: 'withdrawn', actor: 'astrologer', createdAt: now },
    }),
  ]);
  return view(userId);
}

/** After a rejection, once the reapply date has passed, start again from the same draft. */
export async function reapply(userId: string) {
  const a = await getOrCreate(userId);
  if (a.status !== 'rejected') throw new AppError(409, 'NOT_REJECTED', 'Only a rejected application can reapply.');
  if (a.reapplyAfter && a.reapplyAfter > clock.now()) {
    throw new AppError(409, 'REAPPLY_TOO_SOON', 'You can apply again later.', { reapplyAfter: a.reapplyAfter });
  }
  const now = clock.now();
  await prisma.$transaction([
    prisma.astrologer.update({ where: { id: a.id }, data: { status: 'draft', rejectReason: null, updatedAt: now } }),
    prisma.astrologerEvent.create({
      data: { astrologerId: a.id, type: 'reapplied', actor: 'astrologer', createdAt: now },
    }),
  ]);
  return view(userId);
}
