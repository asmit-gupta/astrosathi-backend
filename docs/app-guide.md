# app-guide.md: Flutter frontend guide

Audience: the coding agent building the frontend. Read this first, then the backend handoff (`AstroLive_Build_Handoff_v0.3.md`), the colour tokens (`astrolive_colour_tokens.json` and `.css`) and the product spec. Where this guide and the handoff disagree on a product rule, the handoff wins. Where they disagree on frontend structure, this guide wins.

The product name is **AstroSaathi** (older documents say "AstroLive"; that was a placeholder). Even so, never write the brand name, or any astrology word, as a literal in code or copy. Everything brand- or domain-specific comes from config (section 4), so the name can change and the app can be re-branded. The founder has not yet finished the trademark, domain and app-store availability checks for AstroSaathi; do not register store listings or bundle ids until the founder confirms.

---

## 1. What to build

Three surfaces, one codebase family:

| Surface                       | Who                                          | Platforms                                | Entry point         |
| ----------------------------- | -------------------------------------------- | ---------------------------------------- | ------------------- |
| User app                      | People who consult, shop and join live shows | Android, iOS, web                        | `apps/user_app`     |
| Provider app (astrologer app) | Astrologers and pandits                      | Android, iOS, web                        | `apps/provider_app` |
| Admin panel                   | Staff                                        | Web only (desktop first, 1280 px and up) | `apps/admin_web`    |

All three use Flutter and share packages. The wireframe boards are the acceptance criteria: W1 to W13 (user), X1 to X4 (provider), Y1 to Y17 (admin). The numbered notes under each wireframe are requirements, not suggestions. Ask the founder to export the boards and notes into `docs/wireframes/` of the frontend repo so they are readable offline.

All release-1 features ship together: per-minute chat, voice and video, free live shows, reels and stories, packs, the Store, puja at home, free horoscope and Kundli tools, wallet, referral, notifications.

---

## 2. Decisions this guide makes (change only with the founder)

| Area           | Choice                                                                 | Why                                                                         |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Framework      | Flutter, stable channel, Dart 3                                        | Founder's choice                                                            |
| Repo layout    | One workspace, managed with Melos                                      | Shared design system and API client across three apps                       |
| State          | Riverpod (with code generation)                                        | Testable, no widget-tree coupling                                           |
| Routing        | `go_router`, every screen a URL                                        | Web needs real URLs and deep links; the same routes serve mobile deep links |
| Networking     | `dio`, with a Dart client generated from the backend's OpenAPI spec    | One source of truth for the API                                             |
| Models         | `freezed` and `json_serializable`                                      | Immutable, generated                                                        |
| Storage        | `flutter_secure_storage` for tokens, `drift` or `hive` for cached data | Tokens never in plain preferences                                           |
| Localisation   | `flutter_localizations` plus ARB files (Hindi and English)             | Built in; see section 4 for the glossary layer                              |
| Push           | Firebase Cloud Messaging                                               | Standard                                                                    |
| Calls and live | Behind an `RtcClient` interface (section 8)                            | Cloudflare is the provider; it must be replaceable                          |
| Payments       | Behind a `PaymentClient` interface (section 9)                         | PayU is the provider; it must be replaceable                                |

If you disagree with a choice, say so in a short note to the founder with the reason before changing it.

---

## 3. Repo layout

```
/
  apps/
    user_app/            # runs on Android, iOS, web
    provider_app/        # runs on Android, iOS, web
    admin_web/           # web only
  packages/
    core_brand/          # BrandConfig, Glossary, feature flags, tenant config loader
    core_design/         # tokens, theme, components (no business logic)
    core_api/            # generated client, auth interceptor, error mapping
    core_l10n/           # ARB files, glossary-aware string helpers
    core_rtc/            # RtcClient interface + Cloudflare implementation
    core_payments/       # PaymentClient interface + PayU implementation
    core_analytics/      # event logging with consent gating
    core_common/         # money formatting, time, validators, utilities
    feature_*/           # one package per feature area (below)
  brands/
    default/             # the first brand's assets and config
    _test_brand/         # a fake second brand used only by CI (section 4.6)
  tool/                  # scripts: brand build, l10n check, token generation
  docs/
    wireframes/
    decisions.md
```

