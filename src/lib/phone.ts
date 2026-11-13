import { decryptPii, encryptPii, hmac } from './crypto';

/** Indian mobile: 10 digits starting 6–9 (spec §8.3). Accepts an optional +91 / 91 / 0 prefix and spaces. */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '').replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const phoneHash = (mobile: string) => hmac('phone', mobile);
export const encryptPhone = (mobile: string) => encryptPii(mobile);
export const decryptPhone = (enc: string) => decryptPii(enc);

/** Display form used everywhere outside the owner's own view: +91 98•••••210 */
export function maskPhone(mobile: string): string {
  return `+91 ${mobile.slice(0, 2)}•••••${mobile.slice(-3)}`;
}
