/**
 * Admin account CLI. There is exactly one admin; run this on a machine with DATABASE_URL.
 *
 *   npm run admin -- create --email you@example.com
 *   npm run admin -- reset-2fa        (lost authenticator: new secret, all sessions ended)
 *   npm run admin -- reset-password   (forgot password: all sessions ended)
 *
 * Passwords are typed at a hidden prompt (or ADMIN_PASSWORD for non-interactive use).
 * Enrolling an authenticator requires typing a valid code before anything is saved.
 */
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { encryptPii } from '../src/lib/crypto';
import { hashPassword, MIN_ADMIN_PASSWORD_LENGTH } from '../src/lib/password';
import { newTotpSecret, otpauthUri, timeStep, verifyTotp } from '../src/lib/totp';

const prisma = new PrismaClient();
const AUDIT_OFF = true;

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Echo nothing while the password is typed.
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    }),
  );
}

async function readNewPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < MIN_ADMIN_PASSWORD_LENGTH) throw new Error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
    return fromEnv;
  }
  for (;;) {
    const a = await ask(`New admin password (min ${MIN_ADMIN_PASSWORD_LENGTH} chars): `, true);
    if (a.length < MIN_ADMIN_PASSWORD_LENGTH) {
      console.log('Too short.');
      continue;
    }
    const b = await ask('Repeat password: ', true);
    if (a === b) return a;
    console.log('Passwords did not match.');
  }
}

/** Shows the secret, then insists on a working code so a typo can't lock the admin out. */
async function enrolTotp(email: string): Promise<{ secretEnc: string; step: number }> {
  const secret = newTotpSecret();
  console.log('\nAdd this to your authenticator app (Google Authenticator, Authy, 1Password…):');
  console.log(`  Secret: ${secret.replace(/(.{4})/g, '$1 ').trim()}`);
  console.log(`  Or open/scan: ${otpauthUri(secret, email)}\n`);
  for (;;) {
    const code = await ask('Enter the 6-digit code the app shows: ');
    const step = verifyTotp(secret, code, new Date(), timeStep(new Date()) - 2);
    if (step !== null) return { secretEnc: encryptPii(secret), step };
    console.log('That code did not match. Check the phone clock is automatic and try again.');
  }
}

async function audit(action: string, actorId: string) {
  // Audit logging is off (founder's decision, 15 Nov 2026).
  if (AUDIT_OFF) return;
  await prisma.auditLog.create({
    data: { actorType: 'system', actorId, action, reason: 'admin CLI', createdAt: new Date() },
  });
}

async function create(email: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Pass a valid --email');
  if (await prisma.admin.count()) throw new Error('An admin already exists. Use reset-password or reset-2fa.');
  const password = await readNewPassword();
  const { secretEnc, step } = await enrolTotp(email);
  const now = new Date();
  const admin = await prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      totpSecretEnc: secretEnc,
      lastTotpStep: BigInt(step),
      createdAt: now,
      passwordAt: now,
    },
  });
  await audit('admin.created', admin.id);
  console.log(`\nAdmin created for ${admin.email}. Sign in with email, password and a fresh code.`);
}

async function resetTwoFactor() {
  const admin = await prisma.admin.findFirst();
  if (!admin) throw new Error('No admin yet. Run create first.');
  const { secretEnc, step } = await enrolTotp(admin.email);
  await prisma.$transaction([
    prisma.admin.update({ where: { id: admin.id }, data: { totpSecretEnc: secretEnc, lastTotpStep: BigInt(step) } }),
    prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit('admin.totp_reset', admin.id);
  console.log('Authenticator replaced. All admin sessions were signed out.');
}

async function resetPassword() {
  const admin = await prisma.admin.findFirst();
  if (!admin) throw new Error('No admin yet. Run create first.');
  const password = await readNewPassword();
  const now = new Date();
  await prisma.$transaction([
    prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(password), passwordAt: now } }),
    prisma.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  await audit('admin.password_reset', admin.id);
  console.log('Password replaced. All admin sessions were signed out.');
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const emailIdx = rest.indexOf('--email');
  const email = emailIdx >= 0 ? (rest[emailIdx + 1] ?? '') : '';
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://unknown').hostname;
  console.log(`Database: ${host}`);

  if (command === 'create') return create(email);
  if (command === 'reset-2fa') return resetTwoFactor();
  if (command === 'reset-password') return resetPassword();
  console.log('Usage: npm run admin -- create --email you@example.com | reset-2fa | reset-password');
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