Feature packages (each owns its screens, providers and tests): `feature_onboarding`, `feature_discovery`, `feature_session` (chat, voice, video, billing display), `feature_wallet`, `feature_live`, `feature_reels`, `feature_store`, `feature_packs`, `feature_puja`, `feature_free_tools`, `feature_account`, `feature_notifications`, `feature_provider_*` (for the provider app), `feature_admin_*` (for the admin panel).

Rules: a feature package may depend on `core_*` packages, never on another feature package. Shared needs go into a `core_*` package. Apps only wire things together.

---

## 4. White-label design (the most important section)

The founder may sell a standalone app for another domain by changing names and glossary. Design for that from the first line of code.

### 4.1 Two kinds of configuration

| Kind                                   | Examples                                                                                                                                      | When it is applied                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Build-time (per brand)                 | App name, bundle and package id, icons, splash, launcher label, default colours, fonts, store listing text, Firebase files, deep-link domains | Chosen at build; the brand folder in `brands/<brand>/`                             |
| Runtime (per tenant, from the backend) | Glossary, topic list, feature flags, legal and help links, banners, copy overrides, support contacts                                          | Fetched at start from `GET /v1/tenant-config`, cached, refreshed in the background |

Coordinate with the backend agent: the backend needs a tenant concept and this endpoint. Until it exists, load the same JSON from `brands/<brand>/tenant_config.json`, behind the same interface.

### 4.2 BrandConfig (build-time)

One JSON file per brand, parsed into a typed class in `core_brand`:

```json
{
  "brandId": "default",
  "displayName": "AstroSaathi",
  "tagline": "...",
  "logo": { "wordmark": "assets/logo_wordmark.svg", "mark": "assets/logo_mark.svg" },
  "appIcon": "assets/app_icon.png",
  "tokens": "tokens.json",
  "fonts": { "latin": "Noto Sans", "devanagari": "Noto Sans Devanagari" },
  "deepLinkHosts": ["example.com"],
  "supportEmail": "...",
  "locales": ["hi", "en"],
  "defaultLocale": "hi"
}
```

The design tokens come from `astrolive_colour_tokens.json` and are copied into `brands/default/tokens.json`. The theme is generated from that file. Never write a hex colour or a font name in a widget.

### 4.3 Glossary (runtime)

Domain words are keys, not text. The first brand's values are astrology words. A second brand (for example, legal advice) would replace them.

```json
{
  "hi": {
    "provider": { "one": "ज्योतिषी", "other": "ज्योतिषी" },
    "session": { "one": "परामर्श", "other": "परामर्श" },
    "topic": { "one": "विषय", "other": "विषय" },
    "chart": { "one": "कुंडली", "other": "कुंडलियाँ" }
  },
  "en": {
    "provider": { "one": "astrologer", "other": "astrologers" },
    "session": { "one": "consultation", "other": "consultations" },
    "topic": { "one": "topic", "other": "topics" },
    "chart": { "one": "Kundli", "other": "Kundlis" }
  }
}
```

Required keys, at minimum: `provider`, `session`, `topic`, `chart` (the birth chart), `wallet`, `store`, `liveShow`, `pack`, `ritualService` (puja at home), `ritualProvider` (pandit), `dailyContent` (daily horoscope), `matching` (Kundli matching), `guidanceDisclaimer`.

Rules:

