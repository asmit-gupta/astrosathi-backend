import { z } from 'zod';
import { activeLanguageCodes, astrologerPolicy } from '../../config/astrologerPolicy';
import { personName } from '../../lib/validation';

const p = astrologerPolicy;
const uuid = z.string().uuid();

// Step 1 · Basics (X1-1)
export const basicsBody = z.object({
  legalName: personName(100),
  displayName: personName(p.displayName.max),
  gender: z.enum(['female', 'male', 'other']),
  placeId: z.number().int().positive(),
  languages: z
    .array(z.string().refine((c) => activeLanguageCodes.includes(c), 'not an available language'))
    .min(1)
    .max(5),
  experienceYears: z.number().int().min(p.experienceYears.min).max(p.experienceYears.max),
  photoUploadId: uuid,
});

const methods = z.array(z.string().min(1).max(40)).min(1).max(p.maxMethods);

// Step 2 · Speciality and what you want to offer (X1-2)
export const expertiseBody = z
  .object({
    methods,
    primaryCategory: z.string().min(1).max(60),
    secondaryCategories: z.array(z.string().min(1).max(60)).max(p.maxSecondaryCategories).default([]),
    capabilities: z.array(z.enum(p.capabilities)).min(1),
    bio: z.string().trim().min(p.bio.min).max(p.bio.max),
  })
  .refine((b) => b.capabilities.some((c) => c.startsWith('consult_')), {
    message: 'choose at least one of chat, voice or video consults',
    path: ['capabilities'],
  })
  .refine((b) => !b.secondaryCategories.includes(b.primaryCategory), {
    message: 'the primary category cannot also be secondary',
    path: ['secondaryCategories'],
  });

// Step 3 · Documents (X1-3)
export const documentsBody = z.object({
  panUploadId: uuid,
  idType: z.enum(['aadhaar', 'passport', 'driving_licence', 'voter_id']),
  idFrontUploadId: uuid,
  idBackUploadId: uuid.nullable().default(null),
  proofUploadId: uuid.nullable().default(null),
  introVideoUploadId: uuid,
});

// Step 4 · Bank account (X1-3). PAN is needed for TDS; bank name is checked against it by the admin.
export const payoutBody = z.object({
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'not a valid PAN'),
  bankAccount: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, 'account number must be 9 to 18 digits'),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'not a valid IFSC'),
  accountHolder: z.string().trim().min(2).max(100).nullable().default(null),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'not a valid GSTIN')
    .nullable()
    .default(null),
});

// Step 5 · Rates in paise per minute (X1-3). One for each consult mode chosen in step 2.
const paise = z.number().int().positive();
export const ratesBody = z
  .object({ chat: paise.optional(), voice: paise.optional(), video: paise.optional() })
  .refine((r) => Object.keys(r).length > 0, 'set at least one rate');

export const submitBody = z.object({
  agreements: z.object({
    conduct: z.literal(true, { errorMap: () => ({ message: 'The code of conduct must be accepted' }) }),
    terms: z.literal(true, { errorMap: () => ({ message: 'The commercial terms must be accepted' }) }),
  }),
});

export const uploadBody = z.object({
  purpose: z.enum(['photo', 'pan', 'id_front', 'id_back', 'experience_proof', 'intro_video']),
  contentType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
});

// After approval (X2-1, X4-2)
export const availabilityBody = z.object({
  chat: z.boolean().optional(),
  voice: z.boolean().optional(),
  video: z.boolean().optional(),
  /** "Away for a bit": 15, 30 or 60 minutes; null comes back now. */
  awayMinutes: z
    .number()
    .int()
    .refine((m) => (p.awayMinutes as readonly number[]).includes(m), 'choose 15, 30 or 60')
    .nullable()
    .optional(),
});

export const revisionBody = z
  .object({
    displayName: personName(p.displayName.max).optional(),
    bio: z.string().trim().min(p.bio.min).max(p.bio.max).optional(),
    photoUploadId: uuid.optional(),
    languages: basicsBody.shape.languages.optional(),
    methods: methods.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'nothing to change');

export const rateChangeBody = z.object({ mode: z.enum(['chat', 'voice', 'video']), ratePaise: paise });

// Admin (Y2)
export const listQuery = z.object({
  status: z
    .enum(['draft', 'submitted', 'needs_changes', 'interview_scheduled', 'approved', 'rejected', 'suspended'])
    .optional(),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const FIX_FIELDS = [
  'legalName',
  'displayName',
  'gender',
  'place',
  'languages',
  'experienceYears',
  'photo',
  'methods',
  'categories',
  'capabilities',
  'bio',
  'pan',
  'id',
  'proof',
  'introVideo',
  'bank',
  'rates',
] as const;

export const fixesBody = z.object({
  items: z
    .array(z.object({ field: z.enum(FIX_FIELDS), message: z.string().trim().min(5).max(300) }))
    .min(1)
    .max(10),
});

export const documentReviewBody = z
  .object({ status: z.enum(['verified', 'rejected']), note: z.string().trim().max(300).nullable().default(null) })
  .refine((b) => b.status === 'verified' || (b.note && b.note.length >= 5), {
    message: 'say what is wrong so the astrologer can fix it',
    path: ['note'],
  });

export const interviewBody = z.object({
  at: z.coerce.date(),
  link: z.string().url().startsWith('https://').max(300),
});

export const approveBody = z.object({
  primaryCategory: z.string().min(1).max(60),
  secondaryCategories: z.array(z.string().min(1).max(60)).max(astrologerPolicy.maxSecondaryCategories).default([]),
  capabilities: z.array(z.enum(astrologerPolicy.capabilities)).min(1),
  rates: z.object({ chat: paise.optional(), voice: paise.optional(), video: paise.optional() }),
  /** Explicit checks, not a gut feeling: approval is refused unless both are ticked (Y2 note 3). */
  checks: z.object({ panNameMatchesBank: z.literal(true), faceMatchesId: z.literal(true) }),
  note: z.string().trim().max(500).optional(),
});

export const reasonBody = z.object({
  reason: z.string().trim().min(5).max(500),
  reapplyAfterDays: z.number().int().min(0).max(365).optional(),
});

export const decisionBody = z
  .object({ approve: z.boolean(), note: z.string().trim().max(300).nullable().default(null) })
  .refine((b) => b.approve || (b.note && b.note.length >= 5), { message: 'say why', path: ['note'] });

export type BasicsInput = z.infer<typeof basicsBody>;
export type ExpertiseInput = z.infer<typeof expertiseBody>;
export type DocumentsInput = z.infer<typeof documentsBody>;
export type PayoutInput = z.infer<typeof payoutBody>;
export type RatesInput = z.infer<typeof ratesBody>;
export type RevisionInput = z.infer<typeof revisionBody>;
