import { z } from 'zod';

const deviceId = z.string().trim().min(8).max(128);

export const sendOtpBody = z.object({
  mobile: z.string().trim().min(10).max(16),
  deviceId,
});

export const verifyOtpBody = z.object({
  mobile: z.string().trim().min(10).max(16),
  code: z.string().regex(/^\d{6}$/, 'must be 6 digits'),
  deviceId,
  platform: z.enum(['android', 'ios', 'web']).optional(),
  appVersion: z.string().max(32).optional(),
  language: z.enum(['hi', 'en']).optional(),
  // Which app is signing in. Each app has its own session, so the astrologer app never signs out the user app.
  app: z.enum(['user', 'provider']).default('user'),
  // Login screen (W1 screen 5): terms and 18+ are required and start unticked; marketing is optional.
  consents: z.object({
    terms: z.literal(true, { errorMap: () => ({ message: 'Terms and Privacy Notice must be accepted' }) }),
    age18: z.literal(true, { errorMap: () => ({ message: 'You must be 18 or older' }) }),
    marketing: z.boolean().default(false),
  }),
});

export const refreshBody = z.object({
  refreshToken: z.string().min(20).max(200),
});

export type VerifyOtpBody = z.infer<typeof verifyOtpBody>;
