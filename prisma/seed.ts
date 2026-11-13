/**
 * Reference data seed. Idempotent and insert-only: re-running adds missing rows
 * and never overwrites edits made later in Admin. Safe to run on production.
 *   npm run db:seed   (runs prisma/run-seed.ts)
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Spec §7.10: the nine topic categories. Health is deliberately not a category (§7.9).
export const CATEGORIES = [
  { slug: 'love-relationships', nameEn: 'Love & Relationships', nameHi: 'प्रेम और रिश्ते' },
  { slug: 'marriage-kundli-matching', nameEn: 'Marriage & Kundli Matching', nameHi: 'विवाह और कुंडली मिलान' },
  { slug: 'career-job', nameEn: 'Career & Job', nameHi: 'करियर और नौकरी' },
  { slug: 'business-money', nameEn: 'Business & Money', nameHi: 'व्यापार और धन' },
  { slug: 'education-exams', nameEn: 'Education & Exams', nameHi: 'शिक्षा और परीक्षा' },
  { slug: 'family-children', nameEn: 'Family & Children', nameHi: 'परिवार और बच्चे' },
  { slug: 'property-vastu-home', nameEn: 'Property, Vastu & Home', nameHi: 'संपत्ति, वास्तु और घर' },
  { slug: 'travel-relocation', nameEn: 'Travel & Relocation', nameHi: 'यात्रा और स्थानांतरण' },
  { slug: 'general-guidance', nameEn: 'General Life Guidance', nameHi: 'सामान्य जीवन मार्गदर्शन' },
];

function readPlaces() {
  const file = new URL('./seed-data/places-in.tsv', import.meta.url);
  const [, ...lines] = readFileSync(file, 'utf8').trimEnd().split('\n');
  return lines.map((line) => {
    const [id, name, asciiName, aliasHi, state, lat, lng, tzId, population] = line.split('\t');
    return {
      id: Number(id),
      name: name!,
      asciiName: asciiName!,
      aliasHi: aliasHi || null,
      state: state!,
      searchName: asciiName!.toLowerCase(),
      lat: lat!,
      lng: lng!,
      tzId: tzId!,
      population: Number(population),
    };
  });
}

export async function seed(prisma: PrismaClient) {
  const categories = await prisma.category.createMany({
    data: CATEGORIES.map((c, i) => ({ ...c, sortOrder: i + 1 })),
    skipDuplicates: true,
  });

  const places = readPlaces();
  let placesAdded = 0;
  for (let i = 0; i < places.length; i += 1000) {
    const res = await prisma.place.createMany({ data: places.slice(i, i + 1000), skipDuplicates: true });
    placesAdded += res.count;
  }
  return { categoriesAdded: categories.count, placesAdded, placesInFile: places.length };
}