1. Every user-facing string lives in an ARB file. Strings that mention a domain word use a placeholder: `"startSession": "Start {session} with {provider}"`. A helper fills the placeholders from the glossary for the active locale.
2. **Hindi grammar breaks naive substitution.** Gender, plural and case change the words around the noun. Keep the glossary per locale, store the forms the sentence needs (singular, plural, and for Hindi where it matters the gender), and treat each new brand's Hindi copy as a review task, not an automatic result.
3. No domain word appears in code, in widget names that users can see, in analytics event names or in image text. Images that contain words are not allowed; use real text over images.
4. Features that only suit one domain (Kundli maker, puja at home, Store for gemstones) are controlled by feature flags (4.4), not by deleting code.

### 4.4 Feature flags (runtime)

From tenant config: `chat`, `voice`, `video`, `liveShows`, `reels`, `packs`, `store`, `ritualService`, `freeTools`, `kundliMaker`, `dailyContent`, `referral`, `wallet`. A disabled feature disappears from navigation, search and deep links, and its routes redirect home. These flags only hide features; server-side permission checks still decide what is allowed.

### 4.5 Topics, legal text and banners

The topic list, onboarding questions, banners, help articles, Terms, Privacy Notice and the guidance disclaimer come from the backend. The frontend only renders them. Do not ship any of this text in the app bundle except an offline fallback.

### 4.6 The brand-swap test (required)

Keep a fake brand in `brands/_test_brand/` with different names, colours, glossary (a made-up domain, such as "tutors") and some flags turned off. CI builds the apps with it and runs a script that fails if:

- any ARB string or Dart file contains the default brand's name or any astrology word outside `brands/default/` (a deny-list in `tool/brand_deny_list.txt`),
- any hex colour or font name appears outside the generated theme,
- a screenshot test of the home screen in the test brand shows the default brand's name.

If this test is red, the white-label promise is broken. It is the main guard for the sale of a standalone app.

### 4.7 Building a brand

`tool/build_brand.dart <brandId>` should:

1. validate the brand folder and tenant config against schemas,
2. generate launcher icons and splash screens,
3. set the Android `applicationId` and iOS bundle id (through Gradle product flavors and Xcode build configurations),
4. generate the theme from `tokens.json`,
5. copy the right Firebase config files,
6. write the brand id into a Dart define (`--dart-define=BRAND=<id>`).

Document the steps for a new brand in `docs/new-brand.md`: how long it takes, what the founder must supply, and what needs a Hindi copy review.

---

## 5. Design system

Source: `astrolive_colour_tokens.json` (v1.1) and the Ink + Kesar section of the handoff. Summary of the rules to enforce in components:

- **Only black fills buttons.** Every button that spends money shows the amount on the button (for example, "Start voice call · ₹40/min").
- **Saffron is the single accent.** Selected chips, stars, key highlights and links use the accent. Verified ticks are ink, not green.
- **LIVE is the only true red.** Success, error and info colours are used only for their meaning.
- **No gradients, no yellow, no violet.**
- **Colour is never the only signal.** Status is always a word plus colour, for example "Online", "Busy · 4 min", "Offline".
- Light and dark values both exist. Text needs 4.5:1 contrast and control edges 3:1; the tokens file lists the checked pairs. A token-contrast unit test must fail if a pair drops below those numbers.

Typography: Noto Sans and Noto Sans Devanagari, weights 400, 600 and 700, bundled as assets (no runtime font download). Use tabular numerals for prices and timers. Test that Hindi text fits every layout, including with the system text size raised to 200%.

Components to build once in `core_design`, with golden tests in light and dark, Hindi and English: buttons (primary, secondary, text), price button, chips, inputs (including OTP boxes), cards, list rows, badges (LIVE, status, verified), star rating, bottom sheet, dialog, snackbar, empty state, error state, loading skeletons, avatar, wallet chip, price line, progress dots, tab bars and navigation, page scaffold.

Touch targets are at least 48 by 48 logical pixels. Support screen readers on every screen (semantic labels, focus order, announcements for balance changes and incoming requests).

---

## 6. Responsive and adaptive behaviour

