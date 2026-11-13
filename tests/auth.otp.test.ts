import { prisma } from '../src/lib/prisma';
import { DEVICE, freezeTime, sendOtp, useFakeSms, verifyOtp } from './helpers';

describe('POST /v1/auth/otp/send', () => {
  it('sends a 6-digit code and stores only its hash', async () => {
    const fake = useFakeSms();
    const res = await sendOtp();

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ expiresInSeconds: 300, resendInSeconds: 30 });
    expect(fake.lastCode()).toMatch(/^\d{6}$/);
    expect(fake.sent[0]!.requestId).toBe(res.body.requestId);

    const row = await prisma.otpRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(row.codeHash).not.toContain(fake.lastCode());
    expect(row.codeHash).toHaveLength(64);
    expect(row.delivery).toBe('sent');
  });

  it('accepts +91 and spaces, rejects invalid numbers', async () => {
    useFakeSms();
    expect((await sendOtp({ mobile: '+91 98765 43210' })).status).toBe(202);

    for (const mobile of ['5876543210', '98765', '98765432101']) {
      const res = await sendOtp({ mobile, deviceId: `dev-${mobile}` });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toMatch(/INVALID_MOBILE|VALIDATION_FAILED/);
    }
  });

  it('enforces a 30-second resend cooldown', async () => {
    useFakeSms();
    const advance = freezeTime();
    expect((await sendOtp()).status).toBe(202);

    const blocked = await sendOtp();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('OTP_RESEND_COOLDOWN');
    expect(blocked.headers['retry-after']).toBe('30');

    advance(30);
    expect((await sendOtp()).status).toBe(202);
  });

  it('allows 3 sends per number per 15 minutes', async () => {
    useFakeSms();
    const advance = freezeTime();
    for (let i = 0; i < 3; i++) {
      expect((await sendOtp()).status).toBe(202);
      advance(31);
    }
    const blocked = await sendOtp();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('OTP_RATE_LIMITED');

    advance(15 * 60);
    expect((await sendOtp()).status).toBe(202);
  });

  it('limits sends per device across different numbers', async () => {
    useFakeSms();
    for (let i = 0; i < 5; i++) {
      expect((await sendOtp({ mobile: `987654321${i}` })).status).toBe(202);
    }
    const blocked = await sendOtp({ mobile: '9876543219' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('OTP_RATE_LIMITED');
  });

  it('reports SMS failure and does not count it toward the limit', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    fake.fail = true;
    for (let i = 0; i < 3; i++) {
      const res = await sendOtp();
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('SMS_SEND_FAILED');
      advance(31);
    }
    fake.fail = false;
    expect((await sendOtp()).status).toBe(202);
  });

  it('a new code replaces the previous one', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    await sendOtp();
    const first = fake.lastCode();
    advance(31);
    await sendOtp();
    const second = fake.lastCode();

    if (first !== second) {
      const res = await verifyOtp(first);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OTP_INVALID');
    }
    expect((await verifyOtp(second)).status).toBe(200);
  });

  it('records ip and device for abuse tracking', async () => {
    useFakeSms();
    const res = await sendOtp();
    const row = await prisma.otpRequest.findUniqueOrThrow({ where: { id: res.body.requestId } });
    expect(row.deviceId).toBe(DEVICE);
    expect(row.ip).toBeTruthy();
  });
});

describe('POST /v1/auth/otp/verify', () => {
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

  it('locks the number for 15 minutes after 5 wrong codes', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    await sendOtp();
    const bad = wrong(fake.lastCode());

    for (let left = 4; left >= 1; left--) {
      const res = await verifyOtp(bad);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: left } });
    }
    const fifth = await verifyOtp(bad);
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('OTP_LOCKED');

    // Locked: even the right code and a new send are refused.
    expect((await verifyOtp(fake.lastCode())).body.error.code).toBe('OTP_LOCKED');
    advance(60);
    expect((await sendOtp()).body.error.code).toBe('OTP_LOCKED');

    advance(15 * 60);
    expect((await sendOtp()).status).toBe(202);
    expect((await verifyOtp(fake.lastCode())).status).toBe(200);
  });

  it('expires codes after 5 minutes', async () => {
    const fake = useFakeSms();
    const advance = freezeTime();
    await sendOtp();
    advance(5 * 60);
    const res = await verifyOtp(fake.lastCode());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('a code works only once', async () => {
    const fake = useFakeSms();
    await sendOtp();
    expect((await verifyOtp(fake.lastCode())).status).toBe(200);
    const again = await verifyOtp(fake.lastCode());
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('OTP_NOT_REQUESTED');
  });

  it('requires terms and 18+ before using up the code', async () => {
    const fake = useFakeSms();
    await sendOtp();

    const res = await verifyOtp(fake.lastCode(), { consents: { terms: true, age18: false } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');

    // The code is still usable once the boxes are ticked.
    expect((await verifyOtp(fake.lastCode())).status).toBe(200);
  });
});
