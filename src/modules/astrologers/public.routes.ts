import { Router } from 'express';
import { z } from 'zod';
import { astrologerPolicy } from '../../config/astrologerPolicy';
import { badRequest, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as pub from './public.service';

/** Public reference data and astrologer lists for the user app (/v1, no sign-in). */
export const astrologersPublicRouter = Router();

astrologersPublicRouter.get('/method-tags', async (_req, res) => {
  const tags = await prisma.methodTag.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ methodTags: tags.map(({ slug, nameEn, nameHi }) => ({ slug, nameEn, nameHi })) });
});

astrologersPublicRouter.get('/languages', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ languages: astrologerPolicy.languages });
});

const listQuery = z.object({
  category: z.string().max(60).optional(),
  method: z.string().max(40).optional(),
  language: z.string().max(20).optional(),
  mode: z.enum(['chat', 'voice', 'video']).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  online: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  live: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  minRatePaise: z.coerce.number().int().min(0).optional(),
  maxRatePaise: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['recommended', 'price_asc', 'price_desc', 'experience']).default('recommended'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

astrologersPublicRouter.get('/astrologers', async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) throw badRequest('VALIDATION_FAILED', 'Invalid filters');
  res.json(await pub.list(parsed.data));
});

astrologersPublicRouter.get('/astrologers/:id', async (req, res) => {
  const id = String(req.params.id);
  if (!z.string().uuid().safeParse(id).success) throw notFound('ASTROLOGER_NOT_FOUND', 'Astrologer not found');
  const a = await pub.get(id);
  if (!a) throw notFound('ASTROLOGER_NOT_FOUND', 'Astrologer not found');
  res.json(a);
});
