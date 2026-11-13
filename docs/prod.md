# AstroLive — Product & Technical Specification

**Working title:** AstroLive (rename freely)
**Version:** 0.2 (draft for founder review)
**Date:** 11 November 2026
**Market:** India first (Hindi + English at launch), Android first
**Surfaces covered:** (1) User app, (2) Astrologer app, (3) Admin panel (web)

---

## Revision history

| Version | Date | Changes |
|---|---|---|
| 0.1 | 11 Nov 2026 | First full draft |
| 0.2 | 11 Nov 2026 | **(1) Categories and personalisation:** astrologers are grouped into categories, method tags and collections, with per-astrologer capability flags (§7.10); new skippable preference questions drive matched discovery (§8.2.1, §7.11, §11.14). **(2) Not every astrologer goes live:** hosting is a separate capability and the Live tab is designed for few hosts (§10.8). **(3) Selling:** a Store for products and paid reports plus an astrologer Recommendation tool, with sales-pressure safeguards (§8.21, §9.12, §11.15, §12.8, §13.8, §14.6). The v0.1 rule "no selling in v1" is replaced by "no selling in chat, ever; Store and Recommendation tool only, from Phase 2". **(4) Cloudflare** is the chosen provider for calls, video and live (§17.5), gated by a proof of concept; economics in §20 are updated. Other sections are unchanged apart from small cross-reference edits. |

---

## 0. How to read this document

This spec is written so a designer, a developer, and an operations person can each find their part without reading everything.

| If you are... | Read |
|---|---|
| Founder / decision maker | §1, §2, §3, §20 (economics), §21 (roadmap), §22 (open decisions) |
| Designer | §4, §5, §7, §8, §9, §10 |
| Developer | §7, §8–§12, §15–§19 |
| Operations / support | §11, §13, §14 |
| Lawyer / CA | §2.5, §12, §14, §22 |

**Honesty note on evidence.** Section 2 separates what I found in sources (with a link list in §23) from what comes from general knowledge and is **not verified** here. Anything marked **[VERIFY]** must be confirmed with a lawyer, CA, or the vendor before you rely on it. Numbers in §20 are illustrative, not forecasts.

---

## 1. Executive summary

**What we are building.** A marketplace where users in India talk to vetted astrologers by chat, voice, and video, paid per minute from a prepaid wallet, plus a **live-session layer** where astrologers host scheduled public sessions that let users watch for free, build trust, and then convert to paid 1:1 consultations.

**Why this shape.**
- Paid per-minute astrology is proven at very large scale in India (see §2.1).
- The category's biggest weakness is **trust**: fear-based upselling, hidden charges, stretched calls, fake-looking reviews, and refund friction (see §2.3). A new entrant cannot out-spend incumbents on ads, so it should win on being visibly fairer.
- Live sessions let a user judge an astrologer **before paying**, which directly attacks the trust problem and lowers customer acquisition cost.

**The three apps.**
1. **User app** (Android first, iOS later): discover, watch live, consult, pay, review.
2. **Astrologer app**: apply, get verified, go online, consult, host live, see earnings, withdraw.
3. **Admin panel** (web): onboard and police astrologers, run finance and refunds, moderate live, manage compliance.

**The single biggest design bet.** Make fairness a product feature, not a policy page: per-second billing, all-inclusive prices, hard spend controls, un-curated reviews, a strike system for astrologers, and zero off-platform payment links. This costs some short-term revenue and buys durable trust and lower regulatory risk.

---

## 2. Research findings and what they mean for the product

### 2.1 Market signal

- Astrotalk, the category leader, reportedly reached about ₹1,823 crore operating revenue in FY26 (up 55%), with consultations making up about 91% of it. FY25 was reported at roughly ₹1,176–1,182 crore. FY26 profit was reported at about ₹222 crore, and about a third of revenue now comes from outside India.
- Astrotalk's e-commerce store (gemstones, rudraksha, Vastu items) reportedly crossed ₹140 crore in its first year, showing that **astrologer recommendations convert into high-ticket product sales**. That is also the root of the "remedy upselling" complaint (see §2.3).
- AstroSage and Astrotalk each have more than 5 crore Play Store downloads. AstroSage reported about ₹60 crore revenue in FY24 with a thin profit of about ₹50 lakh, which shows that revenue does not automatically become profit in this category.
- Takeaway: demand is proven; the winners are large; margins depend on acquisition cost and trust.

### 2.2 How incumbents make money

- **Commission on per-minute consultations.** Reported commission figures vary widely by source and by astrologer: roughly 20%, 20–25%, and 30–40% all appear. Treat commission as negotiable per astrologer tier, not a fixed number.
- Rates reported for astrologers range from about ₹10/min to ₹500/min.
- Secondary revenue: e-commerce, paid reports, premium memberships, ads/sponsored listings.
- Astrotalk reportedly vets by interview with roughly a 70% selection rate, so vetting exists but is not extremely strict.
- **Design implication:** our commission, tiers and rate bands must be admin-configurable (§11).

### 2.3 What users complain about (and the feature that answers it)

Complaints recur across consumer-forum posts, review sites, investigations, and a YouTube sting that targeted incumbents. Several of these are anecdotal, but the patterns repeat.

| Recurring complaint | Product answer in this spec |
|---|---|
| Fear-based predictions and pressure to buy remedies, gems, pujas | Remedy and product rules for astrologers (§9.6); strike system; fear-language detection (§13) |
| Astrologers stretching calls to burn minutes | Per-second billing, 15-minute "continue?" check-in, ranking tied to rating and repeat rate, not minutes (§7.3, §7.6) |
| Hidden or unexpected charges, subscriptions the user did not sign up for | All-inclusive prices, no auto-recharge by default, no subscriptions in v1, full price shown before connect (§8.8) |
| Refund requests ignored | Rule-based auto-refunds with a visible SLA (§7.7, §8.14) |
| Reviews that look curated (negative ones never shown) | Un-curated review promise: only abuse and personal data are removed, never negativity (§7.5) |
| Astrologers moving the user to payment links or personal numbers | Contact and link blocking in chat, instant-ban rule (§13) |
| Vulnerable, anxious users spending heavily | Spend limits, monthly spend display, cool-off nudges, crisis handling (§8.17, §13) |

The astrologer side also has friction. A Mint feature (January 2025) described the astrologer–platform relationship as fraying, and some astrologer reviews on review sites complain about how platforms treat them. These are partly anecdotal, but they point to an opportunity: **transparent commission, predictable payouts, and respectful support** make it easier to recruit and keep good astrologers.

### 2.4 Astrologer reality in India

- Many astrologers are individuals, often older, with mixed digital skills, working in Hindi or regional languages. Their app must be **extremely simple**, voice-friendly, and forgiving.
- Systems and categories users search for: Vedic, KP, Nadi, Lal Kitab, Tarot, Numerology, Vastu, Palmistry, plus topic tags like marriage, love, career, money, education.
- Astrologers care about: steady flow of requests, predictable payouts, visible rankings, and not being blamed for platform billing errors.
- Good astrologers with their own followings are the real asset (see the strategy in §3).

### 2.5 Regulatory landscape (India, as of 11 Nov 2026)

**Found in sources:**

- **No astrology-specific law.** In August 2026 the Department of Consumer Affairs told the Central Information Commission it has no guidelines regulating online astrology platforms. Astrology itself is legal. But platforms are exposed through general consumer and data law.
- **Consumer Protection Act, 2019 (misleading advertising).** Definitive promises such as guaranteed marriage, job, or wealth can count as misleading. Reported penalties from the CCPA reach up to ₹10 lakh for a first offence and up to ₹50 lakh for repeats.
- **Dark Patterns Guidelines, 2023 (CCPA).** Issued 30 November 2023 and covering 13 listed practices. The CCPA has been enforcing them; nine platforms (including Zepto, BookMyShow, IndiGo, Physics Wallah) were reported as penalised. A fine of ₹20 lakh was reported in August 2026. **We treat the 13 practices as a design checklist (see §14.2).**
- **DPDP Act, 2023 and DPDP Rules, 2025.** Rules were notified in mid-November 2025 with phased commencement. The Data Protection Board began immediately. Consent-manager registration starts around **14 November 2026**. The substantive duties (notice and consent, security safeguards, 72-hour breach reporting, **verifiable parental consent for anyone under 18**, tracking/targeted-ad bans for children) start around **mid-May 2027** (sources cite 12–14 May). **We are building into that window, so we design for it from day one.**
- **GST at 18%** applies to platform commission and similar platform services in the sources I found. Whether GST applies to the full consultation fee depends on whether the platform is the supplier or an intermediary **[VERIFY with CA]**.
- **TDS under section 194-O** applies to e-commerce operators on payments to sellers. Sources disagree on the rate: some say 1% (5% if PAN is not provided), another says 0.1%, consistent with a reduction in late 2025 **[VERIFY with CA]**. Whether astrologer payouts fall under 194-O or another section (such as 194J) depends on the legal structure **[VERIFY]**.
- **Google Play payments policy.** Selling digital items in-app (virtual currency, gifts) generally requires Google Play's billing system. India has an alternative-billing programme for developers. Google delisted apps of several Indian companies in early 2024 over this dispute. Whether paid human consultations count as "digital goods" or "services" is a grey area **[VERIFY]**. **Virtual gifts almost certainly require Play Billing or the approved alternative.**
- A news headline mentions amended e-commerce consumer rules effective 2027. I saw only the headline. **Check whether they apply to us [VERIFY].**

**From general knowledge, not verified in this research (confirm all):**

- Drugs and Magic Remedies (Objectionable Advertisements) Act, 1954 (claims of curing listed conditions).
- IT Act 2000 and IT (Intermediary Guidelines) Rules 2021 (grievance officer, takedown, user content).
- RBI rules on prepaid payment instruments: a wallet that pays third-party astrologers may need a different structure from a closed-system wallet. Structuring wallet balances as prepaid service credits for the platform's own services is common, but needs a legal opinion.
- TRAI DLT registration for transactional and promotional SMS.
- Swiss Ephemeris licence (dual-licensed; commercial use needs the commercial licence or AGPL compliance).

### 2.6 Technology and cost findings

- Real-time voice, video and live streaming should be **bought, not built**. Options include Agora, ZEGOCLOUD, 100ms, LiveKit, Daily, VideoSDK, and Amazon IVS.
- Published prices (checked July 2026 where dated; confirm on vendor sites **[VERIFY]**): ZEGOCLOUD lists voice at about $0.99 per 1,000 participant-minutes, HD video at about $3.99, and live streaming at about $0.39 per 1,000 minutes, with a free allowance. Agora lists comparable voice rates and a shared free monthly bucket. LiveKit and VideoSDK publish lower participant-minute rates for audio and video.
- Practical meaning: a 1:1 voice minute costs a fraction of a rupee. Video and big live audiences cost more, but the numbers are small against a ₹20–100/min consultation price (§20).
- Agora is described as having strong reach in Asia and weak-network performance; LiveKit as open-source and self-hostable; 100ms as an India-grown stack with prebuilt UI. All three are viable. **Your decision:** Cloudflare (RealtimeKit, Realtime SFU/TURN, and Stream if needed), see §17.5. Keep the RTC layer behind an interface so it can be swapped if the proof of concept fails (§17).
- **Cloudflare (your chosen provider).** Its docs and rates pages list RealtimeKit (SDKs with prebuilt UI) at $0.002 per participant-minute for audio/video and $0.0005 for audio-only, with recording, HLS or RTMP export at $0.010 per minute; Realtime SFU and TURN at $0.05 per GB of egress with 1,000 GB free each month; and Stream for stored and live video at about $1 per 1,000 minutes delivered. Cloudflare Realtime provides media transport, not chat, billing, moderation or phone-network calling, so those stay in our backend (§17.5). RealtimeKit is relatively new, so the plan includes a proof of concept before committing **[VERIFY]**.

- Agency price quotes found online for a consultation marketplace are in the range of US$80K–150K, but that comes from a vendor blog and should be treated as a rough marker only.

### 2.7 What I could not verify

- **titliapp.com** could not be opened (the site blocks automated access) and search found nothing reliable about it, so nothing here is based on it.
- Real astrologer earnings and churn at incumbents (only anecdotes exist).
- Exact current GST and TDS treatment for your specific structure.
- Whether Play will treat per-minute human consultations as digital goods.

---

## 3. Product strategy

### 3.1 Positioning

> *"Astrology you can check before you pay — live, transparent, and fair."*

### 3.2 Differentiators (in priority order)

1. **Watch before you pay.** Free scheduled live sessions with vetted astrologers, with a one-tap path into a private consult.
2. **Fair-billing guarantee.** Per-second billing, all-inclusive prices, no hidden recharge tricks, visible running meter, easy refunds.
3. **Verified astrologers with a visible trust score** (not just a "verified" badge): what was verified, how many sessions, complaint rate, repeat-user rate.
4. **No remedy pressure.** Astrologers never sell in chat. Any product or paid report goes through the Store with fixed prices, visible commission disclosure and easy returns (§13.8); strict rules on fear language.
5. **One language, done well first** (Hindi/Hinglish), then regional languages.
6. **Matched discovery.** Astrologers are clubbed into categories (§7.10), and a few skippable questions tailor the list by topic, language, mode and budget (§8.2.1).

### 3.3 Non-goals for v1

- No puja booking (needs third-party pandits and proof of service; Phase 3) and no consumables or medicinal products. The **Store** (paid reports and curated products) is planned for Phase 2 (§8.21, §21), and **astrologers sell only through the Store and the Recommendation tool, never in chat**.
- No subscriptions or auto-renewing plans.
- No AI "astrologer" replacing humans (optional AI help for astrologers in v3).
- No iOS at launch (Android first; web app optional later).
- No international payments at launch (NRIs in v2).
- No group video "mic requests" or co-hosting at launch.

### 3.4 Strategy risks to hold in mind

- **Cold-start liquidity.** Users want an astrologer in seconds, at all hours, in their language. Plan to recruit 30–50 vetted astrologers before public launch (§21).
- **Acquisition cost.** Incumbents outbid you on ads. Lean on free tools (Kundli, matching), live-session clips, and astrologers' own followers.
- **Live-stream whale dynamics.** Gifting can pressure vulnerable users. Gifts are held back to a later phase with strict caps (§10).

---

## 4. Design principles (the "trust contract")

Every screen and rule must pass these tests.

1. **Show the price before the user commits.** Always all-inclusive, always per-minute and with an example ("₹30/min — your ₹300 lasts 10 minutes").
2. **The meter is always visible.** Running cost and remaining balance during a session; "End" always one tap away.
3. **No false urgency.** No fake countdowns, no "only 2 astrologers left", no pre-ticked boxes, no guilt copy on cancel.
4. **Spending is the user's decision, with brakes.** Spend limits on by default; no auto-recharge by default.
5. **Un-curated reviews.** We never delete a review for being negative.
6. **The platform enforces conduct.** Astrologers who push fear, ask for money outside the app, or share contact details are removed.
7. **Respect vulnerable moments.** If a user sounds like they may harm themselves, we change behaviour (§13.6).
8. **Hindi-first, low-end-device-first.** Big text, clear icons, small app, works on weak networks.
9. **Everything has an owner and an audit trail.** Money movement and PII access are logged and reversible.
10. **Honest claims.** The app never promises outcomes ("guaranteed", "100% accurate") in copy or ads; astrologers are barred from doing so too.

---

## 5. Personas

### 5.1 User personas

| Persona | Who | Goal | Behaviour / needs |
|---|---|---|---|
| **Priya, 26** (metro or tier-2) | Working professional, Hinglish speaker | Marriage timing, career change | Heavy phone user, wary of being scammed, reads reviews, wants a woman astrologer sometimes |
| **Rakesh, 38** | Small business owner, Hindi | Business timing, family issues | Prefers voice calls over typing, impatient with long waits, sensitive to price |
| **Sunita, 52** | Homemaker, regional language | Children's marriage, health worries | Low digital confidence, big text, may be anxious and highly suggestible, needs strong protection |
| **Arjun, 22** | Student | Exam and love questions | Low budget, curious, tries free tools first, shares clips |
| **NRI user** (v2) | Settled abroad | Family matters | Pays by card, different time zone |

### 5.2 Astrologer personas

| Persona | Who | Needs |
|---|---|---|
| **Pt. Mohan, 58** | Traditional Vedic astrologer, Hindi only | Very simple app, voice instructions, predictable payouts |
| **Neha, 31** | Tarot and numerology reader, YouTube following | Live hosting tools, audience growth, analytics |
| **Dr. Iyer, 45** | KP/Nadi expert, Tamil/English | Regional-language matching, higher rate band |

### 5.3 Admin personas