Flutter targets phones, tablets and the browser from one code path. Use these breakpoints (logical pixels):

| Class    | Width       | Navigation      | Layout                                       |
| -------- | ----------- | --------------- | -------------------------------------------- |
| Compact  | under 600   | Bottom bar      | One column, full width                       |
| Medium   | 600 to 1023 | Navigation rail | One or two columns, content capped at 720    |
| Expanded | 1024 and up | Side navigation | Two or three columns, content capped at 1200 |

Rules:

- Build with `LayoutBuilder` and a small `AdaptiveScaffold` in `core_design`. Do not branch on platform for layout; branch on width.
- Wireframes are drawn for a 390-wide phone. Wider screens do not stretch them; they re-arrange (for example, list and detail side by side, cards in a grid) and cap the content width.
- Web specifics: real URLs for every screen, working back and forward buttons, refresh keeps the state, keyboard navigation and visible focus, hover states, text selection where it makes sense, and the browser's own scroll.
- Admin panel: designed for 1280 and up. It must still be usable at 1024.
- Orientation: phones are portrait first; video calls and live shows also handle landscape.
- Test at 360, 390, 600, 768, 1024, 1280 and 1920 widths, at text scale 1.0 and 2.0.

### 6.1 Web SEO: not part of this sprint

The public landing and SEO pages (daily horoscope, Kundli landing pages, astrologer profiles, blog, help and category pages) will be built separately in **Next.js**, outside this repo and outside this sprint. Consequences for the Flutter work:

- Flutter web here is only the logged-in app. Do not build public marketing or content pages in Flutter.
- Use path-based URLs (no hash), with a stable route for every screen, so the Next.js site can link into the app (for example, "talk to an astrologer" deep-links to a profile or the start of a session).
- Keep the route table in one file (`docs/routes.md`, generated from `go_router`) so the Next.js team knows what to link to.
- The Next.js site will reuse the design tokens. Keep `tokens.json` free of Flutter-specific content so it can be shared.
- Free tools (horoscope, Kundli maker) stay in the app as wireframed. If Next.js later hosts public versions, they must call the same backend endpoints, so keep the tool logic on the backend and do not compute charts or horoscopes in the client.
- Set the web build's `index.html` title and description from the brand config, and add `noindex` to authenticated routes so the app shell does not compete with the Next.js pages.

---

## 7. Screens and rules to follow

Build each screen to the wireframe notes. The rules below apply across screens.

### 7.1 Money and billing (display only)

- The server is the only authority for billing. The app never calculates a charge, a balance or a refund. The running timer and cost on a session screen are display values taken from server events; if the connection drops, show the last server value and say so.
- Per-second billing display: show the per-minute price before the session, the running cost during it, and the final amount after.
- Reconnect: a 2-minute window with billing paused. Show a clear "Reconnecting, billing paused" state with a countdown.
- 15-minute check-ins: show the sheet exactly as wireframed; never auto-dismiss it.
- Top-up: any amount from ₹50 to ₹10,000. Suggest the next slab up as a non-forced option. The default action is the amount the user typed or chose, never the larger one.
- Spend limits: raising takes 24 hours, lowering is instant. Show a pending change with its time.
- No free first minute. Do not use the word "free" for anything that costs money. Intro offers show their real price and terms.
- No wallet withdrawal anywhere.
- Prices include taxes. Show one price; the Store's commission is never shown.
- Never show a countdown or scarcity message unless the backend says it is real.

### 7.2 Discovery

- List ranking comes from the backend. The client never re-sorts a recommended list; it only applies filters and a user-selected sort.
- Each card shows the reason line returned by the backend. "Show everyone" is always one tap away.
- Impressions, taps and starts are logged as events (section 10), with the list position and the list type.

### 7.3 Sessions

