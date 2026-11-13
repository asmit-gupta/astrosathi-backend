import { Router } from 'express';
import { decryptPhone, maskPhone } from '../../lib/phone';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as birthProfiles from './birthProfiles.service';
import * as preferences from './preferences.service';
import * as privacy from './privacy.service';
import {
  createBirthProfileBody,
  marketingBody,
  preferencesBody,
  preferencesPatchBody,
  updateBirthProfileBody,
  updateMeBody,
} from './users.schemas';

/** Everything under /v1/me acts on the signed-in user only. */
export const meRouter = Router();
meRouter.use(requireAuth);

const uid = (req: { auth?: { userId: string } }) => req.auth!.userId;

async function meView(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('USER_NOT_FOUND', 'User not found');
  return {
    id: user.id,
    phone: maskPhone(decryptPhone(user.phoneEnc)),
    name: user.name,
    language: user.language,
    status: user.status,
    roles: user.roles,
    createdAt: user.createdAt,
    deletion: await privacy.pendingDeletion(user.id),
  };
}

meRouter.get('/', async (req, res) => {
  res.json(await meView(uid(req)));
});

meRouter.patch('/', validateBody(updateMeBody), async (req, res) => {
  await prisma.user.update({ where: { id: uid(req) }, data: req.body });
  res.json(await meView(uid(req)));
});

// Birth profiles (spec §8.4)
meRouter.get('/birth-profiles', async (req, res) => {
  res.json({ profiles: await birthProfiles.list(uid(req)) });
});
meRouter.post('/birth-profiles', validateBody(createBirthProfileBody), async (req, res) => {
  res.status(201).json(await birthProfiles.create(uid(req), req.body));
});
meRouter.get('/birth-profiles/:id', async (req, res) => {
  res.json(await birthProfiles.get(uid(req), String(req.params.id)));
});
meRouter.patch('/birth-profiles/:id', validateBody(updateBirthProfileBody), async (req, res) => {
  res.json(await birthProfiles.update(uid(req), String(req.params.id), req.body));
});
meRouter.delete('/birth-profiles/:id', async (req, res) => {
  await birthProfiles.remove(uid(req), String(req.params.id));
  res.status(204).end();
});

// Preferences (spec §8.2.1, §7.11)
meRouter.get('/preferences', async (req, res) => {
  res.json({ preferences: await preferences.get(uid(req)) });
});
meRouter.put('/preferences', validateBody(preferencesBody), async (req, res) => {
  res.json({ preferences: await preferences.save(uid(req), req.body) });
});
meRouter.patch('/preferences', validateBody(preferencesPatchBody), async (req, res) => {
  res.json({ preferences: await preferences.setShowEveryone(uid(req), req.body.showEveryone) });
});
meRouter.delete('/preferences', async (req, res) => {
  await preferences.remove(uid(req));
  res.status(204).end();
});

// Consents and DPDP rights (spec §8.17, §14.3)
meRouter.get('/consents', async (req, res) => {
  res.json({ consents: await privacy.listConsents(uid(req)) });
});
meRouter.put('/consents/marketing', validateBody(marketingBody), async (req, res) => {
  res.json(await privacy.setMarketing(uid(req), req.body.granted, req.ip));
});
meRouter.post('/data-export', async (req, res) => {
  res.status(202).json(await privacy.requestExport(uid(req)));
});
meRouter.post('/deletion', async (req, res) => {
  res.status(202).json(await privacy.requestDeletion(uid(req)));
});
meRouter.delete('/deletion', async (req, res) => {
  await privacy.cancelDeletion(uid(req));
  res.status(204).end();
});
