import 'dotenv/config';
import { z } from 'zod';

/** `KEY=` with nothing after it means "not set". */
const blankAsUnset = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === '' ? undefined : v), t);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32),
    HASH_PEPPER: z.string().min(32),
    PII_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64-encoded'),

    SMS_PROVIDER: z.enum(['console', 'apitxt', 'fast2sms']).default('console'),
    APITXT_API_KEY: z.string().optional(),
    // Optional: SMS template id from the apitxt dashboard. Empty = account default template.
    APITXT_TEMPLATE_ID: z.string().optional(),
    FAST2SMS_API_KEY: z.string().optional(),
    FAST2SMS_OTP_TEMPLATE_ID: z.string().optional(),

    TERMS_VERSION: z.string().min(1).default('v1'),
    PRIVACY_VERSION: z.string().min(1).default('v1'),

    // Comma-separated exact browser origins allowed to call the API (e.g. http://localhost:5173). Empty = none.
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),

    // Shared with the admin panel's server so it can pass the admin's real IP (min 32 chars). Optional.
    ADMIN_PANEL_SECRET: blankAsUnset(z.string().min(32).optional()),

    // Object storage for photos, documents and intro videos (S3 or any S3-compatible service).
    // Without these, upload endpoints answer 503 STORAGE_NOT_CONFIGURED.
    STORAGE_BUCKET: blankAsUnset(z.string().optional()),
    STORAGE_REGION: blankAsUnset(z.string().default('ap-south-1')),
    STORAGE_ENDPOINT: blankAsUnset(z.string().url().optional()),
    STORAGE_ACCESS_KEY_ID: blankAsUnset(z.string().optional()),
    STORAGE_SECRET_ACCESS_KEY: blankAsUnset(z.string().optional()),

    // Which admin actions go into the audit log: empty = none, "*" = all, or a comma list such as
    // "astrologer.approved,setting.scheduled". Turned off for now by the founder; pick actions later.
    AUDIT_ACTIONS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),

    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

    // Optional comma-separated IPs allowed to reach /admin. Empty = any IP (login still needs password + TOTP).
    ADMIN_IP_ALLOWLIST: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
  })
  .superRefine((env, ctx) => {
    if (env.SMS_PROVIDER === 'apitxt' && !env.APITXT_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'APITXT_API_KEY is required when SMS_PROVIDER=apitxt' });
    }
    if (env.SMS_PROVIDER === 'fast2sms' && (!env.FAST2SMS_API_KEY || !env.FAST2SMS_OTP_TEMPLATE_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'FAST2SMS_API_KEY and FAST2SMS_OTP_TEMPLATE_ID are required when SMS_PROVIDER=fast2sms',
      });
    }
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SMS_PROVIDER=console is not allowed in production' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast at boot with a readable list, rather than failing on first use.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(env)'}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