- Chat, voice and video use the `RtcClient` for audio and video and the backend's realtime channel for chat messages and server events.
- Handle mic and camera permissions with the wireframed explanation screen before the system prompt.
- Handle interruptions: incoming phone call, app in background, headphones, poor network, device rotation.
- Rating screen after every session. Complaint and refund request entry points as wireframed.

### 7.4 Live shows, reels and stories

- Live uses the same `RtcClient` in viewer mode. Pre-roll shows "free to watch". Questions to the host follow the wireframed rules.
- Reels and stories play from the media CDN with preloading of the next item, a data-saver mode and moderation flags. Report and block are one tap.

### 7.5 Store, packs, puja, free tools

- The Store shows a single price per product. No commission or source label.
- Packs show sessions remaining and the money value held; pack money never enters the wallet.
- Puja at home: the "pandit in 10 minutes" wording is controlled by the area coverage the backend returns. If coverage is missing, the banner says something honest and does not promise a time.
- Free tools (daily horoscope, Kundli maker): the output screen offers a next step to a consultation but never blocks the result behind login or payment.

### 7.6 Provider app

- Availability toggle with clear states. Incoming request screen with accept and decline and a countdown from the server.
- Earnings and payouts are display values from the backend.
- Puja setup is skippable; the bottom-sheet nudge appears at the frequency the backend returns.
- Strike notices and capability flags are shown as the backend sends them.

### 7.7 Admin panel

- Desktop layout with sidebar navigation, data tables with sorting, filtering, pagination and export, and detail panels.
- Every state-changing action has a confirmation, a reason field where the wireframe asks for one, and shows when it needs a second approver (maker-checker).
- Destructive and financial actions are never one-click.

### 7.8 States every screen needs

Loading (skeleton), empty, error with a retry, offline (cached data plus a banner), permission denied, session expired (return to the same place after login), maintenance mode, forced update. The wireframe board W12 defines the visuals.

---

## 8. Real-time layer (calls and live)

Define the interface first and code to it:

```dart
abstract class RtcClient {
  Future<void> join(RtcJoinInfo info);        // token comes from the backend
  Future<void> leave();
  Stream<RtcEvent> get events;                // connected, reconnecting, quality, ended
  Future<void> setMicEnabled(bool on);
  Future<void> setCameraEnabled(bool on);
  Future<void> switchCamera();
  // viewer / host roles for live shows
}
```

- Tokens and room ids come from the backend. The client never holds a provider secret.
- Cloudflare is the chosen provider. `[VERIFY]` Check what Cloudflare offers for Flutter before building: an official SDK, or WebRTC against their API through `flutter_webrtc`. If there is no Flutter SDK, wrap the provider's native SDKs with platform channels or use WebRTC directly, and confirm that web works.
- Run the proof-of-concept tests from the handoff before building the session screens: audio on a weak network, reconnect behaviour, background audio, video on a low-end Android phone, and a live show with many viewers.

---

## 9. Payments layer

```dart
abstract class PaymentClient {
  Future<PaymentResult> pay(PaymentRequest request); // request comes from the backend
}
```

- The backend creates the order and returns what the SDK needs, including any server-computed hash. The client never computes a payment hash and never holds the merchant secret.
- The result shown to the user is the backend's confirmed status, not the SDK's callback. After the SDK returns, poll or listen for the backend's webhook-confirmed result, and show "Confirming your payment" until then.
- PayU is the chosen provider. `[VERIFY]` Confirm the Flutter SDK or the web redirect flow before building. Web usually needs a redirect or hosted page, and UPI intent behaves differently on Android, iOS and web.
- `[VERIFY]` Check Apple's and Google's rules on in-app purchases for digital services, since they affect whether wallet top-ups can use PayU inside the iOS and Android apps. Raise with the founder before building the top-up flow.

---

## 10. Analytics and consent

