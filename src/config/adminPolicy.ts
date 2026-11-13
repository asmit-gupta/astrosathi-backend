/** Admin security limits. Kept in code on purpose: settings can't weaken their own protection. */
export const adminPolicy = {
  sessionIdleSeconds: 30 * 60,
  sessionMaxSeconds: 12 * 60 * 60,
  stepUpSeconds: 5 * 60,
  loginFailures: { max: 5, windowSeconds: 15 * 60 }, // per IP
} as const;
