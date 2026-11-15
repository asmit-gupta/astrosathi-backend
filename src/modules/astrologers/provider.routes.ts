import { Router, type Request } from 'express';
import { authOf, requireProviderAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as application from './application.service';
import {
  availabilityBody,
  basicsBody,
  documentsBody,
  expertiseBody,
  payoutBody,
  rateChangeBody,
  ratesBody,
  revisionBody,
  submitBody,
  uploadBody,
} from './astrologers.schemas';
import * as provider from './provider.service';
import * as uploads from './uploads.service';

/** Astrologer app (/v1/provider). Only sessions signed in through the astrologer app get in. */
export const providerRouter = Router();
providerRouter.use(requireProviderAuth);

const uid = (req: Request) => authOf(req).userId;

// Uploads: ask for a link, PUT the file to it, then confirm.
providerRouter.post('/uploads', validateBody(uploadBody), async (req, res) => {
  res
    .status(201)
    .json(await uploads.createUpload(uid(req), req.body.purpose, req.body.contentType, req.body.sizeBytes));
});
providerRouter.post('/uploads/:id/complete', async (req, res) => {
  res.json(await uploads.completeUpload(uid(req), String(req.params.id)));
});

// Application (X1): one call per step, save and resume, then submit.
providerRouter.get('/application', async (req, res) => {
  res.json(await application.view(uid(req)));
});
providerRouter.put('/application/basics', validateBody(basicsBody), async (req, res) => {
  res.json(await application.saveBasics(uid(req), req.body));
});
providerRouter.put('/application/expertise', validateBody(expertiseBody), async (req, res) => {
  res.json(await application.saveExpertise(uid(req), req.body));
});
providerRouter.put('/application/documents', validateBody(documentsBody), async (req, res) => {
  res.json(await application.saveDocuments(uid(req), req.body));
});
providerRouter.put('/application/payout', validateBody(payoutBody), async (req, res) => {
  res.json(await application.savePayout(uid(req), req.body));
});
providerRouter.put('/application/rates', validateBody(ratesBody), async (req, res) => {
  res.json(await application.saveRates(uid(req), req.body));
});
providerRouter.post('/application/submit', validateBody(submitBody), async (req, res) => {
  res.json(await application.submit(uid(req), req.ip));
});
providerRouter.post('/application/withdraw', async (req, res) => {
  res.json(await application.withdraw(uid(req)));
});
providerRouter.post('/application/reapply', async (req, res) => {
  res.json(await application.reapply(uid(req)));
});

// After approval (X2, X4)
providerRouter.get('/home', async (req, res) => {
  res.json(await provider.home(uid(req)));
});
providerRouter.put('/availability', validateBody(availabilityBody), async (req, res) => {
  res.json(await provider.setAvailability(uid(req), req.body));
});
providerRouter.post('/rates', validateBody(rateChangeBody), async (req, res) => {
  res.json(await provider.requestRateChange(uid(req), req.body.mode, req.body.ratePaise));
});
providerRouter.post('/profile/revisions', validateBody(revisionBody), async (req, res) => {
  res.status(202).json(await provider.requestRevision(uid(req), req.body));
});
