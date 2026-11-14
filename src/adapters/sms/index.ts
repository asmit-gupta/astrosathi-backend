import { env } from '../../config/env';
import { ApitxtSmsProvider } from './apitxt';
import { ConsoleSmsProvider } from './consoleSms';
import { Fast2SmsProvider } from './fast2sms';
import type { SmsProvider } from './SmsProvider';

export type { SmsProvider, SendOtpInput, SendOtpResult } from './SmsProvider';

function fromEnv(): SmsProvider {
  if (env.SMS_PROVIDER === 'apitxt') {
    return new ApitxtSmsProvider(env.APITXT_API_KEY!, env.APITXT_TEMPLATE_ID || undefined);
  }
  if (env.SMS_PROVIDER === 'fast2sms') {
    // Presence is guaranteed by env validation.
    return new Fast2SmsProvider(env.FAST2SMS_API_KEY!, env.FAST2SMS_OTP_TEMPLATE_ID!);
  }
  return new ConsoleSmsProvider();
}

let provider: SmsProvider = fromEnv();

export const sms = {
  get: (): SmsProvider => provider,
  /** Test-only override. */
  use: (p: SmsProvider): void => {
    provider = p;
  },
};
