import { z } from 'zod';
import { usersPolicy } from '../../config/usersPolicy';
import { isRealDate } from '../../lib/dates';

// Letters (any script, incl. Devanagari with its vowel signs), spaces, dot, apostrophe, hyphen.
const personName = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, 'only letters and spaces');

export const updateMeBody = z
  .object({
    name: personName.optional(),
    language: z.enum(['hi', 'en']).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'nothing to update');

const tobAccuracy = z.enum(['exact', 'morning', 'afternoon', 'evening', 'night', 'unknown']);

const birthFields = {
  label: z.string().trim().min(1).max(30),
  name: personName,
  gender: z.enum(['female', 'male', 'other', 'undisclosed']),
  dob: z.string().refine(isRealDate, 'must be a real date, YYYY-MM-DD'),
  tob: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM, 24-hour')
    .nullable(),
  tobAccuracy,
  placeId: z.number().int().positive(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'other']).nullable(),
  occupation: z.string().trim().max(60).nullable(),
};

// The exact time and the "I don't know" windows are mutually exclusive.
const tobConsistent = (b: { tob?: string | null; tobAccuracy?: string }) =>
  b.tobAccuracy === undefined || (b.tobAccuracy === 'exact') === (b.tob !== null && b.tob !== undefined);
const tobMessage = { message: 'tob is required when tobAccuracy is exact, and must be null otherwise', path: ['tob'] };

export const createBirthProfileBody = z
  .object({
    ...birthFields,
    isSelf: z.boolean().default(false),
    maritalStatus: birthFields.maritalStatus.default(null),
    occupation: birthFields.occupation.default(null),
    tob: birthFields.tob.default(null),
  })
  .refine(tobConsistent, tobMessage);

export const updateBirthProfileBody = z
  .object(birthFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'nothing to update');

export const preferencesBody = z.object({
  // Q1 "Not sure" = empty list. Slugs are checked against active categories.
  topics: z.array(z.string()).max(3).default([]),
  languages: z.array(z.enum(['hi', 'en', 'hinglish'])).max(2).default([]),
  modes: z.array(z.enum(['chat', 'voice', 'video', 'live'])).max(4).default([]),
  budgetBand: z.enum(['under_20', 'from_20_to_50', 'from_50_to_100', 'above_100', 'no_preference']).nullable().default(null),
  genderPref: z.enum(['woman', 'man', 'no_preference']).nullable().default(null),
  firstTime: z.enum(['many', 'few', 'never']).nullable().default(null),
  showEveryone: z.boolean().default(false),
  skipped: z.boolean().default(false),
  source: z.enum(['device_sync', 'account']),
  // Spec §8.2.1: the user chooses to save answers to the account.
  consent: z.literal(true, { errorMap: () => ({ message: 'consent is required to save preferences' }) }),
});

export const preferencesPatchBody = z.object({ showEveryone: z.boolean() });

export const marketingBody = z.object({ granted: z.boolean() });

export const MIN_AGE = usersPolicy.minAgeYears;
export type CreateBirthProfile = z.infer<typeof createBirthProfileBody>;
export type UpdateBirthProfile = z.infer<typeof updateBirthProfileBody>;
export type PreferencesInput = z.infer<typeof preferencesBody>;