Super admin; Astrologer onboarding reviewer; Support agent (L1 and L2); Finance; Trust & Safety moderator; Content manager; Growth/marketing manager; Read-only analyst; DPO / compliance officer. Permissions are in §11.12.

---

## 6. System overview

```
                       ┌────────────────────────────┐
                       │        Admin Panel         │
                       │  (web, RBAC, audit log)    │
                       └─────────────┬──────────────┘
                                     │
 ┌──────────────┐        ┌───────────▼───────────┐        ┌──────────────────┐
 │   User App   │◄──────►│       Backend API     │◄──────►│  Astrologer App  │
 │  (Android)   │        │ auth · wallet · billing│        │    (Android)     │
 └──────┬───────┘        │ sessions · live · KYC │        └────────┬─────────┘
        │                │ notifications · T&S   │                 │
        │                └───┬─────────┬─────┬───┘                 │
        │                    │         │     │                     │
        │           ┌────────▼──┐  ┌───▼───┐ ┌▼──────────┐         │
        └──────────►│ RTC vendor│  │Payments│ │ Ephemeris │◄────────┘
                    │ voice/vid/│  │gateway │ │ / kundli  │
                    │ live      │  │+payouts│ │  engine   │
                    └───────────┘  └────────┘ └───────────┘
```

**Roles:** `user`, `astrologer`, `admin` (with sub-roles). One phone number can hold a user account and an astrologer account, but they are separate profiles with separate wallets; the app prevents a person consulting themselves.

---

## 7. Core domain rules (shared by all three surfaces)

These rules decide behaviour everywhere. Change them here, not in individual screens.

### 7.1 Money model

- **Wallet** holds **prepaid service credits** in rupees (1 credit = ₹1). Credits are not cash and not transferable between users **[VERIFY structure with a lawyer, see §2.5]**.
- A **double-entry ledger** records every movement (recharge, session charge, refund, bonus, adjustment, payout). Balances are derived from the ledger; the balance is never edited directly.
- Ledger entries are immutable. Corrections are new entries.
- **Idempotency keys** on all payment and billing writes.

### 7.2 Pricing

- Each astrologer has a **rate per minute** for each mode (chat, voice, video), set within an **admin-controlled rate band for their tier**.
- Rate changes by an astrologer take effect **24 hours after** they are saved, and affected followers are told.
- **Displayed price is all-inclusive** (taxes included). Never show "+GST" at the point of choosing.
- Minimum balance to start = **5 minutes of the astrologer's rate** (configurable).

### 7.3 Billing (per-second, server-authoritative)

1. Billing starts only when **both sides are connected** (astrologer accepted and user joined).
2. Charged **per second**, from the server clock, not the client.
3. Billing **pauses** if either side loses connection for more than 10 seconds; both have 60 seconds to rejoin, after which the session ends and only connected time is charged.
4. The wallet cannot go negative. When balance drops below **60 seconds of cost**, the user gets a banner and a one-tap recharge; at zero the session ends with a 30-second grace to recharge and continue.
5. **15-minute check-in:** every 15 minutes the user is asked "Continue?" with a single tap; no tap within 60 seconds pauses the meter, and it ends after another 60.
6. No minimum charge per session beyond the seconds used; no rounding up to the next minute.
7. **Intro offer** (configurable): e.g., first 3 minutes with a new astrologer at a flat fixed price. Terms shown in full before use. No "free" label unless it is truly free.

### 7.4 Commission and earnings

- Commission is a **percentage of the session charge**, by astrologer tier, configurable per astrologer by admin (default band 20–30%; founding astrologers can start lower to help recruiting; see §22 for the decision).
- Earnings statuses: `pending` (session just ended) → `available` after a **hold period** (default 7 days, covering the refund window) → `paid` (after payout).
- Taxes (GST on commission, TDS on payouts) are computed at settlement (§12).

### 7.5 Reviews and ratings

- Only users with a **completed paid session of at least 3 minutes** can review.
- 1–5 stars, tag chips (positive and negative), optional text up to 500 chars.
- The astrologer can reply once publicly. Nobody can delete a review except for abuse, hate, or personal data; each removal is logged with a reason.
- Reviews show a "**Verified session**" label. Ratings use a Bayesian average so one 5-star review does not outrank 500 good ones.

### 7.6 Ranking (list order)

Score inputs (weights are configurable): rating (Bayesian), repeat-user rate, response rate (accepting requests), completion rate, complaint rate (negative), online hours in the last 7 days, language and topic match to the user. **Not an input in v1:** how many minutes the astrologer consumed per session, or any payment by the astrologer. Include an **exploration slot** so a few new, verified astrologers appear regardless of score. If sponsored placement is ever added, it is labelled "Sponsored". **Preference matching (§7.11)** adds a match score on top of quality, behind a quality gate; Store sales are never an input.

### 7.7 Refund rules

| Case | Rule | Decision |
|---|---|---|
| Astrologer no-show after connect, or a technical disconnect under 2 minutes | Full refund of that session | Automatic |
| Session under 2 minutes ended by user, no review | Case-by-case | Support, within SLA |
| Astrologer abuse, off-platform solicitation, fear-based pressure (verified by transcript) | Full refund + astrologer strike | Support / T&S |
| User dissatisfied with prediction content | Not refundable as such; offer a **free re-match** (3 minutes with another astrologer) once | Support discretion |
| Wallet balance unused | Refundable to source on request (see §22 re: policy) | Finance |
| Duplicate or failed payment | Auto-reverse by gateway reconciliation | Automatic |

**SLA:** acknowledge within 4 hours, resolve within 48 hours; the status is visible in the app.

### 7.8 Session lifecycle (state machine)

```
requested ──accept──► connecting ──both joined──► active ──end──► settling ──► completed
    │                     │                          │
    ├─decline/timeout──► expired      ├─drop>60s────► ended_by_disconnect ──► settling
    └─user cancels────► cancelled     └─zero balance─► ended_by_balance  ──► settling
                                        
active ──flagged by T&S──► frozen (admin decides) ──► settling
```

Only `active` time is billed. Transitions are logged with timestamps.

### 7.9 Supported languages and categories (launch)

- **UI languages:** Hindi, English. **Consultation languages:** Hindi, English, Hinglish. v2: Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi.
- **Systems:** Vedic, KP, Nadi, Lal Kitab, Tarot, Numerology, Vastu, Palmistry.
- **Topics:** Love, Marriage, Career, Money, Education, Family, Travel/Relocation, General. The full category tree, method tags and collections are in §7.10.
- **Health:** allowed only as general guidance with a disclaimer; astrologers may not diagnose, prescribe, or promise cures (**[VERIFY]** against magic-remedies law, §2.5).


### 7.10 Categories, methods, collections and capabilities

Astrologers are clubbed in three ways, because users search in three different ways.

| Grouping | What it answers | Example values | Who controls it |
|---|---|---|---|
| **Category** (topic club) | "What do I need help with?" | Love & Relationships · Marriage & Kundli Matching · Career & Job · Business & Money · Education & Exams · Family & Children · Property, Vastu & Home · Travel & Relocation · General Life Guidance | Admin defines; admin confirms each astrologer's categories |
| **Method tag** | "How does the astrologer work?" | Vedic · KP · Nadi · Lal Kitab · Tarot · Numerology · Vastu · Palmistry · Face reading | Astrologer declares; verified in the interview/test |
| **Collection** (curated or rule-based list) | "Show me a good starting list" | Top rated this month · New and verified · Hindi voice experts · Women astrologers · Budget friendly (under ₹20/min) · Live hosts | Admin; rule-based ones update automatically |

**Assignment rules**
- Each astrologer has **one primary category** (required) and up to **three secondary categories**. They request them; the admin approves based on the interview and test, so nobody can claim every category.
- Method tags are separate from categories (a Tarot reader can be in Love & Relationships).
- A **Health** category is **not** offered in v1 (see §7.9); general wellbeing questions fall under General Life Guidance with a disclaimer.

**Category pages.** Header (name, one-line description in Hindi/English, a short "how astrologers here help" note, category disclaimer), then shelves: *Live in this category* (shown only when something is live), *Top astrologers* (ranked per §7.6), *New and verified*, *Budget friendly*, and a filter bar. Category-specific content guardrails are shown to astrologers and enforced in QA (for example: no "your marriage will fail" absolutes in Marriage; no investment or trading tips in Business & Money).

**Capability flags (independent of each other).** Every astrologer has flags that decide what they can do and what appears on their profile.

| Flag | Meaning | Granted when |
|---|---|---|
| `consult_chat` / `consult_voice` / `consult_video` | Accepts that mode of 1:1 consultation | At approval; per mode, the astrologer chooses |
| `host_live` | May schedule and host live shows | After the **live audition** and live-conduct training (§10.8) |
| `recommend_items` | May use the Recommendation tool for Store items (§9.12) | Phase 2, after the Store training and quiz |
| `write_reports` | May fulfil paid written reports (§8.21.9) | Phase 2, after a sample report is approved |

**Design consequence:** the apps must work when only a few astrologers can host live and when the Store is switched off. Nothing in the UI may assume every astrologer has every capability.

### 7.11 Personalisation: preference matching

The skippable questions in §8.2.1 feed a **match score** that adjusts *order*, never *price* or *access*.

**Ranking formula (all weights configurable in §11.14):**

`rank = quality_score × quality_gate + w_match × match_score`

- `quality_score` is the §7.6 score (rating, repeat rate, response, complaints).
- `quality_gate` is 1 only for astrologers above minimum rating and complaint thresholds, or in the exploration slot; others are not boosted by preferences.
- `match_score` (0 to 1) is a weighted sum. Suggested starting weights:

| Signal | Source | Weight |
|---|---|---|
| Topic/category overlap | Q1 | 0.35 |
| Language | Q2 | 0.30 |
| Mode (chat/voice/video) | Q3 | 0.15 |
| Budget fit | Q4 | 0.10 |
| Gender preference | Q5 | 0.10 |

**Rules**
1. **Language is near-hard:** if the user chose Hindi, astrologers who do not consult in Hindi are excluded from "Your picks" (they remain visible in the full list).
2. **Budget is soft:** it orders results and adds a "Within your budget" tag, but never hides higher-priced astrologers.
3. **Price and commission are never ranking inputs.** Neither are Store sales or recommendation revenue (§13.8).
4. **Availability:** online astrologers first; up to two "great match, currently offline" cards with "Notify me".
5. **Exploration slot:** a few new verified astrologers appear within matches regardless of score.
6. **Explainable:** each pick shows a plain reason ("Hindi · Career · Voice · within your budget"). Store the score components for sampled impressions so a result can be explained later.
7. **User control:** "Show everyone" switches personalisation off for the list; preferences can be edited or deleted any time.
8. **Cold start:** with no answers, use the default ranking (§7.6) and the device language for the UI only.
9. **Later (v2):** behaviour-based re-ranking from clicks and consultations, with an opt-out. Free-text and sensitive details are never used.

---
## 8. User app specification

### 8.0 Design constraints (apply to every screen)

- **Android first**, supporting Android 8+ and low-RAM devices. Target app download under about 30–40 MB. Offer a data-saver mode.
- **Weak networks:** chat must queue and resend; voice should degrade gracefully; the app must resume an active session after a brief drop.
- **Typography:** Devanagari-friendly font; scalable text; touch targets of at least 48dp; icon + label (never icon alone); TalkBack labels on all controls.
- **Language switch** available on the first screen and in Settings; string files for every UI text.
- **Browse before login:** a visitor can see astrologers, live schedule, and free tools before signing in. Login is required at "Start session", "Recharge", "Follow", or "Remind me". This raises conversion and avoids forcing an OTP before value.

### 8.1 Navigation map

Bottom navigation (4 tabs, or 5 when the Store is enabled): **Home · Live · Chats (History) · [Store] · Profile**. A persistent **wallet chip** (balance) sits top-right on Home, Live, and astrologer screens.

```
Splash ─► Language ─► [Intro cards (skippable)] ─► Home
Home ──► Astrologer list ──► Astrologer profile ──► Pre-session sheet ──► Connecting ──► Session ──► Post-session
Home ──► Live tab ──► Live room ──► (Ask privately → Pre-session sheet)
Home ──► Free tools (Kundli, Matching, Horoscope, Panchang)
Home ──► Browse by category ──► Category page ──► Astrologer list
Home ──► Your picks (only if the preference questions were answered)
Store ──► Product ──► Cart ──► Checkout ──► Order tracking   (Phase 2, §8.21)
Wallet ──► Recharge ──► Payment ──► Success
Profile ──► Birth profiles · Spend controls · Orders · Refunds · Privacy · Support · Settings
```

### 8.2 First-run flow (step by step)

| Step | Screen | What the user does | Notes |
|---|---|---|---|
| 1 | Splash | Waits under 2 s | Show logo only |
| 2 | Language | Picks Hindi / English | Saved locally; changeable later |
| 3 | Intro cards | Swipes or taps "Skip" | Max 3 cards: (1) verified astrologers, (2) watch live free, (3) fair per-second billing |
| 4 | Preference questions (skippable) | Answers up to 5 quick questions or taps **Skip all** | See §8.2.1; answers stay on the device until login |
| 5 | Home | Browses | Shows "Your picks" if answered; no login yet |
| 6 | Soft prompt | On first "Start session" / "Recharge" | Opens login sheet |
| 7 | Login | Enters mobile, OTP | See §8.3 |
| 8 | Birth profile | Fills birth details | Can skip for the first session; the astrologer can ask in chat; but kundli tools need it |
| 9 | First recharge or intro offer | Starts the first session | Intro offer terms visible |

### 8.2.1 Preference questions (skippable) and matched discovery

**Purpose:** help a first-time user reach a relevant astrologer faster. It must never feel like a gate.

**Placement and behaviour**
- Shown once, after the intro cards and before Home. One question per screen, big option chips, progress dots, about 30 seconds in total.
- **"Skip all" is visible on every screen**, and every question has "Not sure / No preference". No answer is required for anything.
- Works **without login**: answers are kept on the device. At login the user is told what will be saved and can choose to save them to the account (this is covered by the privacy notice in §8.3). If they decline, the answers stay local and are cleared on logout or uninstall.
- If skipped, show **one** gentle Home card ("Get matched in 20 seconds"), at most twice, dismissible. No repeated prompting.
- Editable any time: Profile → **My preferences**. A "Show everyone" toggle turns matching off.

**Questions** (English shown; Hindi versions live in the CMS)

| # | Question | Type | Options | Used for |
|---|---|---|---|---|
| Q1 | "What would you like guidance on?" | Multi-select, up to 3 | Love & relationships · Marriage & Kundli matching · Career & job · Business & money · Education · Family & children · Property & Vastu · Travel & relocation · General life · Not sure | Category match |
| Q2 | "Which language are you most comfortable in?" | Multi-select, up to 2 | Hindi · English · Hinglish · (other languages as enabled) | Language match |
| Q3 | "How would you like to consult?" | Multi-select | Chat · Voice call · Video call · Watch live sessions first | Mode match; shows the Live shelf for the last option |
| Q4 | "What feels like a comfortable budget per minute?" | Single select | Under ₹20 · ₹20–50 · ₹50–100 · Above ₹100 · No preference | Budget fit (soft) |
| Q5 | "Do you prefer an astrologer of a particular gender?" | Single select | Woman · Man · No preference | Gender preference |
| Q6 (optional, later) | "Have you consulted an astrologer online before?" | Single select | Many times · A few times · Never | Shows first-timer tips ("How billing works") instead of changing ranking |

**Stored fields** (`user_preferences`, §15): `topics[]`, `languages[]`, `modes[]`, `budget_band`, `gender_pref`, `first_time`, `answered_at`, `skipped_at`, `source` (device/account), `consent_version`.

**Privacy rules**
- Do **not** ask about health, marital status, income, or religion in this flow.
- Topic answers can reveal sensitive circumstances (for example, relationship trouble), so treat them as sensitive: encrypted at rest, used only for recommendations, deletable, never used for marketing targeting without separate consent.
- Answers are **not shared with astrologers**. If the user starts a session, the topic is pre-filled in the pre-session sheet and the user can change it.
- Budget answers are never used to raise prices or target upsells.

**Result on screen**
- Home shows **Your picks** (six astrologers, each with a one-line reason) and category tiles reordered by Q1.
- The astrologer list defaults to "Recommended for you" with a visible **Show everyone** switch.
- If nothing matches, show the closest options and say why ("No Tamil-speaking career astrologer is online right now; here are Hindi speakers in Career").

**States:** skipped all, partially answered, offline (answers saved locally), edit later, reset.

