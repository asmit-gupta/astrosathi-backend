import { logger } from '../../lib/logger';
import type { SendOtpInput, SendOtpResult, SmsProvider } from './SmsProvider';

/** Development only: prints the code to the server log. Blocked in production by env validation. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';

  async sendOtp({ mobile, code, requestId }: SendOtpInput): Promise<SendOtpResult> {
    // Deliberately outside the redacted keys so developers can log in locally.
    logger.warn(`[dev sms] OTP for ******${mobile.slice(-4)} is ${code} (request ${requestId})`);
    return { accepted: true, providerRef: { provider: 'console' } };
  }
}
