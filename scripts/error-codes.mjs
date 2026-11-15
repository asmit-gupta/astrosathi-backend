// Regenerates docs/error-codes.md from the source: every code passed to AppError or its helpers.
//   npm run docs:errors
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATUS = { badRequest: '400', unauthorized: '401', forbidden: '403', notFound: '404', tooManyRequests: '429' };
const pattern =
  /(?:AppError\(\s*(\d{3})\s*,\s*|(badRequest|unauthorized|forbidden|notFound|tooManyRequests)\(\s*)'([A-Z][A-Z0-9_]+)'/g;

const files = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });

const codes = new Map();
for (const path of files('src')) {
  const area = path.startsWith('src/modules/') ? path.split('/')[2] : path.split('/')[1];
  for (const m of readFileSync(path, 'utf8').matchAll(pattern)) {
    const key = `${m[3]}|${m[1] ?? STATUS[m[2]]}`;
    codes.set(key, new Set([...(codes.get(key) ?? []), area]));
  }
}

const rows = [...codes.entries()]
  .map(([key, areas]) => ({ code: key.split('|')[0], status: key.split('|')[1], areas: [...areas].sort() }))
  .sort((a, b) => a.areas[0].localeCompare(b.areas[0]) || a.code.localeCompare(b.code));

writeFileSync(
  'docs/error-codes.md',
  [
    '# Error codes',
    '',
    'Every error the API returns, generated from the source (`AppError` and its helpers).',
    'Responses look like `{ "error": { "code", "message", "details?" }, "requestId" }`. Apps show text by `code`;',
    '`message` is for developers. Also returned by middleware: `VALIDATION_FAILED` (400, `details.fields`),',
    '`INVALID_JSON` (400), `PAYLOAD_TOO_LARGE` (413), `ROUTE_NOT_FOUND` (404), `INTERNAL` (500).',
    '',
    'Regenerate after adding codes: `npm run docs:errors`.',
    '',
    '| Code | Status | Where |',
    '|---|---|---|',
    ...rows.map((r) => `| \`${r.code}\` | ${r.status} | ${r.areas.join(', ')} |`),
    '',
  ].join('\n'),
);
console.log(`${rows.length} codes written to docs/error-codes.md`);
