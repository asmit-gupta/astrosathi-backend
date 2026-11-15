import { z } from 'zod';

/**
 * Every business number lives here (board Y13: "not in code"). Code holds only the
 * definition and default; the value in force comes from the settings table.
 * Money is in paise (₹1 = 100) so maths stays in integers.
 *
 * Rule: modules that start something long-lived (a consult session, a pack) must
 * snapshot the values they use at start, so a change never alters work in progress.
 */
const paise = z.number().int().min(0);
const pct = z.number().int().min(0).max(100);
const positiveInt = z.number().int().positive();

const def = <T extends z.ZodTypeAny>(group: string, description: string, schema: T, defaultValue: z.infer<T>) => ({
  group,
  description,
  schema,
  defaultValue,
});

export const SETTINGS = {
  // Money
  platform_share_pct: def('money', 'Platform share of every consult, pack and puja (handoff D1, D14)', pct, 40),
  topup_min_paise: def('money', 'Smallest wallet top-up (handoff D6)', paise, 5_000),
  topup_max_paise: def('money', 'Largest single wallet top-up (handoff D6)', paise, 1_000_000),
  topup_slabs_paise: def(
    'money',
    'Slab amounts suggested on Add money; never pre-selected (handoff D6)',
    z.array(paise).min(1).max(8),
    [10_000, 30_000, 50_000, 100_000, 200_000],
  ),
  spend_daily_default_paise: def('money', 'Default daily spend limit for new users', paise, 200_000),
  spend_monthly_default_paise: def('money', 'Default monthly spend limit for new users', paise, 800_000),
  refund_step_up_threshold_paise: def(
    'money',
    'Refunds above this need a fresh authenticator code (replaces the second approver)',
    paise,
    50_000,
  ),

  // Astrologers
  new_astrologer_rate_cap_paise: def('astrologers', 'Max per-minute rate for new astrologers (handoff D9)', paise, 5_000),
  new_astrologer_cap_days: def('astrologers', 'How long the new-astrologer cap lasts (handoff D9)', positiveInt, 90),
  rate_rise_review_pct: def('astrologers', 'Rate rises above this % go to Admin review', pct, 20),
  rate_min_paise: def('astrologers', 'Lowest per-minute rate an astrologer can set', paise, 500),

  // Sessions
  request_timeout_seconds: def('sessions', 'Time an astrologer has to accept a request', positiveInt, 30),
  reconnect_window_seconds: def('sessions', 'Time to rejoin after a disconnect; billing paused meanwhile', positiveInt, 120),
  checkin_interval_minutes: def('sessions', '"Continue?" check-in interval', positiveInt, 15),
  min_balance_minutes: def('sessions', 'Minutes of balance needed to start a session', positiveInt, 5),

  // Packs and puja
  pack_validity_days: def('packs', 'Default pack validity (handoff D8)', positiveInt, 60),
  pandit_share_pct: def('puja', 'Pandit share of a puja booking (handoff D12)', pct, 60),
  puja_free_cancel_hours: def('puja', 'Free cancellation until this many hours before the puja', positiveInt, 12),
  puja_auto_release_hours: def('puja', 'Release payment to the pandit if the client does not respond', positiveInt, 24),

  // Referral
  referral_reward_paise: def('referral', 'Credit for each side (handoff D13)', paise, 10_000),
  referral_min_topup_paise: def('referral', "Friend's first top-up needed to trigger the reward", paise, 50_000),
  referral_max_per_user: def('referral', 'Max rewarded referrals per user', positiveInt, 20),
  referral_credit_validity_days: def('referral', 'Referral credit expiry', positiveInt, 60),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]['schema']>;

export const isSettingKey = (k: string): k is SettingKey => Object.hasOwn(SETTINGS, k);
