/** Astrologer onboarding rules (boards X1, X4; spec §7.10, §9.2). Business numbers that change live in Settings. */
export const astrologerPolicy = {
  bio: { min: 50, max: 300 },
  displayName: { min: 2, max: 60 },
  maxMethods: 6,
  maxSecondaryCategories: 3,
  experienceYears: { min: 0, max: 60 },
  /** Consultation languages. Only `active` ones can be picked today (spec §7.9). */
  languages: [
    { code: 'hi', nameEn: 'Hindi', nameHi: 'हिंदी', active: true },
    { code: 'en', nameEn: 'English', nameHi: 'अंग्रेज़ी', active: true },
    { code: 'hinglish', nameEn: 'Hinglish', nameHi: 'हिंग्लिश', active: true },
    { code: 'bn', nameEn: 'Bengali', nameHi: 'बांग्ला', active: false },
    { code: 'ta', nameEn: 'Tamil', nameHi: 'तमिल', active: false },
    { code: 'te', nameEn: 'Telugu', nameHi: 'तेलुगु', active: false },
    { code: 'mr', nameEn: 'Marathi', nameHi: 'मराठी', active: false },
    { code: 'gu', nameEn: 'Gujarati', nameHi: 'गुजराती', active: false },
    { code: 'kn', nameEn: 'Kannada', nameHi: 'कन्नड़', active: false },
    { code: 'ml', nameEn: 'Malayalam', nameHi: 'मलयालम', active: false },
    { code: 'pa', nameEn: 'Punjabi', nameHi: 'पंजाबी', active: false },
  ],
  /** Capability flags (spec §7.10). Consult modes are the default; the rest need separate approval. */
  capabilities: [
    'consult_chat',
    'consult_voice',
    'consult_video',
    'host_live',
    'recommend_items',
    'write_reports',
  ] as const,
  /** Claims an astrologer may not make in their bio (spec §9.2 step 3). Checked automatically and by the admin. */
  bannedClaims: [
    /guarantee/i,
    /100\s*%/,
    /accurate/i,
    /24\s*(hours|hrs)/i,
    /any problem/i,
    /\bcure\b/i,
    /black\s*magic/i,
    /vashikaran/i,
    /\+?\d[\d\s-]{8,}\d/, // phone numbers
    /https?:\/\/|www\./i, // links
    /@[a-z0-9_.]{3,}/i, // handles and emails
  ],
  /** "Away for a bit" choices (X2-1). */
  awayMinutes: [15, 30, 60],
  rejectReapplyDays: 30,
  /** Rate changes that don't need review take effect after this delay, so prices don't jump overnight (spec §9.10). */
  rateChangeDelayHours: 24,
  uploads: {
    linkTtlSeconds: 600,
    viewTtlSeconds: 600,
    byPurpose: {
      photo: { maxBytes: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
      pan: { maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
      id_front: { maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
      id_back: { maxBytes: 8 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
      experience_proof: {
        maxBytes: 8 * 1024 * 1024,
        types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      },
      intro_video: { maxBytes: 80 * 1024 * 1024, types: ['video/mp4', 'video/quicktime', 'video/webm'] },
    },
  },
} as const;

export type Capability = (typeof astrologerPolicy.capabilities)[number];
export const activeLanguageCodes = astrologerPolicy.languages.filter((l) => l.active).map((l) => l.code) as string[];
