# AstroLive — Build Handoff v0.3

**Read this first, then `AstroLive_Product_Spec.md` (v0.2).** Where this file and the spec disagree, **this file wins**. It records every decision made after the spec was written and replaces the phased roadmap with a single release.

Wireframes (19 + 4 boards) are on the Design canvas, board names given below. Each wireframe screen has numbered notes; treat those notes as acceptance criteria.

---

## 1. What we are building

A marketplace app for India: users consult astrologers by chat, voice or video, paid per minute from a prepaid wallet. Astrologers may also host free live shows, post reels and stories, sell fixed-price packs, and recommend Store items. Three surfaces: **User app**, **Astrologer app**, **Admin panel**. One backend, one ledger.

## 2. Scope: everything is in release 1

The founder's decision: **no phasing.** All of the below ships in the first release. The spec's Phase 2 items (Store, Packs-style products, Reels) are pulled into v1.

Because the scope is large, build in this **order** (it is a build sequence, not a release split). Each step should be usable end to end before the next starts.

1. Foundations: auth (mobile OTP), profiles, roles, capability flags, admin shell, audit log.
2. Ledger and wallet: double-entry ledger, PayU top-up, webhooks as the source of truth, spend limits.
3. Astrologer onboarding and Admin review (KYC, video intro, capability grants).
4. Discovery: categories, onboarding questions, ranking (quality gate, then preference match).
5. Consult sessions: chat, voice, video via Cloudflare; server-authoritative per-second billing; queue; check-ins; refunds and disputes.
6. Free tools: Kundli maker, matching, panchang, numerology, daily horoscope.
7. Packs (bundles).
8. Live shows.
9. Reels and stories.
10. Store (products, checkout, orders, recommendation cards in chat).
11. Finance: payout batches, TDS, GST invoices, reconciliation.
12. Trust and safety: keyword scan, flags, strikes, crisis queue.

Steps 1, 2 and 5 are the critical path. Do not start 8–10 until 5 passes the proof-of-concept tests in the spec (§17, the 9 Cloudflare tests).

## 3. Decisions log (supersedes spec where different)

| # | Decision | Effect |
|---|---|---|
| D1 | Platform share is a **flat 40% for everyone**. | One global setting. No per-astrologer override. Remove commission override fields. |
| D2 | **Nothing is free in consults.** No free first minute. | Remove any first-minute-free logic from billing and UI. |
| D3 | Free for users: live-show viewing and questions, Kundli maker, matching, panchang, numerology, daily horoscope. | These are acquisition and retention tools, not revenue. |
| D4 | **No wallet withdrawal.** Refunds only for failed or disputed sessions. | Wallet is consult credit. No cash-out flow. |
| D5 | Payments run on **PayU** (UPI first). Replaces the earlier Razorpay choice. | Webhook-confirmed credits. Verify PayU's server-side hash/response on every callback. Reconcile daily against the ledger. Build behind a payment adapter. |
| D6 | **Top-up is any amount ₹50–10,000.** The app suggests the next slab up, never pre-selected, with "Keep ₹X" equally easy. Button pays exactly what was typed. | Credit equals payment. Review wording with a lawyer for the CCPA dark-pattern rules. |
| D7 | **Store**: the user sees one price only. Astrologers earn commission on items bought through a recommendation card; the rate is set in Admin. | No commission disclosure on the product page. Commission is a margin setting per product category. |
| D8 | **Packs**: astrologers *propose*, **Admin approves**. Fixed sessions × minutes, price, validity (default 60 days). | Savings display is computed from the astrologer's real per-minute rate, never typed. |
| D9 | New astrologers are capped at ₹50/min for their first 90 days. | Not contradicted by the founder; keep. |
| D10 | Everything ships in release 1 (see §2). | |
| D12 | **Puja at home** (physical pandit booking): astrologers opt in (skippable, with a recurring bottom-sheet nudge), choose areas, travel radius, puja types and prices. Users see a banner and book a pandit. Payment is held and taken when a pandit accepts, released after the client confirms (or 24 hours). Pandit share 60%. | Boards X3, W10, Y10. |
| D13 | **Referral**: both sides get ₹100 consult credit after the friend's first top-up of ₹500+. Credit is not cash, expires, and sits in its own ledger account. | Board W13, Y12. |
| D15 | **Stack:** PayU for payments, Cloudflare (real-time audio/video) for calls and live, Fast2SMS for login OTP and any other SMS (transactional alerts need their own approved DLT templates). | Each sits behind an adapter (payments, RTC, SMS). To confirm with PayU: astrology category approval, UPI collect/intent support, payouts to astrologers, refund API, wallet-top-up settlement time. |
| D14 | **Top-up/pack/puja money rules** follow D4–D8; the platform share stays 40% everywhere. | |
| D11 | **Login OTP by SMS through Fast2SMS** (`POST https://www.fast2sms.com/dev/otp/send`). | See §3A. |

