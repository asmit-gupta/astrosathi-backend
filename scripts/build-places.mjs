// Builds prisma/seed-data/places-in.tsv from GeoNames dumps (CC BY 4.0, https://www.geonames.org).
// Usage: node scripts/build-places.mjs <cities500.txt> <admin1CodesASCII.txt>
// Download: https://download.geonames.org/export/dump/cities500.zip and admin1CodesASCII.txt
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [citiesFile, admin1File] = process.argv.slice(2);
if (!citiesFile || !admin1File) {
  console.error('Usage: node scripts/build-places.mjs <cities500.txt> <admin1CodesASCII.txt>');
  process.exit(1);
}

const states = new Map();
for (const line of readFileSync(admin1File, 'utf8').split('\n')) {
  const [code, name] = line.split('\t');
  if (code?.startsWith('IN.')) states.set(code, name);
}

const DEVANAGARI = /[ऀ-ॿ]/;
const clean = (s) => s.replace(/[\t\n\r]/g, ' ').trim();
const rows = [];

for (const line of readFileSync(citiesFile, 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f[8] !== 'IN') continue;
  const [id, name, ascii, alternates, lat, lng] = f;
  const nameHi = (alternates ?? '').split(',').find((a) => DEVANAGARI.test(a)) ?? '';
  rows.push([
    id,
    clean(name),
    clean(ascii),
    clean(nameHi),
    clean(states.get(`IN.${f[10]}`) ?? ''),
    Number(lat).toFixed(5),
    Number(lng).toFixed(5),
    // All of India is on IST; GeoNames tags a couple of border places otherwise.
    'Asia/Kolkata',
    f[14] || '0',
  ]);
}

rows.sort((a, b) => Number(b[8]) - Number(a[8]) || a[2].localeCompare(b[2]));
const header = 'geoname_id\tname\tascii_name\tname_hi\tstate\tlat\tlng\ttz_id\tpopulation';
const out = path.resolve(import.meta.dirname, '../prisma/seed-data/places-in.tsv');
writeFileSync(out, [header, ...rows.map((r) => r.join('\t'))].join('\n') + '\n');
console.log(`Wrote ${rows.length} places to ${out}`);
