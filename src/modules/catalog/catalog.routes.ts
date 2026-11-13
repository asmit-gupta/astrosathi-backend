import { Router } from 'express';
import { z } from 'zod';
import { badRequest } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

/** Public reference data: visitors browse before logging in (spec §8.0). */
export const catalogRouter = Router();

catalogRouter.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { slug: true, nameEn: true, nameHi: true, descriptionEn: true, descriptionHi: true },
  });
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ categories });
});

const placeQuery = z.object({
  q: z.string().trim().min(2).max(60),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

const DEVANAGARI = /[ऀ-ॿ]/;

export const placeView = (p: {
  id: number;
  name: string;
  state: string;
  lat: { toNumber(): number };
  lng: { toNumber(): number };
  tzId: string;
}) => ({
  id: p.id,
  name: p.name,
  state: p.state,
  label: p.state ? `${p.name}, ${p.state}` : p.name,
  lat: p.lat.toNumber(),
  lng: p.lng.toNumber(),
  tzId: p.tzId,
});

/** Birth-place autocomplete. Prefix match on the English name, or on the Hindi alias for Devanagari input. */
catalogRouter.get('/places', async (req, res) => {
  const parsed = placeQuery.safeParse(req.query);
  if (!parsed.success) throw badRequest('VALIDATION_FAILED', 'q must be 2 to 60 characters');
  const { q, limit } = parsed.data;

  const where = DEVANAGARI.test(q)
    ? { aliasHi: { startsWith: q } }
    : { searchName: { startsWith: q.toLowerCase() } };
  const places = await prisma.place.findMany({ where, orderBy: { population: 'desc' }, take: limit });
  res.json({ places: places.map(placeView) });
});