### 3A. Fast2SMS OTP integration

From https://docs.fast2sms.com/reference/send-otp (read 11 Nov 2026):

- **Request:** `POST https://www.fast2sms.com/dev/otp/send`, API key in the `Authorization` header.
- **Body:** `mobile` (10-digit Indian number, required), `otp_id` (your approved OTP template ID, required), optional `otp_expiry` (1–10080 minutes, default 15), `otp_length` (4–10, default 6), `otp` (your own value, up to 10 characters), `variables_values` (pipe-separated values for `{#var#}` template variables; pass `{otp}` where the code goes) and `udf1`–`udf3` (returned in the webhook).
- **Responses:** 200 sent, 400 validation error, 401 bad key. The page does not show the response body, so inspect a real response before coding against it.
- **Not on the page:** pricing, rate limits, DLT registration steps and any "verify OTP" endpoint. Check these with Fast2SMS.

Build rules:
1. **Generate the OTP on our server** and pass it in `otp`. Store only a hash with expiry (5 minutes recommended, not the 15-minute default) and an attempt counter (max 5). Verify on our side; do not depend on Fast2SMS for verification.
2. **Rate limits we own:** per mobile (e.g. 3 sends per 15 minutes), per device and per IP, plus a 30-second resend cooldown. SMS costs money and OTP pumping is a known abuse.
3. **Template:** India requires a DLT-registered sender and template (TRAI). Register the OTP template early; approval can take days [VERIFY with Fast2SMS]. Hindi and English templates may both be needed.
4. **Put SMS behind an adapter** (`SmsProvider.sendOtp(mobile, code)`), so a fallback provider can be added. Add a second channel (WhatsApp or voice OTP) later for delivery failures.
5. Use `udf1` for our request ID so delivery webhooks can be matched to the login attempt. Log delivery status; show "Didn't get it? Resend / try call" in the login screen after 30 seconds.
6. Keep the API key in server secrets only. Never in the app.
7. Login screen copy: say what the number is used for and link the privacy notice (DPDP).

## 4. Screen inventory → wireframe board

| Area | Board | Screens |
|---|---|---|
| Brief, sitemap, core flow | Main, B1, B2, B3 | B1 and B2 show the first consult only; B3 lists everything added later |
| User: onboarding | W1 | Language, preference Q1, budget Q4, Home, login |
| User: discovery | W2 | Category page, list, filter, astrologer profile, pre-session sheet |
| User: session | W3 | Connecting/queue, chat, voice, post-session, report and refund |
| User: money | W4 | Wallet, add money (with slab nudge), payment result, spend controls |
| User: live | W5 | Live tab, live room, ask a question, show ended |
| User: account | W6 | Birth profile, Kundli, Me/settings, Help |
| User: Store | W7 | Store home, product, checkout, order tracking, recommendation card in chat |
| User: Packs | W8 | Browse, detail, buy, My packs and pack session |
| User: free tools + reels | W9 | Tools hub, daily horoscope, Kundli maker, reels and stories |
| Astrologer onboarding | X1 | Basics, specialities and capabilities, verification, status |
| Astrologer daily | X2 | Home/availability, incoming request, chat with tools, live schedule and host console, earnings |
| Admin | Y1–Y17 | Dashboard, astrologers, users and support, finance, trust and safety, live ops, discovery settings, packs, content, puja ops, store, campaigns, settings, roles, audit log, legal and banners, notification catalogue |