### 8.3 Login and consent (screen S2)

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Country code | Picker | Yes | Default +91; v2 adds others |
| Mobile number | Numeric | Yes | 10 digits for +91, must not start with 0–5; rate-limited |
| OTP | 6-digit numeric | Yes | Auto-read via SMS retriever; 5-minute expiry; 30-second resend; lock after 5 wrong tries for 15 minutes |
| Terms & Privacy consent | Checkbox | Yes | **Unticked by default**; links open the full documents; consent version stored |
| "I am 18 years or older" | Checkbox | Yes | Unticked by default; the app is for adults only in v1 (avoids parental consent duties under the DPDP Rules) |
| Marketing messages (SMS/WhatsApp/push) | Checkbox | No | **Unticked**; separate from terms |
| Google sign-in | Button | No | Optional alternative; still needs a verified mobile before the first paid session |

Also show a short DPDP-style notice: what data is collected, why, who sees it, how to withdraw consent. Store consent logs (§14.3).

**States:** wrong OTP, expired OTP, number blocked, network error, rate limit reached (with plain explanation).

### 8.4 Birth profile (screen S3)

Users can hold **multiple profiles** (self, spouse, child, parent) because users often ask about family.

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Profile label | Text / chips | Yes | "Self", "Wife", "Mother", custom (max 30 chars) |
| Full name | Text | Yes | 2–60 chars, letters and spaces; supports Devanagari |
| Gender | Radio | Yes | Female / Male / Other / Prefer not to say |
| Date of birth | Date picker | Yes | Not in the future; 18+ is required only for the account holder's own profile |
| Time of birth | Time picker | Preferred | Option: **"I don't know"** → asks for a rough window (morning/afternoon/evening/night); tells the user that some predictions need exact time |
| Place of birth | Autocomplete | Yes | City/town search; stores latitude, longitude, and timezone; **uses historical timezone data** (India had atypical offsets in some past years) |
| Marital status | Dropdown | No | Optional, sensitive |
| Occupation | Dropdown | No | Optional, sensitive |
| Primary concern | Chips | No | Love / Marriage / Career / Money / Education / Family / Other |
| Preferred languages | Multi-select | Yes (at least 1) | Drives list filtering |

Privacy note on screen: "Only the astrologer you consult sees these details."

### 8.5 Home (screen S4)

Order of sections from top to bottom (reorder through admin config):

1. **Header:** greeting, wallet chip, notifications bell.
2. **Search bar:** "Search astrologers, topics, languages".
3. **Browse by category:** tiles from the category tree (§7.10), reordered by the user's Q1 answer if given; tapping opens the category page.
3a. **Your picks:** only if the user answered the preference questions; six matched astrologers, each with a one-line reason (for example "Hindi · Career · within your budget") and an **Edit preferences** link.
4. **Live now / starting soon:** horizontal cards with astrologer, title, viewer count, "Remind me".
5. **Recommended astrologers:** 6 cards, "See all".
6. **Free tools:** Kundli · Matching · Daily horoscope · Panchang.
7. **Continue with…:** astrologers the user consulted before (if any), with "Chat again".
8. **Trust strip:** "Per-second billing · Verified astrologers · Honest reviews", tap → fairness page.
9. **Footer disclaimer:** "Astrology is guidance, not a guarantee. Not a substitute for medical, legal, or financial advice."

No banners with countdowns. No auto-playing sound.

### 8.6 Astrologer list (screen S5)

**Card content:** photo, name, verified badge, primary category label, optional **Live host** badge, a one-line **"why this astrologer"** reason when preferences exist, rating (stars + count), experience years, languages, top 3 expertise, price per minute (cheapest available mode), status (Online / Busy · ~X min wait / Offline), buttons: **Chat · Call**.

**Filters** (bottom sheet):

| Filter | Type | Notes |
|---|---|---|
| Category | Multi-select | From the category tree (§7.10) |
| Hosts live shows | Toggle | Shows astrologers with the **Live host** badge |
| Language | Multi-select | |
| Expertise / system | Multi-select | |
| Topic | Multi-select | |
| Price per minute | Range slider | Min–max from live data |
| Rating | Select | 4+ / 4.5+ |
| Gender | Select | Some users prefer a woman astrologer |
| Mode | Chips | Chat / Voice / Video |
| Availability | Toggle | "Online now" |

**Personalisation:** when the user answered the preference questions, "Recommended" uses the match score (§7.11); a **Show everyone** switch returns the standard order.

**Sort:** Recommended (default) · Rating · Price low→high · Price high→low · Experience.
**Empty and error states:** no results (offer "clear filters" and "request a callback"), network offline (cached list with a notice).

### 8.7 Astrologer profile (screen S6)

Sections: header (photo, name, badge, **category chips**, rating, sessions completed, and a **Live host** badge only if the astrologer hosts shows), **Trust panel**, price table per mode, about, languages, expertise, **reviews**, follow, "Upcoming live" (only if any), and the CTA bar.

**Trust panel (a key differentiator):**
- "Identity verified", "Qualification checked", "Passed our interview and test" (only show each if true).
- Sessions completed, repeat-user %, response rate, complaint rate band (Low/Medium/High, hidden until enough data).
- "Member since".

**Reviews list:** star filter, "Most recent / Lowest rated" sort, "Verified session" tag, astrologer replies. **No** hiding of low ratings.

**CTA bar:** three buttons (Chat / Call / Video) with price each, and "Follow" and "Share" icons. If the astrologer is busy: "Join queue (about N min)" or "Notify me".

### 8.8 Pre-session sheet (screen S7) — "show the price before you commit"

| Element | Type | Required | Notes |
|---|---|---|---|
| Mode | Segmented | Yes | Chat / Voice / Video (disabled if astrologer does not offer it) |
| Birth profile | Dropdown | Yes | Defaults to "Self"; "Add new" |
| Topic | Chips | Yes | One of the standard topics |
| Your question | Text | No | Max 300 chars; the astrologer sees it before accepting |
| Price line | Read-only | — | "₹30 per minute, taxes included. Billed per second." |
| Balance line | Read-only | — | "Your balance ₹300 lasts about 10 minutes." |
| Intro offer line | Read-only | — | Shown only if eligible; full terms link |
| Primary button | Button | — | "Start chat — ₹30/min" |

If the balance is below the minimum, the primary button becomes "Recharge ₹X to start" and opens the recharge sheet with the exact shortfall prefilled (**no upsell to a bigger pack**).

### 8.9 Wallet and recharge (screens S8)

**Wallet screen:** balance, "Add money", recent transactions, link to full ledger, link to spend controls, "Withdraw unused balance" (§22).

**Recharge sheet:**

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Amount | Chips + custom field | Yes | Chips ₹100 / ₹200 / ₹500 / ₹1,000 / ₹2,000; custom ₹50–₹10,000 per transaction (configurable); **no chip is pre-selected** |
| Price breakdown | Read-only | — | "You pay ₹X, you get ₹X credits" with tax shown on the invoice, not as a surprise at the end |
| Payment method | List | Yes | UPI (intent) first, cards, netbanking, wallets |
| Coupon code | Text | No | Collapsed by default |

**Rules:** no bonus-credit schemes in v1 (they blur the real price); no countdown; no "most popular" tags that push larger amounts; daily and monthly limits from §8.17 are enforced here with a clear message.

**Success screen:** amount credited, receipt, "Continue to chat" (returns to where the user left off).
**Failure:** plain reason, "Try another method", and a note "If money was deducted it will be reversed or credited automatically within X hours", and a support link.

### 8.10 Connecting and queue (screen S9)

1. User taps start → request sent → astrologer sees it.
2. Screen shows astrologer photo, "Waiting for [Name] to accept (up to 60 s)", a cancel button, **no charge until accepted**.
3. If declined or timed out → "[Name] is unavailable. Try these online astrologers" (3 similar suggestions) or "Notify me when available".
4. If the astrologer is busy → optional queue with an estimated wait, cancellable any time; a push notification fires when it is the user's turn, who then has 60 seconds to confirm (so users are not auto-charged while away).

### 8.11 Chat session (screen S10a)

**Layout:** header (name, status, **timer**, **running cost**, **balance left**), message list, input bar, "End session" (always visible, with a confirm sheet), overflow menu (Report, View birth profile, Share kundli).

**Message types (v1):** text, voice note (up to 60 s), kundli chart card, image (user can send screenshots; both sides can report). No file attachments, no payment links, no phone numbers (§13.3).

**Behaviours:**
- **Low-balance banner** at 60 seconds of cost left, with "Add ₹X".
- **15-minute check-in** card: "You've been chatting for 15 minutes — continue?" [Continue] [End].
- Disconnect banner with "Reconnecting…"; billing paused indicator.
- **Typing indicator** and read receipts.
- **Blocked content:** messages with phone numbers, UPI IDs, or external links are not delivered; the sender sees "For your safety, sharing contact details or payment links is not allowed." The event is logged for T&S.
- Crisis support card, if triggered (§13.6).

### 8.12 Voice / video session (screens S10b/S10c)

Controls: mute, speaker, camera on/off, flip camera (video), end. Header shows timer, cost, balance. If the network is poor, show a quality indicator and offer a switch to chat (billed at chat rate) so the session is not wasted. Audio/video are never recorded without notice (§14.4).

### 8.13 Post-session (screen S11)

| Element | Type | Required | Notes |
|---|---|---|---|
| Summary | Read-only | — | Duration, rate, amount charged, balance left, receipt link |
| Star rating | 1–5 | No (but prompted) | Dismissible; shown only if the session was at least 3 minutes |
| Quick tags | Chips | No | Positive: Clear · Respectful · Insightful · Patient. **Negative:** Created fear · Pushed remedies/products · Asked for money outside app · Rude · Not what I asked |
| Written review | Text | No | Max 500 chars; no phone numbers or links |
| Tip astrologer | Amount chips | No | Optional; ₹10 / ₹20 / ₹50 / custom, from the wallet; **never pre-selected** |
| Follow | Toggle | No | |
| "Something went wrong" | Button | — | Opens the report and refund flow (§8.14) |
| Book follow-up | Button | — | Pre-fills a new session or scheduled slot (v2) |

### 8.14 Reporting and refunds (screen S13)

1. Entry points: post-session, order detail, in-session overflow menu.
2. Reason (single select): Astrologer didn't join · Connection problem · Astrologer was rude · Astrologer pushed me to pay outside / buy something · Asked for personal details/contact · Scary or fear-based claims · Charged incorrectly · Other.
3. Optional text (max 500 chars) and optional screenshot.
4. Result: if the case matches an auto-refund rule (§7.7), refund immediately with confirmation; otherwise create a ticket with a reference number, show the SLA, and notify on resolution.
5. A report about conduct also creates a T&S case (§13).

### 8.15 Live tab and live room (screens S14a/S14b)

(Details of behaviour and moderation in §10.)

**Live tab:** "Live now", "Starting soon" (with Remind me), "Past highlights" (clips, v2), filter by language and topic. **Not every astrologer hosts live**, so the tab also shows "Meet our live hosts" and "Upcoming this week" and is never an empty screen (§10.8).

**Live room layout:** video area; astrologer name and badge; viewer count; chat panel; **"Ask a question"** (adds to the queue); **"Consult privately"** (→ pre-session sheet with the astrologer preselected); follow; share; report; leave. v1.1 adds the gifts button (§10.5).

**User inputs in the live room:**

| Field | Type | Notes |
|---|---|---|
| Chat message | Text | Max 200 chars, rate-limited (e.g., 1 message per 2 seconds), emojis allowed, links and numbers blocked |
| Question for the astrologer | Text | Max 200 chars, up to 1 per user per show in free mode; astrologer picks from the queue |
| Report | Reason + text | Mute and ban actions go to the host and moderators |

### 8.16 Free tools (screen S15)

| Tool | Inputs | Output | Notes |
|---|---|---|---|
| **Kundli** | Birth profile (§8.4) | Chart (North/South Indian style), planet positions, Dasha, basic report | Free; computed server-side; ends with a soft "Discuss with an astrologer" |
| **Kundli matching** | Two profiles | Guna Milan score with a plain explanation, Manglik note | Avoid definitive "marriage will fail" wording; use neutral language |
| **Daily horoscope** | Moon sign / Sun sign | Short text per day (Hindi/English) | Editorial content in CMS (§11.10) |
| **Panchang** | Date and place | Tithi, nakshatra, yoga, karana, sunrise/sunset | |

Every output carries a short disclaimer and the astrology system used (e.g., Lahiri ayanamsa) in a small footnote.

### 8.17 Profile and settings (screen S17)

| Section | Content / inputs |
|---|---|
| **My profiles** | List of birth profiles; add/edit/delete |
| **Spend controls** | Daily recharge limit (default ₹2,000, user can lower or raise within caps; raising takes effect after 24 hours); monthly limit; "Remind me when I've spent ₹X this month"; auto-recharge is **off** and not offered in v1 |
| **My spending** | This month's total, per-astrologer totals |
| **Orders & invoices** | Sessions list with download receipt/GST invoice |
| **Refunds** | Status of each |
| **Blocked astrologers** | List with unblock |
| **Notifications** | Toggles: session updates (not optional), live reminders, offers, WhatsApp |
| **Language** | Hindi/English |
| **Privacy & data** | Download my data, correct my data, withdraw consent, delete my account (DPDP rights); consent history |
| **Support** | FAQs, chat with support, tickets |
| **About** | Terms, privacy policy, grievance officer contact, DPO contact, app version |

**Delete account:** a 7-day cooling-off, shows remaining balance and what will be erased vs retained for legal reasons (invoices and ledger are kept as the law requires **[VERIFY retention]**).

### 8.18 Support (screen S18)

- FAQ search, categories (Payments, Session issues, Refunds, Astrologer conduct, Account).
- Ticket form: category, related session (picker), description (max 1,000 chars), attachment (screenshot).
- In-app chat with support (business hours first; extend later).
- Status tracker for tickets with SLA clock.

### 8.19 Notifications (user)

| Trigger | Channel | Notes |
|---|---|---|
| Astrologer accepted / declined | Push + in-app | Critical, always on |
| Your turn in queue | Push (high priority) | Needs a 60-s confirm |
| Session low balance | In-app | |
| Payment success / failure | Push + SMS | Transactional |
| Refund status | Push | |
| Live show reminder (15 min and at start) | Push | User-controlled |
| Followed astrologer is online / live | Push | User-controlled; rate-limited (max 3/day) |
| Offers | Push / WhatsApp | **Only with consent**; max 2/week; quiet hours 9 pm–9 am |

### 8.20 Edge cases to handle

- User kills the app mid-session → session stays active for 60 s, then ends via the disconnect rule.
- Two devices logged in with the same number → one active session at a time; the older device is signed out.
- Astrologer goes offline mid-queue → users in the queue are notified and offered alternatives.
- Payment succeeds but the app does not return → wallet is credited by server webhook and the user is notified.
- User changes birth details after the session starts → blocked while a session is active.
- Time or timezone manipulation on the device → server time only.
- Rapid repeated sessions with refund claims → fraud flag (§13.5).


### 8.21 Store: products and paid reports (Phase 2)

**What "selling" means here.** I read your note as selling products and paid services through the app, in the way Astrotalk's store does (gemstones, rudraksha, Vastu items, and similar). Incumbent experience shows why this is attractive and why it is risky: Astrotalk's store reportedly reached about ₹140 crore in its first year, and coverage describes gemstone sales as driven by astrologer prescriptions. That same dynamic is behind the "remedy upselling" complaints in §2.3. So the Store is built on rails (§13.8).

**Recommended operating model:** start **first-party or curated drop-ship**, where the platform is the seller of record. This keeps authenticity checks, pricing and returns under your control. Open third-party marketplace selling comes only later (§22).

**Sequence inside Phase 2 (least risky first):**
- **Stage A, digital reports** (no stock, no shipping): Kundli report, Marriage report, Yearly forecast, Career report.
- **Stage B, curated physical products** (20–30 items): certified gemstones, rudraksha and malas, yantras and idols, Vastu items, puja items.
- **Stage C, wider catalogue / third-party sellers**, only if returns and complaints are healthy.
- **Not planned:** puja booking (needs third-party pandits and proof of service, Phase 3) and **consumables or medicinal products** (avoid food/AYUSH-type claims).

#### 8.21.1 Principles

1. The Store is **separate from consultations**. It never opens by itself inside a chat.
2. One fixed **price per item**, shown **all-inclusive** (taxes and shipping visible up front). No negotiation, no astrologer-set prices.
3. **No outcome claims** in product copy ("brings wealth in 7 days"). Descriptions are reviewed before publishing.
4. **Authenticity is visible:** for gemstones, show the lab certificate, origin, and treatments (natural, heated, or otherwise); for high-value items, show photos of the actual piece.
5. **Easy returns** and a visible refund SLA.
6. **Astrologer attribution is disclosed** whenever a purchase was recommended (§8.21.8).
7. Real MRP only. No fake discounts, countdowns or "only 2 left" (same dark-pattern rules as §14.2).

