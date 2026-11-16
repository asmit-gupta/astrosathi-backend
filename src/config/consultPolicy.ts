/** Consult rules that are code, not business settings (those live in the settings registry). */
export const consultPolicy = {
  /** Billing: every started minute (founder, 16 Nov 2026). */
  billingSeconds: 60,
  /** Long messages are split by the app; kept small so a realtime event fits one Postgres NOTIFY. */
  maxMessageChars: 1000,
  /** How often the billing and timeout sweep runs on each server. */
  sweepEveryMs: 2_000,
  messagesPage: 200,
};
