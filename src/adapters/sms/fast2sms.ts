import { logger } from '../../lib/logger';
import type { SendOtpInput, SendOtpResult, SmsProvider } from './SmsProvider';

const ENDPOINT = 'https://www.fast2sms.com/dev/otp/send';
const TIMEOUT_MS = 10_000;

/**
 * Fast2SMS OTP API (handoff §3A, docs read 11 Nov 2026):
 * POST /dev/otp/send, API key in the Authorization header,
 * body { mobile, otp_id, otp, otp_length, otp_expiry, udf1 }.
 * 200 = sent, 400 = validation error, 401 = bad key.
 *
 * The docs don't show the response body, so we store it raw (minus anything
 * echoing the code) and decide acceptance on HTTP status only.
 * TODO: confirm the response shape and a delivery webhook with Fast2SMS.
 */
export class Fast2SmsProvider implements SmsProvider {
  readonly name = 'fast2sms';

  constructor(
    private readonly apiKey: string,
    private readonly templateId: string,
  ) {}

  async sendOtp({ mobile, code, ttlMinutes, requestId }: SendOtpInput): Promise<SendOtpResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile,
          otp_id: this.templateId,
          otp: code,
          otp_length: code.length,
          otp_expiry: ttlMinutes,
          udf1: requestId,
        }),
        signal: controller.signal,
      });
      const text = await res.text();
      const providerRef = { provider: this.name, status: res.status, body: scrub(text, code) };
      if (!res.ok) logger.error({ providerRef }, 'Fast2SMS rejected OTP send');
      return { accepted: res.ok, providerRef };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Fast2SMS request failed');
      return { accepted: false, providerRef: { provider: this.name, error: (err as Error).message } };
    } finally {
      clearTimeout(timer);
    }
  }
}

function scrub(body: string, code: string): string {
  return body.slice(0, 2000).split(code).join('******');
}