#### 8.21.2 Navigation

A **Store** tab appears (5th tab) when the feature flag is on: **Home · Live · Chats · Store · Profile**. When off, the app shows four tabs.

```
Store home ──► Category ──► Product list ──► Product detail ──► Cart ──► Checkout ──► Payment ──► Order success
Store home ──► Reports & services ──► Report detail ──► Order form ──► Payment
Profile ──► My orders ──► Order detail ──► Track / Return / Invoice / Help
Chat ──► Recommendation card ──► Product detail (or Save for later)
```

#### 8.21.3 Store home (screen St1)

Search bar; categories: **Gemstones · Rudraksha & Malas · Yantras & Idols · Vastu items · Puja items · Reports & Services**; "Saved from your consultations" (items astrologers recommended to this user); banners from the CMS (no countdowns). Footer: authenticity promise, return policy link, grievance contact.

#### 8.21.4 Product list (St2)

| Filter | Type | Notes |
|---|---|---|
| Category / sub-category | Select | |
| Price range | Slider | |
| Material / type | Multi-select | For example gemstone type, mukhi count |
| Certified | Toggle | Items with a lab certificate |
| Rating | Select | 4+ |
| Delivery speed | Select | From pincode estimate |
| Sort | Select | Relevance (default), price low→high, price high→low, rating, newest |

Sorting by relevance must not use astrologer commission or sales as inputs.

#### 8.21.5 Product detail (St3)

| Element | Notes |
|---|---|
| Image gallery | At least 4 images for physical goods; the actual piece for high-value items |
| Title, MRP, selling price, "inclusive of all taxes" | Discount shown only if the MRP is genuine |
| Variant picker | Size, weight, carat, ring size, mukhi (item-specific) |
| **Pincode check** | 6-digit field; shows deliverable or not, estimated date, COD availability |
| **Authenticity panel** | Lab certificate (image/PDF), origin, treatment disclosure, material |
| **"What this is and isn't"** | Neutral line: traditional belief, no guaranteed outcome, not a medical treatment |
| Return policy summary | Window, conditions, who pays pickup |
| Reviews | Verified buyers only; un-curated (same rule as §7.5) |
| **"Recommended by [Name]"** | Shown only if the user arrived from a recommendation, with the commission disclosure (§8.21.8) |
| Buttons | Add to cart · Buy now · Save for later |

#### 8.21.6 Cart and checkout (St4, St5)

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Items, quantity | Stepper | Yes | Quantity limits per item |
| Coupon code | Text | No | Collapsed by default |
| Full name | Text | Yes | 2–60 chars |
| Mobile | Numeric | Yes | Pre-filled from the verified account |
| Pincode | 6 digits | Yes | Auto-fills city and state; checks serviceability |
| Address line 1 | Text | Yes | 5–100 chars |
| Address line 2 / landmark | Text | No | |
| City, State | Auto-filled | Yes | Editable only if the lookup is wrong |
| Address type | Chips | No | Home / Work / Other |
| Delivery instructions | Text | No | Max 100 chars |
| GST invoice | Toggle + GSTIN | No | GSTIN format check |
| Payment method | List | Yes | UPI, cards, netbanking; **COD only if enabled**, with limit and fee shown before selecting |
| Order summary | Read-only | — | Item total, shipping, taxes, COD fee (if any), grand total |

**High-value purchase friction (configurable, default above ₹5,000):** an extra confirmation screen showing the item, certificate summary and return policy, with the line "Take your time; you can buy this later." The user must tap a clear confirm button. **Items recommended during a session above this value cannot be bought until the session has ended.**

#### 8.21.7 Orders, tracking and returns (St6 to St8)

**Order states:** Placed → Paid → Packed → Shipped → Out for delivery → Delivered → Return window → Closed (plus Cancelled, Return requested, Returned, Refunded).

**Return/refund form**

| Field | Type | Required | Notes |
|---|---|---|---|
| Reason | Single select | Yes | Wrong item · Damaged · Not as described · Doubt about authenticity · Changed my mind (if the policy allows) · Other |
| Photos | Image upload, up to 4 | For damage / wrong item | |
| Comments | Text | No | Max 500 chars |
| Pickup address | Select | Yes | Defaults to the delivery address |
| Refund to | Select | Yes | Original payment source (default) or wallet |

Rules: damaged or wrong-item cases with photos are approved automatically; others go to QC. Refund SLA is shown at submission. Cancelling is allowed until the item is shipped.

#### 8.21.8 Recommendation card in chat (user side)

