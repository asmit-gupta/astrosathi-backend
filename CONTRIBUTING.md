# Working on the backend

## Before you push

```bash
npm run check      # typecheck, lint, format check, tests (CI runs the same, plus the build)
npm run format     # fix formatting
npm run lint:fix   # fix what ESLint can
```

## Layout

```
src/
  config/      env validation and policy numbers that are not admin settings
  lib/         small shared helpers (clock, crypto, errors, phone, validation, …)
  middleware/  request id, logging, CORS, auth guards, validation, error handler
  adapters/    third parties behind interfaces: sms/, storage/
  modules/     one folder per business area: <area>.routes.ts, <area>.service.ts, <area>.schemas.ts
prisma/        schema, migrations (additive), seed
tests/         integration tests against a throwaway Postgres
docs/          product docs, error-codes.md (generated)
```

## Conventions

- **Routes are thin.** Validate the body with a Zod schema (`validateBody`), call a service, return its result.
  Get the caller with `authOf(req)` / `adminOf(req)`, never `req.auth!`.
- **Errors** are `AppError` (or `badRequest`, `notFound`, …) with a stable `UPPER_SNAKE` code. Apps translate by
  code; the message is for developers. Run `npm run docs:errors` after adding codes.
- **Time** comes from `clock.now()`, never `new Date()`, so tests can freeze it.
- **Money** is integer paise. Business numbers live in admin settings (`src/modules/settings/registry.ts`).
- **Personal data** (phone, PAN, bank) is stored encrypted with `encryptPii`; keep only last-4 digits in clear.
- **Migrations** are additive. Generate with `prisma migrate diff` from the previous schema; never `db push` on
  production.
- **Naming.** The backend says _astrologer_. The apps say _provider_ and take domain words from the brand glossary,
  so they can be re-branded; API paths keep the backend's words.
- **Tests** cover every rule a route enforces. Use `freezeTime()` for anything time-based and the fakes in
  `tests/helpers.ts` (SMS) or the test file (storage).
