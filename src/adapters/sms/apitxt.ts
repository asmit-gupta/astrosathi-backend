import { logger } from '../../lib/logger';
import type { SendOtpInput, SendOtpResult, SmsProvider } from './SmsProvider';

const ENDPOINT = 'https://apitxt.com/api/sendOTP';
const TIMEOUT_MS = 10_000;

/**
 * apitxt Unified OTP API (docs read 14 Nov 2026):
 * POST form-encoded { authkey, mobile, otp, channel, template_id?, country }.
 * We generate the code; they deliver it. Success body:
 * { status: "success", message, data: { request_id, mobile, cost } }.
 *
 * Always POST: GET would put the key and the code in URLs (proxy/APM logs).
 * Without template_id the account's default SMS template is used.
 * TODO: map their error codes (not in the docs we have) and add a delivery-status check if they offer one.
 */
export class ApitxtSmsProvider implements SmsProvider {
  readonly name = 'apitxt';

  constructor(
    private readonly authKey: string,
    private readonly templateId?: string,
  ) {}

  async sendOtp({ mobile, code, requestId }: SendOtpInput): Promise<SendOtpResult> {
    const form = new URLSearchParams({
      authkey: this.authKey,
      mobile: `91${mobile}`,
      otp: code,
      channel: 'sms',
      country: '91',
    });
    if (this.templateId) form.set('template_id', this.templateId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: form,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: { status?: unknown; message?: unknown; data?: { request_id?: unknown } } | undefined;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      const accepted = res.ok && json?.status === 'success';
      const providerRef = {
        provider: this.name,
        status: res.status,
        providerRequestId: typeof json?.data?.request_id === 'string' ? json.data.request_id : undefined,
        ourRequestId: requestId,
        body: scrub(text, [code, this.authKey]),
      };
      if (!accepted) logger.error({ providerRef }, 'apitxt rejected OTP send');
      return { accepted, providerRef };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'apitxt request failed');
      return { accepted: false, providerRef: { provider: this.name, error: (err as Error).message } };
    } finally {
      clearTimeout(timer);
    }
  }
}

function scrub(body: string, secrets: string[]): string {
  return secrets.reduce((b, s) => b.split(s).join('******'), body.slice(0, 2000));
}