- Log the events listed in the matching-engine document (impressions, profile views, session start and end, ratings, refunds, top-ups, store views and orders), using a pseudonymous user id. Event names are generic, not brand words.
- Log only after consent is given. Respect a later withdrawal at once. The consent screen and the Settings control are part of release 1.
- Never log names, phone numbers, birth details or message text.
- Crash and error reporting must scrub the same fields.

---

## 11. Security and privacy

- Tokens in secure storage; refresh-token rotation; log out clears everything.
- Certificate pinning is optional for release 1; decide with the founder.
- No secrets in the app bundle. Anything that looks like a key is public and limited by the backend.
- Screenshots and screen recording: block them on the wallet, payment and chat screens where the platform allows it (Android secure flag, iOS overlays); decide with the founder for chat.
- Age gate and consent as wireframed (18 and over).
- Login OTP is sent by the backend through Fast2SMS. The client only collects the number and the code, with an auto-read where Android allows. Rate-limit messages come from the backend; show them in plain words.
- Deep links and web routes validate ids and never trust query parameters for permissions.

---

## 12. Quality bar

- **Static checks:** `flutter analyze` clean, strict lints, no `print`, no hard-coded strings (lint plus the brand deny-list), no hard-coded colours or font names.
- **Tests:** unit tests for money formatting, token contrast and glossary substitution; widget tests for each component; golden tests for core screens in light and dark, Hindi and English, compact and expanded widths; integration tests for the main journeys (onboarding, search, start a session, top-up, rating, store order, provider accepts a request).
- **Performance budget (targets to test, not measured figures):** cold start under 3 seconds on a mid-range Android phone; list scrolling without dropped frames; web first load kept small with deferred loading of heavy features such as video; image caching and resizing everywhere.
- **Device matrix:** a low-end Android phone, a mid-range Android phone, a recent iPhone, an older iPhone, Chrome, Safari and Firefox on desktop, and Chrome on Android. Many users will be on mid-range phones and weak networks.
- **CI:** analyse, test, golden compare, the brand-swap test, and build all three apps for each supported platform on every pull request.

---

## 13. Build order

Build in this order, with a working, demoable result at each step:

1. Workspace, Melos, CI, the three empty apps, flavors for the default brand.
2. `core_brand`, `core_design` (tokens, theme, components) with the brand-swap test already running.
3. `core_api` with the generated client and auth; tenant config loader with the local JSON fallback.
4. `core_l10n` with glossary-aware strings in Hindi and English.
5. Onboarding, language choice, login by OTP, consent. (W1)
6. Home, discovery, astrologer profile, filters. (W2)
7. Wallet and top-up with the payment layer. (W4)
8. Sessions: chat first, then voice, then video, with billing display, reconnect and check-ins. (W3)
9. Provider app: onboarding, availability, incoming requests, session tools, earnings. (X1, X2, X4)
10. Live shows, reels and stories. (W5, W9)
11. Store, packs, puja, free tools, referral, notifications. (W7, W8, W10, W11, W13)
12. Account, help, states, permissions. (W6, W12)
13. Admin panel pages Y1 to Y17.
14. Hardening: accessibility pass, performance pass, device matrix, store submission assets.

Run the proof-of-concept for calls (section 8) and the payments check (section 9) before step 7.

---

## 14. Questions to put to the founder before you start

1. Confirmation that AstroSaathi has cleared the trademark, domain and app-store checks, so bundle ids and store listings can be set.
2. Is the admin panel part of this repo, or built separately?
3. The URL and domain split between the Next.js site and the Flutter web app (for example, the marketing site on the main domain and the web app on a subdomain such as `app.`), so deep links and cookies are set up correctly.
4. Does PayU work inside the iOS and Android apps for top-ups, or must top-ups go through the store's billing?
5. Which phones and OS versions must be supported at minimum (suggestion: Android 8 and up, iOS 14 and up)?
6. Which brands should the white-label design be tested against beyond the fake test brand?
7. Do the backend's tenant config and OpenAPI spec already exist, and where do I read them?

Record every answer in `docs/decisions.md`.
