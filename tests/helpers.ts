import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll } from 'vitest';
import { sms, type SendOtpInput, type SmsProvider } from '../src/adapters/sms';
import { createApp } from '../src/app';
import { clock } from '../src/lib/clock';
import { attachRealtime } from '../src/modules/consults/realtime';

/**
 * One server per test file, bound to 127.0.0.1 so the OS hands out a port that is free on that
 * address. (Letting supertest bind a random port per request on all interfaces can collide with
 * another local service on 127.0.0.1, which then answers instead of our app.)
 */
export const app: Server = createApp().listen(0, '127.0.0.1');
const realtime = attachRealtime(app);
afterAll(async () => {
  await (
    await realtime
  )();
  await new Promise<void>((resolve) => app.close(() => resolve()));
});

/** Captures codes instead of sending SMS; can be switched to fail. */
export class FakeSms implements SmsProvider {
  readonly name = 'fake';
  sent: SendOtpInput[] = [];
  fail = false;
  async sendOtp(input: SendOtpInput) {
    this.sent.push(input);
    return { accepted: !this.fail, providerRef: { provider: 'fake' } };
  }
  lastCode(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error('No OTP sent');
    return last.code;
  }
}

export function useFakeSms(): FakeSms {
  const fake = new FakeSms();
  sms.use(fake);
  return fake;
}

/** Freezes the server clock at `start`; returns a function to move it forward. */
export function freezeTime(start = new Date('2026-11-14T10:00:00Z')) {
  let now = start.getTime();
  clock.set(() => new Date(now));
  return (seconds: number) => {
    now += seconds * 1000;
  };
}

export const MOBILE = '9876543210';
export const DEVICE = 'device-aaaa-1111';
export const CONSENTS = { terms: true, age18: true };

export const sendOtp = (body: Record<string, unknown> = {}) =>
  request(app)
    .post('/v1/auth/otp/send')
    .send({ mobile: MOBILE, deviceId: DEVICE, ...body });

export const verifyOtp = (code: string, body: Record<string, unknown> = {}) =>
  request(app)
    .post('/v1/auth/otp/verify')
    .send({ mobile: MOBILE, code, deviceId: DEVICE, consents: CONSENTS, ...body });

/** Full login; returns the token pair and user. */
export async function login(fake: FakeSms, body: Record<string, unknown> = {}) {
  const sent = await sendOtp(body);
  if (sent.status !== 202) throw new Error(`send failed: ${sent.status} ${JSON.stringify(sent.body)}`);
  const res = await verifyOtp(fake.lastCode(), body);
  if (res.status !== 200) throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { accessToken: string; refreshToken: string; user: { id: string; isNew: boolean } };
}
