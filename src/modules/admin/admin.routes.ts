import { Router, type Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { adminClientIp, adminIpAllowlist, adminOf, requireAdmin, requireStepUp } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import { adminAstrologersRouter } from '../astrologers/admin.routes';
import * as settings from '../settings/settings.service';
import * as adminAuth from './adminAuth.service';

export const adminRouter = Router();
adminRouter.use(adminIpAllowlist);

const meta = (req: Request) => ({ ip: adminClientIp(req), userAgent: req.header('user-agent') });
const code = z.string().regex(/^\d{6}$/, 'must be 6 digits');

// ---- Auth ----

const loginBody = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
  code,
});

adminRouter.post('/auth/login', validateBody(loginBody), async (req, res) => {
  res.json(await adminAuth.login(req.body, meta(req)));
});

// Everything below needs a signed-in admin.
adminRouter.use(requireAdmin);

adminRouter.get('/auth/session', async (req, res) => {
  const admin = await prisma.admin.findUniqueOrThrow({
    where: { id: adminOf(req).adminId },
    select: { id: true, email: true, passwordAt: true },
  });
  res.json({ admin, stepUpActive: adminAuth.hasFreshStepUp(adminOf(req)) });
});

adminRouter.post('/auth/step-up', validateBody(z.object({ code })), async (req, res) => {
  res.json(await adminAuth.stepUp(adminOf(req), req.body.code, meta(req)));
});

adminRouter.post('/auth/logout', async (req, res) => {
  await adminAuth.logout(adminOf(req), meta(req));
  res.status(204).end();
});

const passwordBody = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().max(256) });
adminRouter.post('/auth/password', requireStepUp, validateBody(passwordBody), async (req, res) => {
  await adminAuth.changePassword(adminOf(req), req.body.currentPassword, req.body.newPassword, meta(req));
  res.status(204).end();
});

// ---- Settings (board Y13) ----

adminRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await settings.listAll() });
});

adminRouter.get('/settings/:key/history', async (req, res) => {
  res.json({ versions: await settings.history(String(req.params.key)) });
});

const scheduleBody = z.object({
  value: z.unknown(),
  effectiveFrom: z.coerce.date().optional(),
  reason: z.string().trim().min(5).max(500),
});
adminRouter.put('/settings/:key', requireStepUp, validateBody(scheduleBody), async (req, res) => {
  const row = await settings.schedule(String(req.params.key), req.body, {
    adminId: adminOf(req).adminId,
    ...meta(req),
  });
  res.status(201).json({ version: row });
});

const cancelBody = z.object({ reason: z.string().trim().min(5).max(500) });
adminRouter.post(
  '/settings/:key/versions/:version/cancel',
  requireStepUp,
  validateBody(cancelBody),
  async (req, res) => {
    const version = Number(req.params.version);
    if (!Number.isInteger(version) || version < 1)
      throw badRequest('VALIDATION_FAILED', 'version must be a positive integer');
    const row = await settings.cancel(String(req.params.key), version, req.body.reason, {
      adminId: adminOf(req).adminId,
      ...meta(req),
    });
    res.json({ version: row });
  },
);

// ---- Astrologers (board Y2) ----

adminRouter.use(adminAstrologersRouter);