A recommended item appears as a card: image, name, **price (inclusive)**, "Why [Name] suggested this" (the astrologer's reason), the line **"[Name] earns a commission if you buy this."**, and buttons **View details · Save for later · Not for me**. There is **no "Buy now" inside the chat**. "Not for me" hides further recommendations for that session. A setting (Profile → Store preferences) lets the user turn recommendations off entirely.

#### 8.21.9 Reports and services (digital)

| Field | Type | Required | Notes |
|---|---|---|---|
| Report type | Select | Yes | Kundli · Marriage · Yearly forecast · Career |
| Birth profile(s) | Picker | Yes | One or two profiles (matching) |
| Your question | Text | No | Max 300 chars |
| Language | Select | Yes | |
| Astrologer | Select | No | Auto-assigned unless the user picks from approved report writers |
| Delivery promise | Read-only | — | For example "within 48 hours", PDF in the app |

If the report is not delivered by the promised time, the user is refunded automatically. One short clarification message is included.

**Notifications (Store):** order placed, payment failed, shipped, out for delivery, delivered, return updates, report delivered, review request (once, not repeated).

---
## 9. Astrologer app specification

### 9.0 Design constraints

- **Radical simplicity.** Many astrologers are not tech-savvy. Large buttons, Hindi-first, minimal text, voice prompts where helpful ("आप ऑनलाइन हैं").
- **One main screen:** a big Online/Offline toggle, today's earnings, and incoming requests. Everything else is secondary.
- **Loud, reliable alerts** for incoming requests (full-screen call-style notification, even when the app is in the background, subject to Android limits).
- **Assisted onboarding:** an ops person can fill the application on the astrologer's behalf over a call, with the astrologer confirming by OTP.

### 9.1 Navigation

Bottom tabs: **Home · Live · Earnings · Profile**. Sessions and Performance live under Home/Profile.

### 9.2 Application and onboarding flow

```
Download ─► Language ─► Mobile + OTP ─► Application form (multi-step, save & resume)
     ─► Document upload ─► Bank/UPI + PAN ─► Intro video ─► Sign agreements
     ─► Submitted ─► [Admin review] ─► Test & interview ─► Approved ─► Training ─► Go live
```

**Status shown to the astrologer:** Draft → Submitted → In review → Needs changes → Test/Interview scheduled → Approved → Active (or Rejected with reason and reapply date).

#### Step 1 — Account

| Field | Type | Required | Notes |
|---|---|---|---|
| Mobile + OTP | Numeric | Yes | Same rules as the user app |
| Language | Picker | Yes | |
| Referral code | Text | No | If invited by an ops person or another astrologer |

#### Step 2 — Personal details

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Full name (as on ID) | Text | Yes | Matched to the ID and bank name |
| Display name | Text | Yes | Shown to users; admin may require a change if misleading (e.g., invented titles like "Dr." without proof) |
| Gender | Radio | Yes | |
| Date of birth | Date | Yes | Must be 18+ |
| Photo | Camera/gallery | Yes | Clear face, no filters; liveness check via selfie capture **[VERIFY vendor]** |
| City, state | Picker | Yes | |
| Email | Text | No | |

#### Step 3 — Expertise

| Field | Type | Required | Notes |
|---|---|---|---|
| Systems practised | Multi-select | Yes (at least 1) | Vedic, KP, Nadi, Lal Kitab, Tarot, Numerology, Vastu, Palmistry, other |
| Topics | Multi-select | Yes | Love, Marriage, Career, Money, Education, Family, etc. |
| Languages for consultation | Multi-select | Yes | Each marked Fluent or Conversational |
| Years of experience | Number | Yes | 0–60 |
| How did you learn? | Dropdown + text | Yes | Family tradition / Guru / Institution / Self-taught |
| Qualifications and certificates | Text + upload | No | Increases the trust badge; verified only if documents are provided |
| Notable work or following | Text + links | No | YouTube/Instagram links help our review; **never displayed** unless the astrologer agrees |
| Short bio | Text | Yes | 150–500 chars; **no claims such as "guaranteed", "100% accurate", "solve any problem in 24 hours"** (checked automatically and by the reviewer) |

#### Step 3b — Category, and what you want to do here

| Field | Type | Required | Notes |
|---|---|---|---|
| Primary category | Single select | Yes | One of the topic categories (§7.10); admin confirms |
| Secondary categories | Multi-select, up to 3 | No | Must be supported by the test or interview |
| What would you like to do on the platform? | Multi-select | Yes (at least one) | **1:1 consultations** (default) · **Host live shows** · **Recommend items from the Store** · **Write paid reports** |
| Live sample | 2-minute on-camera video | Only if "Host live shows" | Reviewed before the live audition (§10.8) |
| Sample report | Upload | Only if "Write paid reports" | Reviewed by an admin |

**Live, Store and reports are separate approvals.** An astrologer can start with 1:1 only and add the rest later from Profile → **Grow**.

#### Step 4 — Identity and payouts

| Field | Type | Required | Notes |
|---|---|---|---|
| PAN | Text + upload | Yes | Needed for tax deduction; validated; name matched |
| ID proof | Select + upload | Yes | One of: Aadhaar (masked), Passport, Driving Licence, Voter ID. Prefer DigiLocker or offline e-KYC to avoid storing full Aadhaar **[VERIFY]** |
| Bank account or UPI ID | Text | Yes | Account number + IFSC, or UPI; **penny-drop verification**, name must match PAN/ID |
| GSTIN | Text | No | Only if the astrologer is GST-registered (affects invoicing) **[VERIFY]** |
| Address | Text | Yes | For tax records |

#### Step 5 — Intro video and sample

| Field | Type | Required | Notes |
|---|---|---|---|
| Intro video (60 s) | Record in-app | Yes | "Introduce yourself and how you work"; used by reviewers and, if approved, on the profile |
| Mock reading | Sample chart answer | Yes for test | See §9.3 |

#### Step 6 — Rates (initial ask)

| Field | Type | Required | Notes |
|---|---|---|---|
| Requested rate per minute, chat / voice / video | Numbers | Yes | Admin approves final rates within the tier band; new astrologers start in the entry band |
| Availability (typical) | Weekly slots | Yes | Helps ops plan coverage |

#### Step 7 — Agreements (e-sign)

- **Code of conduct** (see §13.2) — must scroll to the end, then tick.
- **Commercial terms:** commission, payout schedule, tax deduction, termination, strike policy.
- **Data and privacy undertaking:** user data confidentiality and no external sharing.
- **Content rules:** no fear-based claims, no medical/legal/financial advice, and **no selling outside the Store and Recommendation tool** (§13.8).
- E-signature via OTP; versions stored with timestamps.

### 9.3 Vetting process (admin side in §11.3)

A reviewer scorecard (0–5 each) gives a consistent decision:

| Criterion | What is checked |
|---|---|
| Identity and documents | ID, PAN, bank name match; no duplicate accounts |
| Domain knowledge | Written answers to 3 sample charts; one oral interview on method |
| Communication | Clarity, empathy, language fluency in a 10-minute mock session |
| Ethics | Scenario questions: "User is scared and asks about death", "Would you recommend a gemstone?", "User asks to continue off-app" |
| Digital readiness | Can the astrologer use the app, handle connectivity |

Decision rule: pass needs a minimum total and a pass on Ethics (**Ethics is a hard gate**). Record the decision with the reviewer's name. Reapply after 30 days if rejected.

### 9.4 Training before going live

Short, mostly video and audio modules, then a **policy quiz** (must pass to activate):

1. How billing works (per-second, check-ins).
2. Conduct rules and examples of what gets you banned.
3. Handling distressed users and crisis escalation (§13.6).
4. Using the app: accept/decline, chart viewer, templates.
5. Honest prediction language: how to say "tendencies and timing windows" instead of absolute claims.

### 9.5 Home (main working screen)

| Element | Notes |
|---|---|
| **Status toggles** | Separate switches: Chat · Voice · Video, with auto-offline after 30 minutes of no interaction |
| Today's summary | Earnings today, sessions today, minutes, rating |
| **Incoming request card** | Full-screen with sound. Shows: user's first name, topic, language, mode, the user's question (if any), birth details (view), repeat user badge; **Accept** / **Decline**. 60-second timer. Decline requires a reason chip (Busy · Outside my expertise · Other) |
| Queue | Number of waiting users |
| Upcoming live | Next scheduled show with a "Go live" button 10 minutes before |
| Alerts | Policy warnings, low rating alerts, payout updates |

**Acceptance rate** is tracked; very low acceptance while "online" reduces ranking and triggers a nudge.

### 9.6 In-session tools

- **Chat/voice/video** with the same behaviour as the user app, plus:
  - **Chart viewer** (auto-generated kundli with Dasha and transits from the user's birth profile; zoomable).
  - **Quick replies** (customisable, up to 20) for greetings and clarifications.
  - **Private notes** per user (visible only to that astrologer, saved after the session; the user can request deletion).
  - **Session timer and earnings** (astrologer sees the user's running charge, to avoid the feeling of being cheated).
  - **Report user** (abuse, harassment, inappropriate requests) with an immediate "end session" option that still pays for time served.
- **Rules enforced in the tool:**
  - No sharing of contact info, payment links, or external app handles (blocked automatically).
  - **No selling in chat, ever.** No prices quoted by the astrologer, no payment links, no personal accounts. If the astrologer is enabled for the Store, the only allowed route is the **Recommendation tool** (§9.12): a card from the platform catalogue at the platform's fixed price, with a stated reason and a visible commission disclosure. Astrologers may still mention free traditional practices (for example, a mantra or a day-of-week practice) in neutral language.
  - A "Suggest escalation" button: astrologer can flag a distressed user to the platform's support team (§13.6).
- **End session** button with a confirmation; ending the session early for good reasons is allowed.

### 9.7 Earnings and payouts

**Earnings screen:**

| Element | Notes |
|---|---|
| Summary cards | Pending · Available · Paid this month |
| Per-session list | Date, user (first name), duration, **gross**, **commission**, **net** |
| Tax lines | GST (if applicable), **TDS deducted** with a running YTD total |
| Payout history | Date, amount, reference |
| Documents | Monthly statements, TDS certificates, invoices (PDF) |

**Request payout:**

| Field | Type | Notes |
|---|---|---|
| Amount | Number | Up to Available; minimum ₹500 (configurable) |
| Destination | Select | Verified bank/UPI on file |
| Confirm | OTP | Needed for any payout |

Rules: automatic weekly payout of Available earnings (default every Tuesday), plus a manual request once a day. Changing bank details needs re-verification and a 48-hour hold on payouts. **Payout dispute button** to raise a ticket on any session. Payouts above a threshold require finance approval (maker–checker, §11.6).

### 9.8 Performance and tiers

**Dashboard:** rating trend, acceptance rate, average session length, repeat-user rate, complaint rate, top topics, peak hours, "what to improve" tips (plain language).

**Tiers (example, configurable):**

| Tier | Entry criteria | Benefits |
|---|---|---|
| New | Approved | Entry rate band, exploration slot |
| Silver | 100+ sessions, 4.3+ rating, complaint rate low | Higher rate band, better commission |
| Gold | 500+ sessions, 4.5+ rating, repeat rate high | Highest band, featured in live |
| Master | By invitation | Custom terms |

Demotion is automatic when ratings or complaint rates cross thresholds.

### 9.9 Strikes and appeals (visible to the astrologer)

- A **strike log** shows the reason and evidence (transcript lines).
- 1st strike: warning; 2nd: 7-day suspension; 3rd within 90 days: permanent removal.
- **Immediate removal** for: asking for money outside the platform, sharing contact details, sexual content, abuse, using fake identity, repeated fear-based extortion.
- **Appeal:** the astrologer can appeal once with a text explanation; a different admin reviews within 5 working days.

### 9.10 Profile management

| Field | Editable by astrologer | Notes |
|---|---|---|
| Photo, bio, intro video | Yes, with re-review for material changes | |
| Languages, topics, systems | Yes, with review for new systems | |
| Rate per mode | Within band; **24-hour delay** | |
| Display name | No (admin only) | Prevents identity misuse |
| Bank, PAN | Re-verification required | |

### 9.11 Astrologer notifications

Incoming request (critical), user waiting, session ended summary, rating received, review posted, strike/warning, payout processed, KYC status, live reminders, and platform announcements.


### 9.12 Recommendation tool and sales earnings (Phase 2)

**Eligibility:** the `recommend_items` flag (§7.10), granted after a short Store training and a quiz (fair recommendations, no fear language, commission disclosure, return rules).

**In-session tool**

| Element | Type | Required | Rules |
|---|---|---|---|
| Recommend an item | Button | — | Visible only if enabled and the user has recommendations turned on |
| Item search | Search + category filter | Yes | Platform catalogue only; the astrologer cannot create items or change prices |
| Reason | Text, 30–200 chars | Yes | Must relate to the user's situation in neutral language; fear language and outcome guarantees are blocked by the checks in §13.3 |
| Disclosure | Auto-added | — | "This is optional. You don't need to buy anything to continue." and the commission line |
| Send | Button | — | Delivers the card (§8.21.8) |

**Limits (configurable):** one recommendation per session; no more than three per user per month from the same astrologer; **none in a user's first session** with that astrologer; none to users with an open crisis flag or in the 7 days after one (§13.6).

**Sales earnings**
- **Attribution window:** 7 days from the recommendation.
- The astrologer's share is a percentage of the **net item value after returns**, with a **per-item cap** (§13.8). It is **released only after the return window closes** and is clawed back on returns.
- **Earnings screen** gains a *Recommendations* tab: sent, opened, saved, bought, returned, earned.
- Comparison with peers: if the astrologer's return or complaint rate on recommended items is above average, show a plain warning and coaching tip.
- The astrologer **never sees** the buyer's address, payment details, or order contents beyond the item name and status.

**Paid reports queue** (`write_reports`)

| Element | Notes |
|---|---|
| Request card | Report type, birth profile(s), question, language, due time |
| Editor | Structured template with sections; character counts; chart insert |
| Submit | Goes to a quick admin quality check, then delivered to the user |
| Earnings | Fixed fee per report type and tier; paid after delivery and the refund window |
| Timers | Missed deadlines reduce ranking for reports and may remove the flag |

---

## 10. Live sessions specification

The live layer is the main trust-building and acquisition channel. It also carries the most moderation risk, so it is released in stages.

### 10.1 Stages

| Stage | Scope |
|---|---|
| **v1** | Scheduled **astrologer live shows**: video or audio, public chat, question queue, follow, "consult privately" button. **No gifts.** |
| **v1.1** | Gifts ("dakshina" or simple tokens) with strict caps, after 4–6 weeks of moderation data |
| **v2** | Instant "go live", replay clips, ticketed group sessions, paid priority questions |
| **v3** | Co-host / guest astrologer, user mic-requests |

### 10.2 Why scheduled first

Scheduled shows let operations vet content, pre-brief astrologers, and staff moderation. Unscheduled streaming brings spam and abuse early, before the safety systems are proven.

### 10.3 Scheduling a show (astrologer app)

| Field | Type | Required | Validation / notes |
|---|---|---|---|
| Title | Text | Yes | 10–80 chars; no outcome guarantees |
| Description | Text | No | Max 300 chars |
| Language | Select | Yes | |
| Topic tags | Multi-select | Yes | Up to 3 |
| Date and time | Picker | Yes | At least 2 hours ahead; no overlaps for the same astrologer |
| Expected duration | Select | Yes | 30 / 45 / 60 / 90 min |
| Format | Select | Yes | Video / Audio-only |
| Thumbnail | Image | No | Default is the astrologer's photo |
| Allow user questions | Toggle | Yes | Default on |

Admin can approve, reschedule, or reject a show (§11.5). Followers are notified at schedule time, 15 minutes before, and at start.

### 10.4 During the show

**Host controls:** start/end, mute/camera, question queue (select/skip/answer), pin a message, mute a user for the show, **block** a user, invite moderators (platform moderators join automatically), end show.

**Room rules:**
- Chat rate-limited; links, phone numbers, and promotional text blocked.
- **Platform moderator** present for every show (initially human; later assisted by automatic filters).
- **Admin kill switch** ends a stream instantly.
- **Recording:** shows are recorded for a limited period (default 30 days) for moderation and disputes. The audience is told this at the start of the show (§14.4).
- **Host conduct:** no outcome guarantees, no fear-based predictions about named individuals, no selling products in the show.

### 10.5 Gifts (v1.1)

Because gifts are the part with the most risk to vulnerable people and a likely **Play Billing implication** (§2.5), they are **built last and capped**.

| Rule | Default |
|---|---|
| Catalogue | 6–8 simple gifts (e.g., diya, flower, bell), priced ₹10 to ₹500 |
| Naming | Culturally fitting terms such as "dakshina" may be considered **[VERIFY culturally and legally]** |
| Per-user daily gift cap | ₹1,000 (lowerable by user, raise takes 24 h) |
| No public "top spender" leaderboards | Avoids pressure on whales |
| Astrologer share | % of gift value, set in admin; platform fee disclosed to the astrologer |
| Refunds | Gifts are non-refundable except for error |
| Source of funds | Gift credits bought via the compliant billing path **[VERIFY Play]** |

### 10.6 Question queue → conversion funnel

1. Viewer taps "Ask a question" and writes it.
2. Astrologer answers the best questions live.
3. After answering, the astrologer says "For personal details, join me privately"; the viewer sees the **Consult privately** CTA with the price.
4. Conversion is measured per show (§19).

### 10.7 Moderation of live (summary)

Details in §13.4. Minimum before public launch: a trained moderator on every show, keyword filters, a report button, ban/mute tools, and an admin kill switch.


### 10.8 Live hosts are a subset of astrologers

At launch, many astrologers will be 1:1-only. The product must work, and feel good, with a small number of hosts.

**Eligibility for `host_live`**
- Interest declared at application (Step 3b) or later via Profile → Grow.
- **Live audition:** a 15-minute on-camera mock show with a moderator. Scored on audio and video quality, presence, handling difficult comments, time-keeping, and content compliance (no guarantees, no fear claims, no selling).
- **Live conduct training** and quiz (moderation tools, what ends a show).
- Approval by an admin; the flag can be removed for repeated live violations without affecting 1:1 status.

**Live tab behaviour with few hosts (never an empty screen)**
- Sections: *Live now*, *Starting soon*, *Upcoming this week*, and **Meet our live hosts** (profiles with Follow and Remind me).
- If there are **no hosts at all** at launch, hide the Live tab with a feature flag and show a "Live sessions coming soon, follow to be notified" card on Home instead.
- **Target** (an assumption to validate): at least two shows a day in the evening peak (about 7–10 pm IST) before promoting the tab heavily.

**Make live traffic benefit everyone, not only hosts**
- After a show ends, the viewer sees **"More astrologers in [category]"**, including 1:1-only astrologers, with their prices and a consult button.
- During a show, the "Consult privately" button goes to the host; the end-of-show screen widens the choice.
- Hosts are **not ranked higher in the 1:1 list** just because they host; live is a discovery channel, not a ranking boost.

**Commercial rules:** hosts earn the same commission rate as in 1:1; any host incentives are decided later and documented.

---
## 11. Admin panel specification

**Form:** responsive web app, used on desktop. **Every action is logged** (who, what, before/after, time, IP). **Two-factor login is mandatory.** Sensitive actions need a **reason code**.

### 11.1 Global features

- Global search (user by phone/ID, astrologer by name/phone, session ID, ticket ID, payment ID).
- Saved filters, CSV export (permissioned and logged), column chooser.
- **PII masking by default** (e.g., phone shown as ******1234); "Reveal" requires permission, a reason, and is logged.
- Time zone fixed to IST in all reports.
- Bulk actions with confirm and dry-run preview.

### 11.2 Dashboard (home)

| Widget | Metric |
|---|---|
| Live ops | Active sessions now, astrologers online (by mode and language), average wait to connect, requests waiting, live shows in progress |
| Today | Recharges (₹, count), GMV (session charges), net revenue (commission), refunds (₹, %), new users, new paying users |
| Supply–demand | Online astrologers vs requests per language and per hour (to plan coverage) |
| Quality | Average rating, complaint rate per 1,000 sessions, open reports, SLA breaches |
| Alerts | Payment gateway failure rate, queue backlog, fraud flags, crisis flags |

### 11.3 Astrologer management

**Application pipeline (Kanban + list):** Draft · Submitted · In review · Needs changes · Test/interview · Approved · Active · Rejected · Suspended · Removed.

**Application detail page:**

| Section | Content / actions |
|---|---|
| Profile | All fields from §9.2; edit with change log |
| Documents | ID, PAN, certificates, photo, bank proof; per-document status (Pending / Verified / Rejected + reason) |
| Verification checks | Name match (ID vs PAN vs bank), penny-drop result, duplicate check (phone, PAN, bank, device, face), watchlist check |
| Scorecard | Reviewer scores for the 5 criteria (§9.3), notes, decision, reviewer name |
| Test & interview | Schedule, recording link, written test answers |
| Agreements | Versions signed with timestamps |
| Actions | Approve · Request changes (select fields + message) · Reject (reason + reapply date) · Assign reviewer |

**Active astrologer controls:**

| Field / action | Notes |
|---|---|
| Tier | New / Silver / Gold / Master (manual override with reason) |
| Rate band and approved rates | Per mode, change history |
| Commission % | Default by tier; per-astrologer override needs a second approver |
| Visibility | Listed / hidden / "paused" (e.g., on leave) |
| Languages, topics, badges | Add/remove; badge definitions are controlled |
| Performance panel | Rating trend, acceptance rate, complaint rate, refund rate, average session length, strikes |
| Strikes | Add strike (reason code + evidence links), warn, suspend (duration), remove permanently |
| Payout hold | Place/clear hold with a reason |
| Notes | Internal notes, visible to the admin team only |

### 11.4 User management

**List filters:** registered date, language, city/state, wallet status, lifetime spend band, flags, last active.

**User detail (360 view):**

| Section | Content |
|---|---|
| Identity | Masked phone, name, registered date, device info, consent versions |
| Wallet | Balance, ledger (every entry), recharge history |
| Sessions | List with duration, astrologer, charge, rating; open transcript (permissioned, reason logged) |
| Spend controls | User's limits and any admin override |
| Tickets and refunds | History |
| Flags | Possible fraud, repeated refund claims, abusive behaviour, **crisis flag** |
| Actions | Block/unblock, adjust wallet (needs approver), force logout, resend OTP, anonymise account (DPDP erasure) |

### 11.5 Live operations

| Module | Function |
|---|---|
| **Schedule board** | All upcoming shows; approve, reject, reschedule; conflict warnings |
| **Live monitor** | Grid of live rooms; open any room as a hidden moderator; viewer count; report count; **Kill stream** button (reason required) |
| **Chat moderation** | See flagged messages, mute/ban a user in a room or platform-wide |
| **Gift catalogue (v1.1)** | Create/edit gifts, prices, artwork, astrologer share, caps, enable/disable |
| **Show analytics** | Viewers, watch time, questions answered, conversion to 1:1 |
| **Recordings** | Search by show/time, retention timer, legal hold |

### 11.6 Finance

| Module | Function |
|---|---|
| **Payments** | All gateway transactions; status; reconciliation (gateway vs ledger) with mismatch queue |
| **Wallet ledger** | Double-entry view by account; trial balance; drill-down to the source (payment, session, refund) |
| **Refunds** | Queue with auto-refund log, manual approvals (limit by role), refund to wallet vs source |
| **Payouts** | Weekly batch generator, preview (gross, commission, GST, TDS, net), **maker–checker approval**, bank file/API submission, failure handling, retry |
| **Commission rules** | By tier, by astrologer, by period; effective-dated |
| **Tax** | GST invoices, GST reports (GSTR-ready exports), TDS deduction register, Form 16A / certificates, PAN-missing list **[VERIFY details with CA]** |
| **Chargebacks** | Cases, evidence packs (session logs) |
| **Reports** | Daily revenue, take-rate, refund rate, astrologer-wise earnings, liability (unused wallet balances), tax liability |

**Controls:** payouts above a threshold need two approvers; wallet adjustments need reason + second approver; every finance export is logged.

### 11.7 Configuration and pricing

| Setting | Notes |
|---|---|
| Recharge amounts and limits | Chips, min/max per transaction |
| Spend control defaults | Daily and monthly caps, raise delay |
| Minimum balance multiplier | Default 5 minutes |
| Check-in interval | Default 15 min |
| Intro offer | Eligibility, price, duration, terms text |
| Coupons | Type, value, cap, expiry, eligibility, usage limit; **terms are mandatory text** |
| Rate bands per tier | Min/max per mode |
| Commission defaults | By tier |
| Hold period | Default 7 days |
| Ranking weights | Sliders per signal; versioned |
| Feature flags | Per feature, per cohort, per region |
| Blocked-pattern lists | Phone/UPI/link regex, abusive words, **fear-language** terms (§13.3) |
| Timers | Accept timeout, grace, reconnect window |

Changes are versioned, effective-dated, and need a second approver for money-related settings.

### 11.8 Support (CRM)

- Ticket inbox with categories, priority, SLA timers (acknowledge in 4 h, resolve in 48 h), assignment, merge.
- **Macros** (canned replies) in Hindi and English.
- Link a ticket to a session, payment, and user in one click.
- **L1** can answer and refund within a small limit; **L2** handles disputes and larger refunds; T&S takes conduct cases.
- Customer satisfaction rating after resolution.
- Escalation rules (crisis, fraud, legal notice) route to specific owners.

### 11.9 Trust & Safety console

| Module | Function |
|---|---|
| **Report queue** | All user and astrologer reports, auto-flagged transcripts, live reports; severity, owner, status |
| **Case view** | Transcript excerpt with highlights, user history, astrologer history, prior strikes, recommended action |
| **Actions** | Dismiss · Warn · Strike · Suspend · Remove · Refund user · Ban user |
| **Auto-flag rules** | Contact sharing, payment links, fear-language, abusive terms, sexual content, rapid refund patterns |
| **Crisis flags** | Separate queue (priority) with a playbook (§13.6) |
| **Appeals** | Astrologer and user appeals, second-reviewer rule |
| **Quality sampling** | Random sample of sessions per astrologer per week for QA scoring (rubric in §13.7) |

### 11.10 Content and communications (CMS)

- Categories and topics, FAQs, help articles (Hindi/English).
- **Legal documents** with versions (Terms, Privacy Notice, Refund Policy, Astrologer Agreement, Code of Conduct); publishing a new version triggers re-consent where needed.
- Daily horoscope editor with scheduled publishing.
- Banners and home layout order (no countdown widgets).
- Notification templates (push, SMS, WhatsApp) with language variants; **SMS templates registered with the DLT platform [VERIFY]**.
- Fairness page and policies (the "trust contract" content).

### 11.11 Growth and marketing

- Campaigns and deep links with attribution (install → signup → first session → first recharge).
- Referral programme: reward rules, fraud limits, ledger-based rewards (clearly labelled as credits with terms).
- Audience segments (e.g., "recharged but never consulted") for consented messaging.
- Astrologer content kit: shareable live-show cards and clips with the astrologer's consent.
- Cohort and retention dashboards (§19).

### 11.12 Roles and permissions (RBAC)

`R` read, `W` write, `A` approve, `X` export, `—` none.

| Module | Super admin | Onboarding reviewer | Support L1 | Support L2 | Finance | T&S | Content | Growth | Analyst | DPO |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | R | R | R | R | R | R | R | R | R | R |
| Astrologer applications | RWA | RWA | R | R | R | R | — | — | R | R |
| Active astrologers | RWA | R | R | R | R | RWA | — | R | R | R |
| Users (masked) | RW | — | R | RW | R | RW | — | R | R | R |
| PII reveal / transcripts | A | — | — | with reason | — | with reason | — | — | — | with reason |
| Wallet adjustment | A (second approver) | — | — | W (limit) | RWA | — | — | — | — | — |
| Refunds | RWA | — | W (limit) | RWA | RWA | W | — | — | R | — |
| Payouts | A | — | — | — | RWA (maker) + A (checker) | — | — | — | R | — |
| Config / pricing | RWA | — | — | — | RW (finance fields) | — | — | RW (coupons) | R | — |
| Live ops | RWA | — | — | R | — | RWA | W (schedule) | R | R | — |
| T&S console | RWA | — | R | R | — | RWA | — | — | R | R |
| CMS | RWA | — | — | — | — | — | RWA | W | R | R (legal docs) |
| Compliance console | RWA | — | — | — | R | R | — | — | — | RWA |
| Audit log | R | — | — | — | — | — | — | — | — | R |

Principle: least privilege; **maker–checker** on money and commission changes; no single person can both create and approve a payout.

### 11.13 Compliance console

- **Consent register:** user, document version, timestamp, channel.
- **Data requests (DPDP rights):** access, correction, erasure, grievance; due-date timers; status; fulfilment log.
- **Breach register** with the 72-hour clock **[VERIFY exact obligation]**.
- **Grievance officer inbox** and response SLA tracker.
- **Retention jobs:** transcripts, recordings, documents purge schedules and legal holds.
- **Audit log** explorer.


### 11.14 Categories, collections, capabilities and preference questions

| Module | Function |
|---|---|
| **Category manager** | Create, edit, order and deactivate categories (English and Hindi names, description, icon, slug, category disclaimer, content-guardrail text) |
| **Method tags** | Maintain the list; define verification requirements per tag |
| **Collections** | Manual lists, or rule-based ones (for example rating ≥ 4.5 and language = Hindi and online in the last 7 days); preview before publishing |
| **Astrologer assignment** | Approve or reject category requests; bulk assign; change history |
| **Capability flags** | Toggle `consult_*`, `host_live`, `recommend_items`, `write_reports` per astrologer with a reason; link to the audition scorecard, quiz result, or sample report that justified it |
| **Live audition board** | Schedule auditions, assign moderators, record scores and decisions |
| **Preference question manager** | Question text per language, options, order, active/inactive, **mapping** of each option to category/language/mode/budget/gender with weights, A/B variants, preview |
| **Match-score settings** | Weights, quality-gate thresholds, exploration slot count; versioned and effective-dated; a **simulator** ("what would a user with these answers see?") |
| **Discovery analytics** | Question impressions, completion and skip rates, effect of "Your picks" on consult and recharge conversion, category-page performance |

Money-affecting or ranking-affecting changes need a second approver.

### 11.15 Store administration (Phase 2)

| Module | Function |
|---|---|
| **Catalogue** | Products and variants: title, description, images, category, MRP, selling price, HSN code, GST rate, stock, weight and dimensions, material and origin, **certification documents**, supplier, legal-flag (restricted materials), claims-review status |
| **Claims review** | Checklist and banned-phrase scan for outcome claims; two-person approval for high-value items; version history |
| **Inventory** | Stock levels, reservations, low-stock alerts, supplier orders |
| **Orders** | Search, state machine, manual actions, cancellation, fraud hold, COD confirmation |
| **Fulfilment** | Packing, courier assignment through an aggregator, labels, tracking sync, failed-delivery and return-to-origin handling |
| **Returns and QC** | Receive, inspect, approve or reject, trigger refund, restock or scrap; gemstone re-checks |
| **Pricing and coupons** | Genuine-MRP rule, coupon caps, expiry, usage limits; no fake-discount tools |
| **Reports and services** | Request queue, assignment to writers, SLA timers, quality check, delivery |
| **Recommendation analytics** | Per astrologer: sent, opened, saved, bought, returned, share of the astrologer's revenue; **outlier alerts** (§13.8) |
| **Commissions on sales** | Share and per-item cap by tier; accrual, hold until the return window ends, clawback |
| **Sellers** (only if a marketplace is added later) | Onboarding, KYC, GST, agreements, settlements, tax collection and deduction |
| **Store reviews** | Same un-curated rule as consultations: remove only abuse or personal data |
| **Support** | Order-issue macros, refund limits by role |

**New roles:** *Catalogue manager* (catalogue and claims review), *Fulfilment/logistics* (orders, shipping, returns), *QC* (returns inspection). Finance gets store payments and commission payouts; T&S gets recommendation analytics and outlier cases; Support L1/L2 handle order tickets within refund limits. The maker–checker rule applies to commission payouts and bulk price changes.

---

## 12. Payments, tax and finance flows

### 12.1 Payment stack (to be chosen **[VERIFY]**)

- **Collection:** a payment gateway supporting UPI (intent and collect), cards, netbanking, wallets. **Confirm that your chosen gateway accepts the astrology category in its onboarding policy before you design around it [VERIFY]**.
- **Payouts:** a payouts product for bank transfer / UPI to astrologers, with name verification.
- **Webhooks** are the source of truth for payment status; the app polling is only a UI helper.
- **Play billing:** decide per product — wallet recharge for human services vs. virtual gifts — with legal advice on Play's digital-goods rule and India's alternative billing programme **[VERIFY]** (see §2.5). If Play Billing is required, **plan for its fee in the take-rate**.

### 12.2 Recharge flow

1. User chooses an amount → backend creates an order with an idempotency key.
2. User pays in the gateway sheet.
3. Webhook confirms → ledger entry: Dr `gateway_clearing`, Cr `user_wallet_liability`.
4. Push + receipt; if the app is closed, the wallet still updates.
5. Nightly reconciliation compares gateway settlement vs ledger.

### 12.3 Session settlement flow

At session end:

1. Server computes charge = billed seconds × (rate / 60).
2. Ledger: Dr `user_wallet_liability`, Cr `astrologer_earnings_pending` (net of commission) and Cr `platform_revenue` (commission).
3. Tax lines are computed per the chosen structure (GST on commission, or on the full amount) **[VERIFY]**.
4. After the hold period, earnings move to `available`.

### 12.4 Payout flow

1. Weekly batch picks `available` balances above the minimum.
2. Compute TDS and any other deductions **[VERIFY rate and section]** and mark PAN-missing astrologers for the higher rate where applicable.
3. Finance maker reviews and creates the batch; checker approves.
4. Payout API call with name check; handle success, pending, failed.
5. Statement and TDS record generated for the astrologer.

### 12.5 Invoices and statements

- **To the user:** a tax invoice per recharge or per session depending on the structure **[VERIFY with CA]**, downloadable in the app.
- **To the astrologer:** monthly statement, commission invoice if required, TDS certificates.

### 12.6 Refund flow

Refunds to the **wallet** are the default and instant. **Refund to the original payment source** applies for unused balance on request, or for payment errors. Every refund creates a ledger entry and a user notification.

### 12.7 Reconciliation and controls

- Daily three-way match: gateway, ledger, bank.
- Unmatched items are queued with an owner and a deadline.
- Liability report: total unused wallet balances (important for accounting and any regulatory view).


### 12.8 Store payments, tax and settlement (Phase 2)

All tax points are **[VERIFY with a CA]**.

- **Seller model.** If the platform is the **seller of record** (recommended start), it invoices the customer, charges GST on goods at the correct HSN rate, and handles returns. If sellers are added later, the platform becomes an **e-commerce operator** with its own tax collection and deduction duties (the research found references to GST TCS and TDS under section 194-O for such platforms).
- **Payments.** Prepaid through the same gateway. Google Play's billing rule is aimed at digital items; physical goods are generally outside it, but whether **paid digital reports** count as digital content is a question to confirm.
- **Cash on delivery (COD).** Optional and later. It brings fees, return-to-origin losses and cash reconciliation. If enabled, use order limits and show any COD fee before the user selects it.
- **Ledger.** Store receivables and refunds are separate ledger accounts from wallet credits (§7.1). Wallet credits can pay for reports, and physical goods should be paid from the gateway unless your wallet structure is approved for it **[VERIFY]**.
- **Astrologer commission on sales.** Accrues at purchase, is released **only after the return window closes**, and is clawed back on returns. It appears on the statement as a separate line (§9.12). Tax treatment of the commission **[VERIFY]**.
- **Invoices.** A GST tax invoice per order with HSN, plus e-invoicing if thresholds apply **[VERIFY]**.
- **Shipping.** Courier aggregator with pincode serviceability, a rate card, and insurance for high-value items.

---

## 13. Trust & safety specification

### 13.1 Scope

Protect users from manipulation and harm, protect astrologers from abuse and unfair penalties, and protect the platform from fraud and regulatory action.

### 13.2 Astrologer code of conduct (key rules)

**Never allowed (immediate removal):**
- Asking for money, gifts, or payments outside the platform, or sharing personal contact details or payment links.
- Sexual, romantic, or harassing conduct toward users.
- Using a false identity or credentials.
- Threatening users with harm ("your family will suffer unless you buy X").

**Not allowed (strike):**
- Guaranteeing outcomes ("100% marriage in 30 days").
- Fear-based predictions about death, illness, or tragedy for named people.
- Giving medical, legal, or financial advice, or telling users to stop treatment or ignore professionals.
- Selling or recommending anything **outside the Store and Recommendation tool**, quoting your own prices, or using payment links (see §13.8).
- Deliberately prolonging a session to increase charges.
- Sharing user information with anyone.

**Expected:**
- Clear, respectful, honest language; say "likely" and "tends to", not "will definitely".
- Ask the user's comfort level before discussing difficult topics.
- Encourage professional help when a user mentions illness or distress.

### 13.3 Automatic content controls

| Control | Method | Action |
|---|---|---|
| Phone numbers, UPI IDs, bank details, emails, external links, social handles | Regex plus fuzzy matching for spelled-out digits and obfuscation | Block delivery, log, count toward strikes |
| Payment-request phrases ("send money to", "pay on this link") | Keyword + model | Block, flag to T&S |
| Fear-language and guarantees | Keyword + model scoring | Flag for review; weekly QA sampling |
| Abusive/sexual content | Keyword + model | Block or flag by severity |
| Spam in live chat | Rate limit, duplicate detection | Throttle or mute |

Rules are editable in admin (§11.7). Start with **flag-and-review**, not auto-ban, to limit false positives; auto-block only for contact/payment patterns.

### 13.4 Live moderation

- Moderator assigned to each show; ability to hide messages, mute/ban users, warn or end the show.
- Reports from viewers route to the live queue with a short response target (minutes).
- After each show, a short moderation report (reports received, actions taken).
- Repeat offenders in chat get platform-wide bans.

### 13.5 Fraud and abuse controls

| Risk | Control |
|---|---|
| Fake accounts / OTP abuse | Rate limits, device fingerprint, blocked-number lists |
| Refund abuse | Pattern detection (repeated short sessions plus refund claims), limits on auto-refund frequency |
| Astrologer–user collusion (fake sessions to boost earnings or ratings) | Graph checks (same device/IP/contact patterns), unusual repeat pairs, review weighting |
| Payment fraud, stolen cards, chargebacks | Gateway risk tools, velocity limits on new accounts |
| Off-platform payment scam | §13.3 blocks, user education banner in chat ("We never ask you to pay outside the app") |
| Fake reviews | Only verified paid sessions can review; bursts are flagged |

### 13.6 Crisis and vulnerable-user handling

Users sometimes disclose despair, self-harm thoughts, abuse, or medical emergencies in an astrology chat. We treat this as a first-class safety requirement.

**Detection:** keyword/model signals in chat (self-harm, hopelessness, "end it all") for text; astrologer "Suggest escalation" button for voice/video.

**In-app response (user):** an unobtrusive support card: "It sounds like things are very hard. You are not alone — you can talk to a trained counsellor right now." with **Tele-MANAS 14416** (India's government mental-health helpline) and an emergency number for immediate danger **[VERIFY numbers before launch, and have a clinician review the wording]**.

**Astrologer prompt:** a one-screen guide, "Pause predictions. Listen. Do not give timelines for death or failure. Encourage reaching out to a trusted person or the helpline."

**Platform response:** a crisis flag opens a priority case; a trained T&S member reviews within minutes during staffed hours; spend controls tighten for that user (recharge limits, cool-off nudge). We do not end or penalise a conversation merely because it touches on distress.

**Hard rules:** no marketing messages or recharge nudges to a user with an open crisis flag for 7 days; astrologers are barred from using distress to push paid actions.

### 13.7 Quality assurance rubric (weekly sampling)

Score 1–5 on: accuracy/consistency with the chart, clarity, empathy, honesty (no guarantees), compliance (no products, no off-app), and appropriate handling of distress. Low QA scores trigger coaching; repeated low scores trigger a tier review.


### 13.8 Sales-pressure safeguards

Selling is where the category's trust problem comes from, so these rules are as important as the Store itself.

1. **No selling in chat, ever.** No prices quoted by the astrologer, no payment links, no personal accounts. The only route is the Recommendation tool (§9.12).
2. **Limits:** one recommendation per session; at most three per user per month per astrologer; none in a user's first session with that astrologer.
3. **Moderated reason text:** fear language and outcome guarantees are blocked or flagged (§13.3).
4. **Disclosure on every card:** the astrologer earns a commission.
5. **High-value cooling-off:** above the threshold (default ₹5,000), the item cannot be bought until the session ends, and an extra confirmation screen is shown (§8.21.6).
6. **Capped incentive:** the astrologer's share is a fixed percentage with a **per-item cap**, so there is no reward for pushing the biggest stone.
7. **Ranking is independent of sales:** neither Store sales nor recommendation revenue may feed the astrologer ranking (§7.6, §7.11).
8. **Outlier detection:** compare each astrologer's recommendation-to-purchase conversion, average order value, return rate and complaint rate with peers; auto-flag the top 5% for transcript review.
9. **User control:** "Not for me", and a setting to turn recommendations off entirely.
10. **Vulnerability:** no recommendations to users with an open crisis flag (or within 7 days of one), or to users whose recent spend crosses a high threshold, or in sessions flagged for distress.
11. **Evidence:** every recommendation is logged with the reason text and nearby chat context for audits.
12. **Consequences:** pressure selling is a strike; off-platform selling or payment links is immediate removal (§9.9).

---

## 14. Compliance specification

### 14.1 Launch checklist (owner → item)

| Owner | Item |
|---|---|
| Lawyer | Entity and structure; Terms, Privacy Notice, Refund Policy, Astrologer Agreement; **wallet structure opinion**; Play billing opinion; advertising claims review |
| CA | GST registration and treatment; TDS section and rate; invoice format; accounting for wallet liability |
| DPO / compliance | Consent flows and register; data retention schedule; breach response plan; **grievance officer and DPO contact published in-app** |
| Ops | SMS DLT registration; payment gateway category acceptance; app store listing and policies; support SLAs |
| Product | Dark-patterns audit of every screen (§14.2); spend controls; crisis flow tested |
| Security | Pen-test; encryption of PII; access reviews |

### 14.2 Dark-patterns audit (CCPA 2023 guidelines)

The guidelines list 13 practices. Use this table as a **design review gate** for every release.

| Dark pattern | Where it could appear here | Our rule |
|---|---|---|
| False urgency | Countdown offers, "only X astrologers left" | Not used |
| Basket sneaking | Auto-adding tips, extra credits, add-ons | Nothing pre-added; tips never preselected |
| Confirm-shaming | "No, I don't want to be guided" on decline buttons | Neutral decline wording |
| Forced action | Requiring marketing consent or extra data to proceed | Marketing is separate and optional; only necessary data requested |
| Subscription trap | Hard-to-cancel plans | **No subscriptions in v1**; any future plan must cancel in one tap |
| Interface interference | Hiding the End button, greying out Decline | End and Decline always visible and equal in weight |
| Bait and switch | Intro price that changes mid-session | Intro terms fixed and shown before start |
| Drip pricing | Tax or fees added at the last step | All-inclusive price from the first screen |
| Disguised advertisement | Sponsored astrologers that look organic | "Sponsored" label if ever introduced |
| Nagging | Repeated recharge prompts | Recharge prompt only at low balance; frequency capped |
| Trick question | Double-negative consent | Plain consent text, unticked by default |
| SaaS billing | Hidden recurring charges | No recurring charges |
| Rogue malware | Not applicable | Not applicable |

### 14.3 Consent and data-subject rights (DPDP)

- Notice before collection, in Hindi and English, in plain language; separate consents for (a) service use, (b) marketing, (c) session recording (§14.4).
- **Consent log:** user ID, document version, purpose, timestamp, channel, withdrawal timestamp.
- **Rights in the app:** access/download, correction, erasure (with a retention exception list), withdraw consent, grievance contact.
- **Children:** the app is **18+ only** in v1, with an age declaration and, where feasible, a lightweight age-check signal. Reassess before adding any child-facing features, because the Rules require verifiable parental consent for under-18s and bar targeted advertising to them.
- **Breach response:** documented plan, with notification timelines per the Rules (sources say 72 hours for reporting) **[VERIFY]**.
- **Cross-border:** host in India (Mumbai/Hyderabad regions) and review any foreign vendors (RTC, analytics) for data flows **[VERIFY]**.
- Appoint a DPO or designated contact and display it in the app (the Rules require prominent display of contact details).

### 14.4 Recording and retention

| Data | Default retention | Access |
|---|---|---|
| Chat transcripts | 12 months **[VERIFY]**, then anonymise | T&S/Support L2 with reason + audit; user can request export or deletion subject to legal holds |
| Voice/video recordings | Off by default for 1:1 audio/video; **sampled recording only with explicit consent shown in the session start screen** (v2 decision) | Restricted; auditor access only |
| Live show recordings | 30 days, extendable by legal hold | T&S, Admin |
| KYC documents | As long as the astrologer is active + legally required period **[VERIFY]** | Onboarding reviewers, finance |
| Ledger and invoices | As required by tax law **[VERIFY]** | Finance |
| Logs | 90 days operational; longer for security events | Engineering/Security |

Recording rule: **tell people before recording, in the language they use.**

### 14.5 Advertising and claims policy

- No ad or in-app copy may promise outcomes ("guaranteed love in 3 days"), cure conditions, or claim 100% accuracy.
- Testimonials must be real and attributable, and shown with "individual experiences vary".
- Influencer or astrologer marketing must follow disclosure rules **[VERIFY current ASCI guidance]**.
- Review all creative through a simple checklist before release.


### 14.6 Store compliance checklist (Phase 2)

Everything below is **[VERIFY]** with a lawyer and CA; none of it was confirmed in this research.

| Area | What to check |
|---|---|
| E-commerce consumer rules | Seller details, grievance officer, display of return and refund terms, no unfair trade practices, and whether the 2027 amendments mentioned in §2.5 apply |
| Dark patterns | The same 13-point audit as §14.2 applies, especially fake MRP, urgency, and hidden costs at checkout |
| Legal metrology | Required declarations on packaged goods, MRP, country of origin |
| GST | Goods HSN and rates, invoicing, collection and deduction rules if sellers are added |
| Advertising and claims | Misleading-advertisement law and the magic-remedies law for product copy |
| Materials | Items made from protected species are restricted; hallmarking for precious-metal items; disclosure rules for gemstone treatments. Have a gemmologist and a lawyer review the launch catalogue |
| Consumables and medicinal claims | **Not sold** in this plan; keep it that way unless reviewed |
| Privacy | Shipping addresses are personal data: retention, courier sharing only as needed, deletion on request |
| Play policy | Physical goods vs paid digital reports, as noted in §12.8 |

---
## 15. Data model (core entities)

Fields shown are the essentials; add audit columns (`created_at`, `updated_at`, `created_by`) everywhere.

| Entity | Key fields |
|---|---|
| `users` | id, phone (encrypted), name, language, status, created_at, age_declared_at, device_ids |
| `birth_profiles` | id, user_id, label, name, gender, dob, tob, tob_accuracy, place_text, lat, lng, tz_id, marital_status?, occupation? |
| `astrologers` | id, user_account_id, display_name, legal_name, status, tier, bio, systems[], topics[], languages[], experience_years, rating_avg, rating_count, listed |
| `astrologer_kyc` | astrologer_id, pan (encrypted), id_type, id_ref (tokenised), bank_ref (tokenised), penny_drop_status, doc_urls, reviewer_id, decision, scorecard (json) |
| `astrologer_rates` | astrologer_id, mode, rate_per_min, effective_from, approved_by |
| `commission_rules` | scope (default/tier/astrologer), percent, effective_from, effective_to, approved_by |
| `sessions` | id, user_id, astrologer_id, mode, status, requested_at, accepted_at, started_at, ended_at, end_reason, billed_seconds, rate_snapshot, commission_snapshot, topic, birth_profile_id |
| `session_messages` | id, session_id, sender, type, body, flagged, blocked_reason, created_at |
| `wallets` | user_id, balance (derived/cached), limits (daily, monthly) |
| `ledger_accounts` | id, type (asset/liability/revenue/expense), owner_type, owner_id |
| `ledger_entries` | id, txn_id, debit_account, credit_account, amount, currency, ref_type, ref_id, idempotency_key, created_at |
| `payments` | id, user_id, gateway, gateway_order_id, amount, status, method, webhook_payload_ref |
| `payouts` | id, astrologer_id, batch_id, gross, commission, tds, other, net, status, bank_ref, approvals[] |
| `refunds` | id, session_id/payment_id, amount, reason_code, decision, decided_by, target (wallet/source) |
| `reviews` | id, session_id, user_id, astrologer_id, stars, tags[], text, reply, status, removal_reason |
| `follows` | user_id, astrologer_id, created_at |
| `live_shows` | id, astrologer_id, title, description, language, tags[], scheduled_at, duration, format, status, approved_by |
| `live_events` | show_id, type (join/leave/chat/question/report), user_id, payload, created_at |
| `gifts` (v1.1) | id, name, price, astrologer_share_percent, active |
| `gift_transactions` (v1.1) | id, show_id, user_id, gift_id, amount, ledger_txn_id |
| `reports` | id, reporter_id, target_type, target_id, reason, text, severity, status, owner |
| `strikes` | id, astrologer_id, reason_code, evidence_refs, action, issued_by, expires_at |
| `tickets` | id, user_or_astrologer_id, category, session_id?, status, sla_due_at, assignee |
| `consents` | id, user_id, doc_type, doc_version, purpose, granted_at, withdrawn_at, channel |
| `audit_logs` | id, actor_id, action, entity, before, after, reason, ip, created_at |
| `config_items` | key, value, version, effective_from, approved_by |
| `notifications` | id, user_id, channel, template, payload, status |
| `crisis_flags` | id, user_id, session_id, signal, reviewer_id, outcome, created_at |
| `categories` | id, parent_id, name_en, name_hi, description, icon, slug, disclaimer, order, active |
| `astrologer_categories` | astrologer_id, category_id, is_primary, approved_by |
| `method_tags` / `astrologer_methods` | tag, astrologer_id, verified |
| `collections` | id, name, type (manual/rule), rule_json, active |
| `astrologer_capabilities` | astrologer_id, flag (consult_chat/voice/video, host_live, recommend_items, write_reports), granted_by, evidence_ref, granted_at |
| `preference_questions` | id, text_en, text_hi, type, options_json, mapping_json, order, active, variant |
| `user_preferences` | user_id, topics[], languages[], modes[], budget_band, gender_pref, first_time, answered_at, skipped_at, source, consent_version |
| `products` / `product_variants` | id, category, title, description, images[], mrp, price, hsn, gst_rate, stock, weight, material, origin, certificate_refs[], legal_flag, claims_review_status, supplier_id |
| `addresses` | id, user_id, name, phone, pincode, line1, line2, city, state, type |
| `carts` / `cart_items` | id, user_id, items[], coupon, totals |
| `orders` / `order_items` | id, user_id, status, address_ref, totals, payment_id, recommended_by (nullable), created_at |
| `shipments` | id, order_id, courier, awb, status, events[] |
| `returns` | id, order_id, reason, photos[], decision, refund_id |
| `recommendations` | id, session_id, astrologer_id, user_id, product_id, reason, status (sent/opened/saved/dismissed/bought), attribution_expires_at |
| `report_orders` | id, user_id, report_type, birth_profile_ids[], question, language, writer_id, due_at, status |
| `sales_commissions` | id, astrologer_id, order_item_id, amount, cap_applied, status (accrued/released/clawed_back) |

**Rules:** PII (phone, PAN, bank, birth details, transcripts) is encrypted at rest with field-level keys; documents live in encrypted object storage with signed, short-lived URLs.

---

## 16. Integrations and API surface (outline)

| Domain | Examples |
|---|---|
| Auth | request-otp, verify-otp, refresh-token, logout, device-register |
| Profile | birth-profiles CRUD, preferences, consents, delete-account |
| Discovery | astrologers (list, filters), astrologer detail, reviews, follow, search |
| Sessions | request-session, accept/decline, join, end, heartbeat, check-in-continue, report |
| Chat | WebSocket channel per session (send, receive, typing, read) |
| Wallet | balance, create-recharge-order, payment-webhook, ledger list, spend-limits |
| Reviews | submit, reply, report |
| Live | list shows, show detail, join token, chat, question, report; host: schedule, start, end, queue |
| Tools | kundli, matching, panchang, horoscope |
| Preferences and categories | preference questions, save answers (device and account), category tree, category page, astrologers by category, "Your picks" |
| Store (Phase 2) | catalogue, product, pincode check, cart, checkout, orders, returns, report orders; astrologer: recommend item, recommendation stats |
| Astrologer | apply, upload documents, status, availability toggle, earnings, payouts, strikes, appeal |
| Admin | RBAC-protected endpoints for all console modules |
| Webhooks | payment status, payout status, RTC events (join/leave), KYC vendor results |

**Third-party integrations to select:** payment gateway, payouts, RTC (**Cloudflare**, §17.5), SMS/OTP (DLT), push (FCM), WhatsApp Business (optional), KYC/penny-drop vendor, e-sign, ephemeris or astrology API, analytics, crash reporting, support desk tool, map/place search, courier/logistics aggregator, pincode and address lookup, GST e-invoicing tooling if needed **[VERIFY]**.

---

## 17. Architecture and technology recommendations

### 17.1 Stack (recommendation, not mandate)

| Layer | Recommendation | Why |
|---|---|---|
| Mobile (user + astrologer) | One cross-platform codebase (Flutter or React Native) with two app flavours | Small team, Android first, iOS later |
| Admin web | React (Next.js) with a component library | Fast to build tables and forms |
| Backend | A **modular monolith** (NestJS, Django, or Go) | Simple to run at launch; split services later |
| Database | PostgreSQL (ledger-safe transactions) | Strong consistency for money |
| Cache/queue | Redis plus a job queue | Presence, rate limits, background jobs |
| Realtime | WebSocket gateway for chat/presence, or a managed chat SDK | Low-latency messaging |
| RTC (voice, video, live) | **Cloudflare**: RealtimeKit for calls and live, Realtime SFU/TURN for low-level control, Stream if large HLS audiences are needed; behind an internal adapter interface (§17.3, §17.5) | Your chosen provider; the adapter keeps a swap possible |
| Storage | S3-compatible, encrypted, India region | KYC documents, media |
| Hosting | India region (Mumbai/Hyderabad) | Latency and data-protection posture |
| Observability | Logs, metrics, tracing, alerting; crash reporting | Needed for billing trust |
| Kundli engine | Swiss Ephemeris-based service (**check its licence for commercial use [VERIFY]**) or a third-party astrology API | Accurate planetary maths; avoid writing your own |

### 17.2 Why a billing "metering" service is separate in the code

Treat billing as its own module with tests, because errors here destroy trust and revenue.

- **Session meter:** a server-side timer driven by RTC join/leave events and heartbeats, producing billed-seconds records.
- **Wallet hold:** at session start, reserve the minimum balance; release or consume at settlement.
- **Idempotent settlement:** replaying an event cannot double-charge.
- **Daily invariants:** ledger totals equal wallet totals plus pending earnings plus revenue.

### 17.3 RTC adapter

Define one interface (`createRoom`, `issueToken`, `endRoom`, `getUsage`, `onJoinLeave`) so Cloudflare, Agora, ZEGOCLOUD, LiveKit, or others can be swapped without touching business logic. Log vendor usage per session to cross-check the vendor invoice against your own billed minutes.

### 17.4 Environments and delivery

Dev, staging, production; CI/CD with automated tests on billing and ledger; feature flags; staged rollouts; remote config for kill switches (e.g., disable live, disable recharges).


### 17.5 Cloudflare for calls, video and live (decision: Cloudflare)

**What Cloudflare offers** (from Cloudflare's docs and rates pages as retrieved on 11 Nov 2026; confirm everything with Cloudflare **[VERIFY]**):

| Product | What it is | Listed price |
|---|---|---|
| **RealtimeKit** | SDKs and APIs with prebuilt UI for live video and voice | Audio/video participant $0.002 per minute; audio-only participant $0.0005 per minute; export (recording, RTMP or HLS) $0.010 per minute (audio-only export $0.003); raw RTP export to R2 $0.0005 per minute |
| **Realtime SFU** | Low-level media server routing WebRTC audio, video and data channels | $0.05 per GB egress; first 1,000 GB per month free (shared with TURN) |
| **TURN** | Relay for restrictive networks | Free with SFU, otherwise $0.05 per GB |
| **Stream** | Video storage and live streaming (HLS) | $5 per 1,000 minutes stored; $1 per 1,000 minutes delivered |

**Recommended mapping to features**

| Feature | Use | Notes |
|---|---|---|
| 1:1 voice | RealtimeKit, audio-only participants | Cheapest path; the main product |
| 1:1 video | RealtimeKit audio/video | Cap resolution and bitrate; automatic fallback to audio-only |
| Live show, interactive | RealtimeKit with host and co-host publishing, viewers subscribing, and **promote-to-speaker** for Q&A | Confirm maximum viewers per session and role features **[VERIFY]** |
| Live show, large audience | HLS delivery (RealtimeKit export or Stream) | A few seconds of delay; chat runs separately |
| Recording | RealtimeKit export to R2 | Follow the retention rules in §14.4 |
| Chat | **Not part of Cloudflare Realtime**: build WebSocket chat in the backend (or use a managed chat service) | Voice notes and images go to object storage |
| Incoming-call alerts | FCM high-priority message plus a full-screen intent, with the call screen built in the app | Cloudflare carries media only |
| Phone-network (PSTN) calling | **Not provided** by Cloudflare Realtime | In-app calling only in v1; a telephony vendor would be needed for a phone fallback **[VERIFY]** |

**Call flow**
1. The user taps Start; the backend creates the session and a RealtimeKit meeting through the API, and issues short-lived participant tokens for user and astrologer, bound to the session and role.
2. The astrologer is alerted by push; on accept, both join.
3. **Billing starts only when both are connected** (§7.3). Metering combines the SDK's join/leave events, any server webhooks if available **[VERIFY]**, and a 5-second heartbeat from each side. The server decides; no single signal is trusted alone.
4. Missing heartbeats for more than 10 seconds pause the meter; 60 seconds without rejoining ends the session.
5. On end, the backend closes the meeting and settles (§12.3). Recording is off by default (§14.4).

**Network and quality tuning**
- Audio: Opus at about 24–32 kbps with DTX, echo cancellation and noise suppression.
- Video: default cap about 360p at 300–500 kbps; automatic audio-only fallback; a data-saver mode.
- Restrictive mobile networks: TURN over TCP/443 as a fallback.
- Android: a foreground service for ongoing calls, Bluetooth and speaker routing, and tests on battery-saver behaviour on Samsung, Xiaomi, Realme, Oppo and Vivo phones.

**Proof of concept before committing (2–3 weeks)**

| # | Test | Pass criterion (starting point) |
|---|---|---|
| 1 | Join time on 4G in tier-2 and tier-3 cities across Jio, Airtel and Vi | Median under 5 seconds |
| 2 | Voice at about 5% packet loss and high jitter | Intelligible, no repeated drops |
| 3 | Join/leave reliability for billing across about 1,000 test sessions | Zero unreconciled sessions |
| 4 | Android lock-screen and background behaviour across brands | Calls survive screen lock and app switch |
| 5 | Live test with 500 viewers (interactive and HLS) | Acceptable delay and measured cost |
| 6 | SDK availability and size for your mobile stack | Works with your chosen framework; app size within §8.0 |
| 7 | Recording export to R2 and storage location options | Meets §14.4 and data-location needs **[VERIFY with counsel]** |
| 8 | Cost check: measured gigabytes and participant-minutes per call vs the price list | Within 20% of the estimate in §20 |
| 9 | Support channel and incident process | Named contact and response targets |

**Risks:** RealtimeKit is a relatively new product, so maturity, SDK coverage and limits must be proven. Prices can change. Viewer billing in large live rooms can be material (§20). The **RTC adapter (§17.3)** keeps the rest of the product independent, so if a test fails you can switch to Agora, ZEGOCLOUD or LiveKit without redesigning.

**Where the source of truth lives:** keep billing, the ledger and the database in your India-region backend. Cloudflare handles media transport and storage of recordings only.

---

## 18. Non-functional requirements

| Area | Target (initial) |
|---|---|
| Time from tap to astrologer receiving a request | under 3 seconds (median) |
| Time from accept to connected | under 5 seconds (median) |
| Weak-network voice | Intelligible audio at about 5% packet loss and on 3G-class bandwidth; automatic audio-only fallback in video (to be proven in the Cloudflare proof of concept, §17.5) |
| Chat message latency | under 500 ms p95 on 4G |
| Billing accuracy | within ±1 second of server time; zero double-charges |
| Availability | 99.9% for wallet, billing, sessions; 99.5% for the rest |
| Scale at launch | 500 concurrent sessions, 3,000 concurrent live viewers, 20,000 daily active users |
| Scale plan | Load-tested to 5× launch before each major campaign |
| App size and devices | Under about 40 MB; Android 8+; 2 GB RAM devices usable |
| Security | OTP rate limits; short-lived tokens with refresh; device binding; TLS everywhere; field-level encryption; secrets manager; WAF; independent penetration test before launch |
| Privacy | PII masking in admin; audit logs; least privilege; data retention jobs |
| Accessibility | Scalable fonts, labelled controls, contrast checks |
| Localisation | All strings externalised; no text in images |
| Disaster recovery | Daily backups, point-in-time recovery for the database, tested restore, recovery objectives agreed with the team |

---

## 19. Analytics and metrics

### 19.1 Event list (minimum)

`app_open`, `language_selected`, `login_success`, `birth_profile_saved`, `astrologer_list_viewed`, `filter_applied`, `astrologer_profile_viewed`, `session_request_sent`, `session_accepted`, `session_declined`, `session_started`, `session_ended` (reason), `recharge_started`, `recharge_success`, `recharge_failed`, `low_balance_shown`, `rating_submitted`, `review_posted`, `report_submitted`, `refund_requested`, `refund_granted`, `live_viewed`, `live_question_asked`, `live_consult_cta_tapped`, `follow`, `notification_opened`, `spend_limit_changed`, `crisis_card_shown`, `pref_question_viewed`, `pref_answered`, `pref_skipped`, `pref_completed`, `category_viewed`, `picks_viewed`, `picks_consult_started`, `store_viewed`, `product_viewed`, `recommendation_sent`, `recommendation_opened`, `add_to_cart`, `checkout_started`, `order_placed`, `return_requested`.

### 19.2 Key metrics

| Group | Metric |
|---|---|
| Acquisition | Installs, CAC by channel, install → signup, signup → first session |
| Activation | First recharge rate, time to first paid session |
| Engagement | Sessions per paying user per month, minutes per paying user, repeat rate (30-day), average session length |
| Supply | Online hours per astrologer, acceptance rate, time-to-connect, supply–demand ratio by language and hour |
| Money | GMV, net revenue (take rate), ARPPU, refund rate, chargeback rate |
| Live | Viewers per show, watch time, questions per show, **live → paid 1:1 conversion** |
| Trust | Rating average, complaint rate per 1,000 sessions, repeat rate by astrologer, strikes issued, refund SLA hit rate, NPS |
| Safety | Flags per 1,000 sessions, crisis cases and response time, off-platform attempts blocked |
| Discovery | Preference-question completion and skip rates; consult rate on "Your picks" vs the default list; category-page conversion |
| Store | Recommendation → view → purchase rate; average order value; return rate; store complaints per 1,000 orders; recommended-item share of each astrologer's revenue (outlier watch) |

### 19.3 Guardrail metrics (watch for harm)

- Share of revenue from users spending above a high threshold per month (concentration risk).
- Users hitting their spend limit.
- Average session length trending upward without rating gains (possible stretching).
- Refund and complaint rates by astrologer.
- Astrologers whose recommendation conversion or order value is far above peers (possible pressure selling).

---

## 20. Illustrative economics (not a forecast)

All figures below use **assumptions** to show how the model behaves. Replace with your real numbers.

**Assumptions:** astrologer rate ₹30 per minute (treated as net of tax for simplicity); commission 25%; an assumed exchange rate of ₹90 per US dollar; Cloudflare RealtimeKit audio-only price of $0.0005 per participant-minute (two participants in a 1:1 call); payment gateway cost about 2% of the amount collected; an allowance of ₹0.70 per minute for support, moderation tools and other variable cost.

| Item per paid minute | ₹ |
|---|---|
| User charge | 30.00 |
| Astrologer share (75%) | 22.50 |
| Platform commission (25%) | 7.50 |
| RTC cost (Cloudflare RealtimeKit audio-only, 2 participants ≈ $0.001) | about 0.09 |
| Payment gateway (≈ 2% of 30) | 0.60 |
| Support / moderation / other variable | 0.70 |
| **Contribution per paid minute** | **about 6.1** |

1:1 video costs about four times the audio-only rate (two participants at $0.002 is about $0.004 per minute, roughly ₹0.36), still small. **Live shows are different.** A show with 1,000 viewers for an hour is 60,000 viewer-minutes. If each viewer is billed as an audio/video participant, that is about $120 (roughly ₹10,800) for video or about $30 (roughly ₹2,700) for audio-only. Delivering the same show as HLS through Stream at the listed delivery rate would be about $60 (roughly ₹5,400), plus ingest and encoding costs I could not confirm. So audio-first live shows and HLS for large rooms keep cost sensible, with interactive video reserved for the few viewers who ask a question **[VERIFY with Cloudflare, including participant limits]**.

**Break-even illustration.** Suppose fixed monthly cost (team, tools, servers, moderators, support) is ₹8 lakh.

| Item | Value |
|---|---|
| Paid minutes needed to cover ₹8 lakh at ₹6.1 contribution | about 131,000 per month |
| Per day | about 4,400 (≈ 73 hours of paid conversation per day) |
| Paying users needed if each pays for 40 minutes per month | about 3,300 |
| Paying users needed if each pays for 25 minutes per month | about 5,200 |

**Acquisition payback illustration.** Contribution per paying user at 40 minutes per month ≈ ₹240. If acquiring a paying user costs ₹600, payback ≈ 2.5 months; at ₹1,200, ≈ 5 months. This is why **CAC and repeat rate decide the business**, not the app.

**Be careful comparing "₹15 lakh in a month".** In a consultation marketplace, ₹15 lakh of user spend (GMV) at a 25% take is about ₹3.75 lakh of platform revenue, before costs. Gifting-style apps record revenue differently (coin sales minus payouts), so the two numbers are not directly comparable. Ask whether any figure is GMV, revenue, or profit.

**Price sensitivity:** every 5 percentage points of commission is about ₹1.5 per minute at this price; every extra 1% in payment gateway cost is about ₹0.30 per minute. Play Billing fees (if they apply to any product) would change this materially **[VERIFY]**.

**Store economics are a separate business.** Product margins depend on cost of goods, packaging, shipping, payment fees and returns, and do not behave like a per-minute commission. Astrotalk's store reportedly reached about ₹140 crore in its first year, which shows the demand, but it is also where complaints about remedy upselling concentrate. Model the Store with its own P&L, including return rates and any cash-on-delivery losses, before committing stock **[VERIFY with your CA]**.

---

## 21. Roadmap

Timelines are **indicative** and depend on team size (a typical build team: 2 mobile, 2 backend, 1 web, 1 QA, 1 designer, 1 product/PM).

### Phase 0 — Foundations (weeks 0–6, parallel)

- Legal structure, CA setup, GST/PAN, payment gateway onboarding (**confirm category acceptance**), SMS DLT, DPO and grievance officer, draft legal documents.
- Brand, design system, Hindi copy, prototype tests with 10 users and 5 astrologers.
- **Astrologer pipeline:** shortlist 100, interview, onboard **30–50** for the pilot, across at least Hindi and English, with at least a few women astrologers and a few with existing audiences.
- Vendor selection: RTC, KYC, payouts, ephemeris.

### Phase 1 — MVP build (weeks 6–18)

**User app:** language, **skippable preference questions**, login, birth profiles, home with **category tiles and "Your picks"**, list/filter, profile, pre-session, chat + voice, wallet/recharge, spend controls, ratings/reviews, refunds/reporting, support, free Kundli, **basic live viewing** (scheduled shows, chat, question).
**Astrologer app:** onboarding (with **category and capability selection**), KYC upload, training and quiz, status toggles, requests, chat + voice, earnings, payouts, strikes view, **schedule/host live**.
**Admin:** onboarding workflow, **category, collection and question management, capability flags**, astrologer/user management, finance (ledger, refunds, payouts with maker–checker), config, T&S console, live schedule/monitor, support, CMS, RBAC and audit.
**Cross-cutting:** billing meter, ledger, notifications, analytics events, crisis flow, dark-patterns audit.

### Phase 1.5 — Closed pilot (weeks 18–24)

Invite-only users (for example 2,000), 30–50 astrologers, daily review of billing accuracy, refunds, complaints. **Gate to open the public launch:** zero billing-error incidents for 2 weeks, refund SLA met above 95%, complaint rate under a threshold you set, time-to-connect median under 10 seconds in peak hours, positive unit economics per minute.

### Phase 2 — Public launch and growth (weeks 24–36)

Marketing with free tools and live clips; video 1:1; **Store launch in stages (A: paid digital reports; B: curated products with the Recommendation tool; C: wider catalogue only if returns and complaints are healthy)**; **gifts (v1.1) with caps** once moderation data is healthy; follow/notify improvements; referral; regional languages (pick 1–2 by demand); iOS app.

### Phase 3 — Expansion (after validation)

Puja booking with third-party pandits (with proof of service); fixed-price "quick question" packs; scheduled ticketed group sessions; NRI payments; astrologer assist tools (AI suggestions for charts, clearly labelled and optional); marketplace of services only if trust metrics hold.

---

## 22. Open decisions for the founder

| # | Decision | Options / my recommendation |
|---|---|---|
| 1 | Commission level | Start 20–25% (founding astrologers lower for 6 months) to win supply; reconsider after liquidity |
| 2 | Wallet structure | Prepaid service credits for the platform's own services; **get a legal opinion** before building |
| 3 | Play billing approach | Get advice; keep consultations and gifts separate in the design |
| 4 | Unused wallet balance policy | Allow refund on request with a clear process (builds trust; check the legal position) |
| 5 | Product/remedy selling | **Yes, but only through the Store and the Recommendation tool, from Phase 2**; never in chat; capped astrologer share; easy returns (§13.8) |
| 6 | Intro offer | One simple, honest offer (e.g., first 3 minutes at a fixed low price); avoid "free" if it isn't |
| 7 | Launch languages | Hindi + English; add a regional language only when you have 10+ strong astrologers |
| 8 | Live: video or audio first | Audio-first lowers bandwidth and astrologer pressure; allow both |
| 9 | Gifts | Hold until Phase 2, with caps and no public leaderboards |
| 10 | Recording policy | Chat transcripts yes; voice/video recording only with explicit notice (v2) |
| 11 | KYC ID type | Prefer DigiLocker / offline eKYC; avoid storing full Aadhaar |
| 12 | Moderation staffing | At least 1 moderator per live show and a T&S owner during all staffed hours |
| 13 | Crisis protocol owner | Appoint a person and train them; consult a clinician for wording |
| 14 | Product name and brand | Avoid religious or celebrity claims that imply endorsement |
| 15 | iOS timing | After Android stabilises |
| 16 | Store model | Platform as seller of record (first-party or curated drop-ship) to start; marketplace sellers later |
| 17 | Astrologer share on Store sales | Lower than the consultation commission, with a per-item cap; paid after the return window |
| 18 | Cash on delivery | Prepaid-only first; add COD with limits later |
| 19 | Launch catalogue | Digital reports first, then 20–30 certified, legally reviewed items; no consumables or medicinal items |
| 20 | Category tree | Start with the nine in §7.10; revise after the first 1,000 sessions |
| 21 | Live-host share | Expect a minority of astrologers to host; set a minimum host count before promoting the Live tab |
| 22 | Cloudflare proof of concept | Run the §17.5 tests and agree pass/fail gates before committing the build |

---

## 23. Sources used (research links)

Grouped by topic. Links were retrieved during research on 11 November 2026; some are secondary (news, law-firm blogs, vendor blogs) and should be checked against primary sources before you rely on them.

**Market and business model**
- Open Magazine: Astrotalk's FY26 revenue and consultation share — https://openthemagazine.com/business/astrotalks-1823-crore-question-what-are-people-really-paying-for
- Business India / IANS: Astrotalk FY26 profit and overseas revenue — https://www.newkerala.com/news/a/astrotalk-fy26-profit-jumps-10-fold-rs-222-crore-268.htm and https://ianslive.in/astrotalk-fy26-profit-jumps-10-fold-to-rs-222-crore-revenue-crosses-rs-1800-crore--20261028185454
- Outlook Business: Astrotalk FY25 revenue — https://www.outlookbusiness.com/start-up/news/astrotalk-reports-85-revenue-growth-in-fy25-as-tier-i-cities-boost-platform-activity
- Inc42: Astrotalk's vetting and commission model — https://inc42.com/?p=426531
- YourStory: Astrotalk Store — https://yourstory.com/2026/05/can-astrotalk-build-the-amazon-of-spiritual-commerce
- Astrotalk Store first-year revenue — https://indianstartupnews.com/news/astrotalk-store-hits-rs-140-crore-revenue-within-a-year-of-launch-ceo-says-we-saw-a-clear-opportunity-11005735 and, on gemstone sales following astrologer prescriptions, https://www.pulse.bot/entrepreneurship/news/can-astrotalk-build-the-amazon-of-spiritual-commerce-fbc9f421-204e-442b-99c1-1b56261593b3/
- Miracuves explainers (commission ranges vary; vendor blog) — https://miracuves.com/blog/business-model-of-astrotalk/ and https://miracuves.com/blog/what-is-astrotalk-how-it-works/
- RaftLabs: astrology app types and build cost (vendor blog) — https://test.raftlabs.com/blog/how-to-build-astrology-app

**User complaints and trust**
- Storyboard18: astrology apps, regulation, penalties, downloads, AstroSage financials — https://www.storyboard18.com/how-it-works/biz-of-belief-how-indias-astrology-apps-are-turning-faith-into-fortune-amid-rising-regulatory-concerns-83027.htm
- Sprouts News investigation (user complaints) — https://sproutsnews.com/?p=13750
- Analytics Insight: coverage of a YouTube sting — https://www.analyticsinsight.net/tech-news/astrotalk-scam-what-all-you-need-to-know
- Trustpilot pages for Astrotalk and AstroSage (anecdotal) — https://nz.trustpilot.com/review/astrotalk.com and https://ca.trustpilot.com/review/astrosage.com
- Mint (via Magzter): astrologer–platform relationship — https://www.magzter.com/es/stories/newspaper/Mint-Mumbai/WHEN-ASTROLOGERS-FAIL-TO-SEE-THEIR-OWN-FUTURE
- Free Press Journal: payment-link scams — https://www.freepressjournal.in/business/astrologer-scam-drains-bank-accounts-via-payment-links-indias-60000-crore-astrology-market-booms-as-youth-seek-quick-fixes

**Regulation**
- No guidelines for online astrology platforms (Department of Consumer Affairs to CIC) — https://telanganatoday.com/no-guidelines-for-online-astrology-platforms-consumer-affairs-dept-tells-cic and https://dailypioneer.com/news/no-guidelines-to-regulate-online-astrology-platforms-consumer
- CCPA dark-pattern enforcement — https://www.outlookbusiness.com/news/inside-indias-dark-pattern-crackdown-why-zepto-bookmyshow-and-others-are-under-ccpa-scanner and https://www.newkerala.com/news/a/govt-says-ccpa-imposes-rs-20-lakh-dark-948.htm
- The 13 dark patterns — https://legalmantra.net/blog-detail/dark-patterns-in-india-the-law-13-prohibited-practices-and-ccpa-enforcement-explained
- DPDP Rules 2025 and phased timeline — https://www.azbpartners.com/bank/indias-digital-personal-data-protection-act-phased-rollout-and-key-compliance-milestones/ , https://anantamias.com/current-affairs/dpdp-rules-2025-notified/?pdf=1 , https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/

**Tax and payments**
- Section 194-O explainers (rates differ between sources) — https://www.patronaccounting.com/blog/section-194o-tds-ecommerce-guide and https://resources.ondc.org/guidanceontax
- GST on platform services — https://disytax.com/?p=25061
- Google Play payments policy — https://support.google.com/googleplay/android-developer/answer/10281818?hl=en and TechCrunch on the 2024 delistings — https://techcrunch.com/2024/02/29/google-calls-out-10-indian-companies-for-evading-play-store-fees-warns-of-app-removal/amp

**Real-time vendors and pricing**
- ZEGOCLOUD pricing as listed in a July 2026 comparison — https://videosdk.live/blog/zegocloud-alternatives
- LiveKit vs Agora vs 100ms — https://www.pkgpulse.com/guides/livekit-vs-agora-vs-100ms-real-time-video-audio-sdks-2026
- Daily / 100ms pricing — https://www.forasoft.com/blog/article/daily-co-alternative
- Cloudflare Realtime overview (RealtimeKit, SFU, TURN, Stream) — https://developers.cloudflare.com/realtime/
- Cloudflare rates (RealtimeKit and Stream prices) — https://www.cloudflare.com/en-in/rates/
- Cloudflare SFU and TURN pricing — https://developers.cloudflare.com/realtime/sfu/pricing
- Cloudflare announcement of RealtimeKit and GA of SFU/TURN — https://itwire.com/business-it-news/business-software/make-your-apps-truly-interactive-with-cloudflare-realtime-and-realtimekit

---

*End of document. Suggested next steps: (1) confirm the open decisions in §22, (2) commission the legal and CA opinions marked [VERIFY], (3) have a designer turn §8–§10 into wireframes, (4) start astrologer recruiting now, because supply is the longest lead item.*