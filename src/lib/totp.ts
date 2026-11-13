import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s): what Google Authenticator, Authy, 1Password etc. use. */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

export const timeStep = (at: Date): number => Math.floor(at.getTime() / 1000 / STEP_SECONDS);

/** HOTP (RFC 4226) for a counter, with an optional digest for test vectors. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1') {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algo, secret).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return bin.toString().padStart(digits, '0');
}

export const totpAt = (secretB32: string, at: Date) => hotp(base32Decode(secretB32), timeStep(at));

/**
 * Checks a code against the current step and one step either side (clock drift).
 * Returns the matched step so the caller can refuse to accept it again, or null.
 */
export function verifyTotp(secretB32: string, code: string, at: Date, lastUsedStep: number): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = timeStep(at);
  for (const step of [now - 1, now, now + 1]) {
    if (step <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = 'AstroLive Admin'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
