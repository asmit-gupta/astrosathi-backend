# AstroLive backend

Modular monolith: Node.js + Express + TypeScript, PostgreSQL via Prisma.
Product rules live in `docs/` (`handoff.md` wins over `prod.md`).

## Run locally

```bash
npm install
cp .env.example .env            # then set real secrets
docker compose up -d postgres   # or point DATABASE_URL at any Postgres 15+
npm run db:deploy               # apply migrations
npm run dev                     # http://localhost:4000
```

With `SMS_PROVIDER=console`, OTP codes are printed in the server log. Production uses `SMS_PROVIDER=apitxt`
(`APITXT_API_KEY`, optional `APITXT_TEMPLATE_ID`); `fast2sms` remains available as an alternative.

## Production database (Neon)

- `DATABASE_URL` is Neon's **pooled** endpoint (used by the app); `DIRECT_URL` is the **direct** endpoint (used by `prisma migrate`).
- Deploy migrations with `npm run db:deploy`. Never `prisma migrate dev` or `db push` against production.
- `GET /health/ready` returns 200 only when the database is reachable and migrated.
- Tests refuse to run against any non-local database host.

## Tests

```bash
npm test
```

Tests start a throwaway embedded Postgres (no Docker needed) and apply the real migrations.
Set `TEST_DATABASE_URL` to use an existing empty database instead.

## Layout

```
src/
  config/      env validation, policy numbers (move to Admin settings later)
  lib/         clock, crypto, errors, logger, prisma, phone helpers
  middleware/  request id, auth, validation, error handler
  adapters/    third-party providers behind interfaces (sms/…)
  modules/     one folder per business module (auth/…)
prisma/        schema and migrations
tests/
```

## Auth API (`/v1/auth`)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/otp/send` | `mobile`, `deviceId` | 202. Code made on our server, 5-min expiry. Limits: 30 s cooldown, 3/15 min per number, 5/h per device, 20/h per IP |
| POST | `/otp/verify` | `mobile`, `code`, `deviceId`, `consents: {terms: true, age18: true, marketing?}`, optional `platform`, `appVersion`, `language` | Signs in or creates the user. 5 wrong codes lock the number for 15 min. Signs out other devices |
| POST | `/token/refresh` | `refreshToken` | Rotates. Reusing an old refresh token revokes the session |
| POST | `/logout` | – | Bearer token |
| GET | `/session` | – | Bearer token. Signed-in user, phone masked |

## Public reference data (`/v1`, no sign-in)

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | The 9 topic categories, Hindi and English names |
| GET | `/places?q=luck&limit=10` | Birth-place search (India). English prefix, or Devanagari against a Hindi alias. Returns lat/lng and IANA timezone |

## Signed-in user (`/v1/me`, Bearer token)

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/` | Profile: `name`, `language`. Includes `deletion.dueAt` while a deletion is pending |
| GET / POST | `/birth-profiles` | One `isSelf` profile, up to 10 total. Every profile must be 18+ (Indian date). `placeId` from `/places` fills place, lat/lng and timezone. `tobAccuracy: exact` needs `tob` (HH:MM); the other values (morning…night, unknown) need `tob: null` |
| GET / PATCH / DELETE | `/birth-profiles/:id` | Edits are blocked during an active consult (once sessions exist) |
| GET / PUT / PATCH / DELETE | `/preferences` | PUT saves onboarding answers and needs `consent: true`; `topics` are category slugs (max 3). PATCH toggles `showEveryone` |
| GET | `/consents` | Consent history |
| PUT | `/consents/marketing` | `{ granted }`: opt in or withdraw |
| POST | `/data-export` | Records a DPDP access request (fulfilment: compliance module) |
| POST / DELETE | `/deletion` | Request deletion (7-day cool-off) or cancel it |

## Admin (`/admin/v1`, single admin)

There is exactly one admin account; the database refuses a second. Create it on a machine with `DATABASE_URL`:

```bash
npm run admin -- create --email you@example.com   # hidden password prompt, then enrol an authenticator app
npm run admin -- reset-2fa                          # lost phone: new authenticator, all sessions ended
npm run admin -- reset-password                     # forgot password: all sessions ended
```

Sign-in is email + password + 6-digit authenticator code. Sessions end after 30 idle minutes or 12 hours; a new
login ends the previous session; 5 failed logins from one IP lock that IP for 15 minutes.

With one admin there is no second approver. Sensitive actions instead need an authenticator code entered within
the last 5 minutes (`POST /auth/step-up`), and every action is written to the audit log. The audit log is
append-only: a database trigger rejects UPDATE and DELETE.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `email`, `password`, `code` → `token` (send as Bearer) |
| GET | `/auth/session` | Who is signed in, whether step-up is active |
| POST | `/auth/step-up` | `code` → sensitive actions allowed for 5 minutes |
| POST | `/auth/password` | Step-up. `currentPassword`, `newPassword` (12+ chars) |
| POST | `/auth/logout` | |
| GET | `/settings` | Every business number: value in force, version, scheduled changes |
| GET | `/settings/:key/history` | All versions |
| PUT | `/settings/:key` | Step-up. `value`, `reason`, optional future `effectiveFrom`. Adds a version; never edits one |
| POST | `/settings/:key/versions/:v/cancel` | Step-up. Cancels a version that hasn't taken effect |
| GET | `/audit-logs` | Filters: `action`, `entityType`, `entityId`, `from`, `to`; `cursor`, `limit` |

Settings and their defaults are defined in `src/modules/settings/registry.ts` (money in paise). Read them in code
with `settings.get('platform_share_pct')`. Anything long-lived (a session, a pack) must snapshot the values it uses
when it starts, so a change never alters work in progress.

Reference data is seeded with `npm run db:seed` (insert-only, safe to re-run on production).
Place data © GeoNames (https://www.geonames.org), CC BY 4.0; rebuild with `scripts/build-places.mjs`.

Access tokens last 15 minutes; refresh tokens 60 days. Every request checks that the session is still live.

Errors always look like `{ "error": { "code", "message", "details?" }, "requestId" }`.
Apps show Hindi/English text by `code`; `message` is for developers. 429s include `Retry-After`.

| Code | Meaning |
|---|---|
| `VALIDATION_FAILED` | Body invalid (includes missing terms/18+ consent) |
| `INVALID_MOBILE` | Not a valid Indian mobile |
| `OTP_RESEND_COOLDOWN`, `OTP_RATE_LIMITED`, `OTP_LOCKED` | 429, see `Retry-After` |
| `OTP_INVALID` (`details.attemptsLeft`), `OTP_EXPIRED`, `OTP_NOT_REQUESTED` | Verify failures |
| `SMS_SEND_FAILED` | 502, provider didn't accept the send |
| `TOKEN_EXPIRED` | Refresh and retry |
| `TOKEN_INVALID`, `SESSION_REVOKED`, `REFRESH_*` | Sign in again |