Not wireframed (build from the spec text and the notes): the astrologer's pack-proposal form and reel/story upload (the founder skipped these), login/OTP details beyond W1, and the legal-page text itself.


## 4A. Boards added after the first handoff

| Board | Content |
|---|---|
| B3 | Sitemap additions (the first sitemap shows the first consult only) |
| W10 Book a pandit | Banner, booking form, finding a pandit, tracking |
| W11 | Chats tab, notification centre, search and favourites, rate a session |
| W12 | Error and empty states: nobody online, busy and queue, call dropped, offline, payment pending, suspended, update, maintenance, signed out |
| W13 | Mic/camera and notification permission pre-screens, refer and earn, my invites |
| X3 Puja services | Setup (yes/no, areas, radius, pujas, hours), nudge bottom sheet, incoming puja request, puja prices |
| X4 | Astrologer chats, edit profile, reviews, settings, strike/warning notice |
| Y10 Puja ops | Bookings, pandit approval, area coverage, disputes |
| Y11 Store | Products (gem certificate fields), orders, returns, commission |
| Y12 Campaigns | Broadcasts (consent-checked), coupons, referral rules |
| Y13 Settings | All business numbers with maker-checker and effective dates |
| Y14 Roles | Permission matrix, admin users, two-step login |
| Y15 Audit log | Append-only, before/after, export |
| Y16 Legal and banners | Versioned legal pages, banner slots (puja banner auto-hides without coverage) |
| Y17 Notifications | Single catalogue of every message the app may send |

Rules introduced there that the code must enforce:
- Billing pauses while a user is disconnected; a 2-minute rejoin window; the user pays only for connected time.
- Payment-pending screens never invite a second payment; the webhook is the source of truth.
- Only sessions of 3 minutes or more can be rated; astrologers cannot ask for or reward reviews.
- Rate rises above 20% need Admin approval; profile edits go to review while the old version stays live.
- Strike ladder: warning, 7-day hold on Store and live, suspension. Warnings expire after 90 days. Appeals go to a different reviewer.
- Promotions: consented users only, quiet hours 9 pm–8 am, max 2 per user per week, DLT templates only.
- Settings changes need a second approver and apply from a set time; they never affect sessions already started.
- Roles: every admin has a named account and two-step login; refunds above ₹500 and payout batches need two people.
- Puja banner: the "in 10 minutes" wording is shown only in areas where acceptance within 10 minutes is at least 60%; elsewhere "Book a pandit"; hidden where no pandit is online.
- Astrologer puja nudge: after 3 days, then every 7 days, max 3 times, then monthly; "don't ask again" stops it.

New open items: puja cancellation fee and the 60% pandit share (lawyer + founder), referral credit expiry wording, reel/call recording policy statement, audit-log retention period.

## 4B. Colour (decided 13 Nov 2026)

Direction: **Ink + Kesar**. Black filled buttons that carry the ₹ price, white page, one saffron accent, no coloured headers. Files: `astrolive_colour_tokens.json` (source of truth, with contrast results) and `astrolive_colour_tokens.css` (same values as CSS variables, light and dark).

- Use the token names, never raw hex, in code. Support light and dark from the start.
- Only the primary (ink) fills buttons. Any button that spends money shows the amount.
- Accent is saffron, used for selected chips, the live money meter, ratings, links and the banner pill.
- Do not use yellow or violet anywhere. Verified ticks are ink. LIVE is the only true red.
- Colour is never the only signal; pair it with an icon or words.
- Typeface: **Noto Sans + Noto Sans Devanagari**, weights 400, 600, 700. Prices and the money meter use tabular numerals. Check Hindi and English side by side, and the ₹ sign, on a cheap Android phone before locking.
- Stars: filled stars saffron, empty stars border grey (tokens `star-filled`, `star-empty`).
- Logo: ink wordmark, one small saffron mark, no gradient. Must work in one colour. App icon is an ink square with the saffron mark. Avoid yellow, violet and stars-and-moons symbols.

