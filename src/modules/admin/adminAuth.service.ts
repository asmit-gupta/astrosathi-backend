import { adminPolicy } from '../../config/adminPolicy';
import { addSeconds, clock } from '../../lib/clock';
import { decryptPii, randomToken, sha256 } from '../../lib/crypto';
import { AppError, tooManyRequests, unauthorized } from '../../lib/errors';
import { hashPassword, MIN_ADMIN_PASSWORD_LENGTH, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { verifyTotp } from '../../lib/totp';
import * as audit from '../audit/audit.service';

interface Meta {
  ip: string;
  userAgent?: string;
}

// Compared against when the email is unknown, so timing doesn't reveal whether it exists.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('not-the-admin-password'));

const loginFailed = () => unauthorized('ADMIN_LOGIN_FAILED', 'Email, password or code is wrong.');

/** Accepts a TOTP code once: the step is recorded atomically, so a replay (or a parallel request) fails. */
async function consumeTotp(adminId: string, secretEnc: string, lastStep: bigint, code: string): Promise<boolean> {
  const step = verifyTotp(decryptPii(secretEnc), code, clock.now(), Number(lastStep));
  if (step === null) return false;
  const res = await prisma.admin.updateMany({
    where: { id: adminId, lastTotpStep: { lt: BigInt(step) } },
    data: { lastTotpStep: BigInt(step) },
  });
  return res.count === 1;
}

export async function login(input: { email: string; password: string; code: string }, meta: Meta) {
  const now = clock.now();
  const since = addSeconds(now, -adminPolicy.loginFailures.windowSeconds);
  const failures = await prisma.adminLoginAttempt.count({ where: { ip: meta.ip, success: false, createdAt: { gt: since } } });
  if (failures >= adminPolicy.loginFailures.max) {
    throw tooManyRequests('ADMIN_LOGIN_LOCKED', 'Too many failed attempts. Try again later.', adminPolicy.loginFailures.windowSeconds);
  }

  const admin = await prisma.admin.findUnique({ where: { email: input.email.trim().toLowerCase() } });
  const passwordOk = await verifyPassword(input.password, admin?.passwordHash ?? (await getDummyHash()));
  const ok = !!admin && passwordOk && (await consumeTotp(admin.id, admin.totpSecretEnc, admin.lastTotpStep, input.code));

  if (!ok || !admin) {
    await prisma.$transaction(async (tx) => {
      await tx.adminLoginAttempt.create({ data: { ip: meta.ip, success: false, createdAt: now } });
      await audit.record(tx, { actorType: 'admin', action: 'admin.login_failed', ip: meta.ip, userAgent: meta.userAgent });
    });
    throw loginFailed();
  }

  const token = randomToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.adminLoginAttempt.create({ data: { ip: meta.ip, success: true, createdAt: now } });
    // One admin, one live session: a new login ends any other.
    await tx.adminSession.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: now } });
    await tx.adminSession.create({
      data: {
        adminId: admin.id,
        tokenHash: sha256(token),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 256),
        createdAt: now,
        lastUsedAt: now,
        stepUpAt: now, // a code was just entered
      },
    });
    await audit.record(tx, { actorType: 'admin', actorId: admin.id, action: 'admin.login', ip: meta.ip, userAgent: meta.userAgent });
  });

  return {
    token,
    idleTimeoutSeconds: adminPolicy.sessionIdleSeconds,
    expiresAt: addSeconds(now, adminPolicy.sessionMaxSeconds),
  };
}

export interface AdminContext {
  adminId: string;
  sessionId: string;
  stepUpAt: Date | null;
}

/** Resolves a session token, enforcing idle and absolute timeouts. */
export async function authenticate(token: string): Promise<AdminContext> {
  const now = clock.now();
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.revokedAt) throw unauthorized('ADMIN_SESSION_INVALID', 'Please sign in.');

  const idleOver = addSeconds(session.lastUsedAt, adminPolicy.sessionIdleSeconds) <= now;
  const maxOver = addSeconds(session.createdAt, adminPolicy.sessionMaxSeconds) <= now;
  if (idleOver || maxOver) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: now } });
    throw unauthorized('ADMIN_SESSION_EXPIRED', 'Session expired. Please sign in again.');
  }

  // Touch at most once a minute to avoid a write per request.
  if (now.getTime() - session.lastUsedAt.getTime() > 60_000) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
  }
  return { adminId: session.adminId, sessionId: session.id, stepUpAt: session.stepUpAt };
}

export async function stepUp(ctx: AdminContext, code: string, meta: Meta) {
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: ctx.adminId } });
  if (!(await consumeTotp(admin.id, admin.totpSecretEnc, admin.lastTotpStep, code))) {
    await audit.record(prisma, { actorType: 'admin', actorId: admin.id, action: 'admin.step_up_failed', ip: meta.ip });
    throw unauthorized('ADMIN_CODE_INVALID', 'That code is not right.');
  }
  const now = clock.now();
  await prisma.adminSession.update({ where: { id: ctx.sessionId }, data: { stepUpAt: now } });
  await audit.record(prisma, { actorType: 'admin', actorId: admin.id, action: 'admin.step_up', ip: meta.ip });
  return { validUntil: addSeconds(now, adminPolicy.stepUpSeconds) };
}

export function hasFreshStepUp(ctx: AdminContext): boolean {
  return !!ctx.stepUpAt && addSeconds(ctx.stepUpAt, adminPolicy.stepUpSeconds) > clock.now();
}

export async function changePassword(ctx: AdminContext, current: string, next: string, meta: Meta) {
  if (next.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', `Use at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: ctx.adminId } });
  if (!(await verifyPassword(current, admin.passwordHash))) throw unauthorized('ADMIN_PASSWORD_WRONG', 'Current password is wrong.');

  const now = clock.now();
  const passwordHash = await hashPassword(next);
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: admin.id }, data: { passwordHash, passwordAt: now } });
    await tx.adminSession.updateMany({
      where: { adminId: admin.id, revokedAt: null, id: { not: ctx.sessionId } },
      data: { revokedAt: now },
    });
    await audit.record(tx, { actorType: 'admin', actorId: admin.id, action: 'admin.password_changed', ip: meta.ip, userAgent: meta.userAgent });
  });
}

export async function logout(ctx: AdminContext, meta: Meta) {
  await prisma.adminSession.update({ where: { id: ctx.sessionId }, data: { revokedAt: clock.now() } });
  await audit.record(prisma, { actorType: 'admin', actorId: ctx.adminId, action: 'admin.logout', ip: meta.ip });
}
