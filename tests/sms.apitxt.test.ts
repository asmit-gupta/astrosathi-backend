import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApitxtSmsProvider } from '../src/adapters/sms/apitxt';

const input = { mobile: '9876543210', code: '482913', ttlMinutes: 5, requestId: 'req_1' };

function mockFetch(status: number, body: string) {
  const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(body, { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('apitxt SMS provider', () => {
  it('POSTs a form with country-coded mobile, never a GET with secrets in the URL', async () => {
    const fn = mockFetch(
      200,
      JSON.stringify({
        status: 'success',
        message: 'Sms OTP Sent Successfully',
        data: { request_id: 'SMS-OTP-A1', mobile: '919876543210', cost: 0.25 },
      }),
    );
    const res = await new ApitxtSmsProvider('KEY123', '42').sendOtp(input);

    const [url, init] = fn.mock.calls[0]!;
    expect(url).toBe('https://apitxt.com/api/sendOTP');
    expect(init?.method).toBe('POST');
    const form = new URLSearchParams(init?.body as URLSearchParams);
    expect(Object.fromEntries(form)).toEqual({
      authkey: 'KEY123',
      mobile: '919876543210',
      otp: '482913',
      channel: 'sms',
      country: '91',
      template_id: '42',
    });
    expect(res.accepted).toBe(true);
    expect(res.providerRef?.providerRequestId).toBe('SMS-OTP-A1');
  });

  it('omits template_id when none is configured', async () => {
    const fn = mockFetch(200, JSON.stringify({ status: 'success' }));
    await new ApitxtSmsProvider('KEY123').sendOtp(input);
    expect(new URLSearchParams(fn.mock.calls[0]![1]?.body as URLSearchParams).has('template_id')).toBe(false);
  });

  it('treats a 200 without status "success" as not accepted, and scrubs the code and key', async () => {
    mockFetch(200, JSON.stringify({ status: 'error', message: 'bad key KEY123 for otp 482913' }));
    const res = await new ApitxtSmsProvider('KEY123').sendOtp(input);
    expect(res.accepted).toBe(false);
    expect(String(res.providerRef?.body)).not.toContain('482913');
    expect(String(res.providerRef?.body)).not.toContain('KEY123');
  });

  it('handles HTTP errors, non-JSON bodies and network failures', async () => {
    mockFetch(500, '<html>oops</html>');
    expect((await new ApitxtSmsProvider('K').sendOtp(input)).accepted).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    );
    const res = await new ApitxtSmsProvider('K').sendOtp(input);
    expect(res.accepted).toBe(false);
    expect(res.providerRef?.error).toBe('ECONNRESET');
  });
});