## 5. New or changed data model (add to spec §15)

- `pack` (id, astrologer_id, title, scope_text, sessions, minutes_each, channel, price, validity_days, status[proposed, live, paused, rejected], approved_by, approved_at)
- `pack_purchase` (id, user_id, pack_id, price_paid, wallet_part, gateway_part, purchased_at, expires_at, sessions_total, sessions_used)
- `pack_session` links a normal `session` to a `pack_purchase`; billing is against the pack, not the wallet.
- `horoscope` (sign, period[day, week, month], date_from, language, body, writer_id, status[draft, ready, published])
- `kundli` (id, user_id nullable for guests, birth data, language, computed_json, created_at); cache results by birth-data hash.
- `reel` (id, astrologer_id, video_asset, caption, status[pending, live, rejected, removed], reviewed_by); `story` (24h TTL); `reel_event` (view, like, share, save, cta_click); `session.source_reel_id` for attribution.
- `product`, `order`, `order_event`, `recommendation_card` (session_id, product_id, astrologer_id, shown_at, dismissed_at, purchased_order_id) — attribution and commission come from the card.
- Settings: `platform_share_pct` (global, 40), `new_astrologer_rate_cap`, `spend_limit_defaults`, `topup_slabs`, ranking weights, all versioned and requiring a second approver to change.

## 6. Business rules to enforce in code, not just UI

- Billing is **server-authoritative**, per second. Clients never decide the charge.
- The ledger is **append-only**. Refunds are reversals.
- **Raising** a spend limit takes effect after 24 hours; lowering is instant.
- Payout batches and ranking changes need **maker-checker** (two different admins).
- Product recommendation cards in chat: allowed only after 5 minutes of session, max 1 per session, requires the `recommend_items` flag.
- Keyword scan blocks phone numbers, UPI IDs and "pay me directly" in chat and flags them. Fear-selling phrases go to Trust & Safety. Distress words trigger the crisis queue and helplines in-chat.
- Reels: a new creator's first 3 are reviewed before going wide. Reel views never influence consult ranking.
- Horoscope gaps raise an Admin alert 48 hours before the day.
- 18+ only (DPDP).

## 7. Open items to resolve before or during build

1. **Daily horoscope source:** own astrologers on a rota (byline = free lead gen for them) vs a licensed content feed. Pick one before step 6.
2. **Expired packs:** what happens to the money for unused sessions after validity? Needs a stated rule and legal review.
3. **Dark patterns:** have a lawyer review the top-up slab nudge, the pack "you save" display, and the Store language.
4. **Tax:** GST treatment of packs and wallet top-ups; TDS 194-O rate (1% vs 0.1% disputed) — confirm with a CA.
5. **Helpline numbers** shown in the Help screen and crisis flow — verify they are current.
6. **Kundli engine licence** (Swiss Ephemeris-based or alternative) — confirm terms.
7. **Cloudflare pricing** — re-verify at build time; run the 9 proof-of-concept tests first.
8. **Reels in v1:** storage and moderation cost, and who reviews. Decide the moderation staffing.
9. **Store compliance:** return policy for certified gems; product claims review.

## 8. Instructions for the coding agent

- Treat the spec's rules (§7, §12–14) as requirements; treat the wireframe notes as acceptance criteria.
- The canvas wireframes are now coloured in **Ink + Kesar** (see §4B and `astrolive_colour_tokens.json/.css`). Build with a theme layer driven by those tokens. Use the tokens as given; do not invent a different brand look.
- All user-facing text must exist in **Hindi and English** from the start (string tables, no hard-coded copy). Check that Hindi fits every layout.
- Build behind adapters for RTC (Cloudflare), payments (PayU) and SMS (Fast2SMS) so any can be replaced.
- Write tests for the money paths first: top-up webhook, per-second billing, pack consumption, refunds, payout batch maths. Money logic must reconcile to the paisa.
- Log every admin action with admin id, before and after.
- Ask the founder before changing any decision in §3.