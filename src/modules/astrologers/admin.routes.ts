import { Router, type Request } from 'express';
import { z } from 'zod';
import { badRequest } from '../../lib/errors';
import { adminClientIp, adminOf, requireStepUp } from '../../middleware/adminAuth';
import { validateBody } from '../../middleware/validate';
import {
  approveBody,
  decisionBody,
  documentReviewBody,
  fixesBody,
  interviewBody,
  listQuery,
  reasonBody,
} from './astrologers.schemas';
import * as rateRequests from './rateRequests.service';
import * as review from './review.service';
import * as revisions from './revisions.service';

/** Admin review (board Y2), mounted inside /admin/v1 after the admin session check. */
export const adminAstrologersRouter = Router();

const actor = (req: Request): review.Actor => ({
  adminId: adminOf(req).adminId,
  ip: adminClientIp(req),
  userAgent: req.header('user-agent'),
});
const id = (req: Request) => {
  const v = String(req.params.id);
  if (!z.string().uuid().safeParse(v).success) throw badRequest('VALIDATION_FAILED', 'Invalid id');
  return v;
};

adminAstrologersRouter.get('/astrologers', async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) throw badRequest('VALIDATION_FAILED', 'Invalid filters');
  res.json(await review.list(parsed.data));
});

adminAstrologersRouter.get('/astrologers/:id', async (req, res) => {
  res.json(await review.detail(id(req)));
});

adminAstrologersRouter.post('/astrologers/:id/kyc/reveal', requireStepUp, async (req, res) => {
  res.json(await review.revealKyc(id(req), actor(req)));
});

adminAstrologersRouter.post(
  '/astrologers/:id/documents/:uploadId/review',
  validateBody(documentReviewBody),
  async (req, res) => {
    const uploadId = String(req.params.uploadId);
    if (!z.string().uuid().safeParse(uploadId).success) throw badRequest('VALIDATION_FAILED', 'Invalid document id');
    res.json(await review.reviewDocument(id(req), uploadId, req.body, actor(req)));
  },
);

adminAstrologersRouter.post('/astrologers/:id/fixes', validateBody(fixesBody), async (req, res) => {
  res.json(await review.requestFixes(id(req), req.body.items, actor(req)));
});

adminAstrologersRouter.post('/astrologers/:id/interview', validateBody(interviewBody), async (req, res) => {
  res.json(await review.scheduleInterview(id(req), req.body, actor(req)));
});

adminAstrologersRouter.post('/astrologers/:id/approve', requireStepUp, validateBody(approveBody), async (req, res) => {
  res.json(await review.approve(id(req), req.body, actor(req)));
});

adminAstrologersRouter.post('/astrologers/:id/reject', validateBody(reasonBody), async (req, res) => {
  res.json(await review.reject(id(req), req.body, actor(req)));
});

adminAstrologersRouter.post('/astrologers/:id/suspend', requireStepUp, validateBody(reasonBody), async (req, res) => {
  res.json(await review.suspend(id(req), req.body.reason, actor(req)));
});

adminAstrologersRouter.post('/astrologers/:id/reinstate', requireStepUp, validateBody(reasonBody), async (req, res) => {
  res.json(await review.reinstate(id(req), req.body.reason, actor(req)));
});

adminAstrologersRouter.get('/astrologer-revisions', async (_req, res) => {
  res.json({ items: await revisions.listRevisions() });
});

adminAstrologersRouter.post('/astrologer-revisions/:id/decide', validateBody(decisionBody), async (req, res) => {
  res.json(await revisions.decideRevision(id(req), req.body, actor(req)));
});

adminAstrologersRouter.get('/astrologer-rate-requests', async (_req, res) => {
  res.json({ items: await rateRequests.listRateRequests() });
});

adminAstrologersRouter.post(
  '/astrologer-rate-requests/:id/decide',
  requireStepUp,
  validateBody(decisionBody),
  async (req, res) => {
    res.json(await rateRequests.decideRate(id(req), req.body, actor(req)));
  },
);
