/**
 * Contact details and off-app payment talk are masked in chat (handoff §6), so deals stay in the app.
 * Patterns are narrow on purpose: dates and birth times must pass untouched.
 */
const PATTERNS: RegExp[] = [
  /(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/g, // Indian mobile numbers
  /\b[\w.+-]{2,}@[a-z][\w-]{1,}(?:\.[a-z]{2,})*\b/gi, // emails and UPI IDs
  /(?<![\w@])@[a-z0-9_.]{3,}/gi, // social handles
  /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|in|net|org|me|link|ly)\b\S*/gi, // links
  /\b(?:whats\s?app|telegram|insta(?:gram)?|g\s?pay|google\s?pay|phone\s?pe|paytm|upi)\b/gi,
  /\bpay\s+(?:me\s+)?(?:directly|direct|outside|separately)\b/gi,
];

export function maskContacts(text: string): { text: string; flagged: boolean } {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, '•••');
  return { text: out, flagged: out !== text };
}
