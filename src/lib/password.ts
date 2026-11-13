import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(pw, salt, len, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

// N=2^15, r=8, p=1: ~32 MB and ~100 ms per hash. Parameters are stored with the hash.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Format: scrypt$N$r$p$salt$hash (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return timingSafeEqual(key, expected);
}
