import { Router, type Request } from 'express';
import { z } from 'zod';
import { adminOf, requireStepUp } from '../../middleware/adminAuth';
import { authOf, requireAuth, requireProviderAuth } from '../../middleware/auth';
import { notFound } from '../../lib/errors';
import { validateBody } from '../../middleware/validate';
import * as consults from './consults.service';
import * as wallet from './wallet.service';

const requestBody = z.object({
  /** The astrologer (called provider on the wire, like /v1/provider). */
  providerId: z.string().uuid(),
  mode: z.enum(['chat', 'voice', 'video']),
  birthProfileId: z.string().uuid().optional(),
});
const messageBody = z.object({ id: z.string().uuid(), body: z.string() });
const readBody = z.object({ seq: z.number().int().min(0) });
const after = (req: Request) => Math.max(0, Number(req.query.after) || 0);
const uuid = z.string().uuid();
const id = (req: Request) => {
  const v = uuid.safeParse(req.params.id);
  if (!v.success) throw notFound('CONSULT_NOT_FOUND', 'No such consult.');
  return v.data;
};

/** Chat routes both apps share; `who` turns the request into a consult party. */
function shared(router: Router, who: (req: Request) => Promise<consults.Party> | consults.Party) {
  router.get('/consults/current', async (req, res) => {
    res.json({ consult: await consults.current(await who(req)) });
  });
  router.get('/consults/:id', async (req, res) => {
    res.json(await consults.get(await who(req), id(req)));
  });
  router.post('/consults/:id/end', async (req, res) => {
    res.json(await consults.end(await who(req), id(req)));
  });
  router.get('/consults/:id/messages', async (req, res) => {
    res.json(await consults.messages(await who(req), id(req), after(req)));
  });
  router.post('/consults/:id/messages', validateBody(messageBody), async (req, res) => {
    res.status(201).json(await consults.send(await who(req), id(req), req.body.id, req.body.body));
  });
  router.post('/consults/:id/read', validateBody(readBody), async (req, res) => {
    await consults.markRead(await who(req), id(req), req.body.seq);
    res.status(204).end();
  });
}

/** User app (/v1/me): wallet and consults. */
export const userConsultsRouter = Router();
userConsultsRouter.use(['/wallet', '/consults'], requireAuth);
userConsultsRouter.get('/wallet', async (req, res) => {
  res.json(await wallet.walletView(authOf(req).userId));
});
userConsultsRouter.post('/consults', validateBody(requestBody), async (req, res) => {
  res.status(201).json(
    await consults.request(authOf(req).userId, {
      astrologerId: req.body.providerId,
      mode: req.body.mode,
      birthProfileId: req.body.birthProfileId,
    }),
  );
});
shared(userConsultsRouter, (req) => ({ side: 'user', userId: authOf(req).userId }));

/** Astrologer app (/v1/provider): accept, decline and the shared chat routes. */
export const providerConsultsRouter = Router();
providerConsultsRouter.use('/consults', requireProviderAuth);
const astrologer = (req: Request) => consults.astrologerParty(authOf(req).userId);
providerConsultsRouter.post('/consults/:id/accept', async (req, res) => {
  res.json(await consults.accept(await astrologer(req), id(req)));
});
providerConsultsRouter.post('/consults/:id/decline', async (req, res) => {
  res.json(await consults.decline(await astrologer(req), id(req)));
});
shared(providerConsultsRouter, astrologer);

/** Admin (/admin/v1): add money to a user's wallet by hand. Needs a fresh authenticator code. */
export const adminWalletRouter = Router();
const creditBody = z.object({
  mobile: z.string().min(10).max(16),
  amountPaise: z.number().int().min(100).max(1_000_000),
  reason: z.string().trim().min(3).max(200),
});
adminWalletRouter.post('/wallet-credits', requireStepUp, validateBody(creditBody), async (req, res) => {
  adminOf(req);
  res.status(201).json(await wallet.adminCredit(req.body));
});
