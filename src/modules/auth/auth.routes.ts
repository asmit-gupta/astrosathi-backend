import { Router } from 'express';
import { requireAnyAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { maskPhone, decryptPhone } from '../../lib/phone';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { refreshBody, sendOtpBody, verifyOtpBody } from './auth.schemas';
import * as auth from './auth.service';
import { revokeSession, rotateRefreshToken } from './token.service';

export const authRouter = Router();

const meta = (req: { ip?: string; header(name: string): string | undefined }) => ({
  ip: req.ip,
  userAgent: req.header('user-agent'),
});

authRouter.post('/otp/send', validateBody(sendOtpBody), async (req, res) => {
  res.status(202).json(await auth.requestOtp(req.body, meta(req)));
});

authRouter.post('/otp/verify', validateBody(verifyOtpBody), async (req, res) => {
  res.json(await auth.login(req.body, meta(req)));
});

authRouter.post('/token/refresh', validateBody(refreshBody), async (req, res) => {
  res.json(await rotateRefreshToken(req.body.refreshToken));
});

authRouter.post('/logout', requireAnyAuth, async (req, res) => {
  await revokeSession(req.auth!.sessionId, 'logout');
  res.status(204).end();
});

/** Who am I signed in as. The full profile lives in the users module (GET /v1/me). */
authRouter.get('/session', requireAnyAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { id: true, phoneEnc: true, name: true, language: true, status: true, roles: true },
  });
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');
  const { phoneEnc, ...rest } = user;
  res.json({ sessionId: req.auth!.sessionId, user: { ...rest, phone: maskPhone(decryptPhone(phoneEnc)) } });
});
