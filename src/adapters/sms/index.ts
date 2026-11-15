import { env } from '../../config/env';
import { ApitxtSmsProvider } from './apitxt';
import { ConsoleSmsProvider } from './consoleSms';
import type { SmsProvider } from './SmsProvider';

export type { SmsProvider, SendOtpInput, SendOtpResult } from './SmsProvider';

function fromEnv(): SmsProvider {
  if (env.SMS_PROVIDER === 'apitxt') {
    // Env validation already requires the key for apitxt; this keeps the type honest.
    if (!env.APITXT_API_KEY) throw new Error('APITXT_API_KEY is required when SMS_PROVIDER=apitxt');
    return new ApitxtSmsProvider(env.APITXT_API_KEY, env.APITXT_TEMPLATE_ID || undefined);
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
