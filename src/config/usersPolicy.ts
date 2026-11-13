/** Users-module limits. Move to Admin settings when that module exists. */
export const usersPolicy = {
  minAgeYears: 18, // handoff §6: 18+ only (DPDP). Applies to every birth profile (wireframe W6 note 4).
  maxBirthProfiles: 10,
  earliestBirthYear: 1900,
  deletionCoolOffDays: 7, // spec §8.17
  exportDueDays: 30, // [VERIFY] DPDP Rules response time with counsel
  preferencesConsentVersion: 'v1',
  marketingConsentVersion: 'v1',
} as const;
