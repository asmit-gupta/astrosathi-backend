/**
 * Auth limits from handoff §3A and spec §8.3.
 * These move to the versioned settings module (Admin → Settings) once it exists;
 * until then they live here so every rule has one home.
 */
export const authPolicy = {
  otp: {
    length: 6,
    ttlSeconds: 5 * 60, // handoff §3A rule 1: 5 minutes, not Fast2SMS's 15-minute default
    maxVerifyAttempts: 5, // per code; hitting it locks the number
    lockSeconds: 15 * 60, // spec §8.3: lock for 15 minutes after 5 wrong tries
    resendCooldownSeconds: 30,
    perPhone: { max: 3, windowSeconds: 15 * 60 },
    perDevice: { max: 5, windowSeconds: 60 * 60 },
    perIp: { max: 20, windowSeconds: 60 * 60 },
  },
  tokens: {
    accessTtlSeconds: 15 * 60,
    refreshTtlSeconds: 60 * 24 * 60 * 60, // 60 days of inactivity signs the user out
  },
} as const;
