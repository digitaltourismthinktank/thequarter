# The Quarter — Technical Specification

> Single source of truth for how thequarter.co.uk (member portal + public site) is built,
> hosted, and integrated. Written for handover to another developer or AI system.
> Last updated: 2026-06-26.

---

## 1. What this is

**The Quarter** is a boutique coworking space in Canterbury's Cathedral Quarter, run by the
**Digital Tourism Think Tank (DTTT)**. This repo is its website + member portal:

- **Phase 1 (live):** public marketing site (home, spaces, plans, meeting rooms, events, perks, about, location).
- **Phase 2 (live):** member portal — login/signup, gated dashboard, Stripe↔Memberstack auto-sync of plan/days/pause, one-click billing portal.
- **Phase 3 (in progress, branch `feature/bookings`):** meeting-room & phone-pod booking, member check-in / day-usage tracking, admin dashboard, iPad room kiosks.

### Brand & content rules (non-negotiable)
- **British English** throughout. Warm, confident, human voice.
- **No green** as a UI/brand colour. Palette is gold / sand / ink / warm neutrals.
- **Never advertise free trial days.** Public entry point is the **Day Pass**.
- Never reference Canterbury BID.
- Keep the supplied logo exactly as provided.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14.2.x**, App Router, TypeScript |
| Output | **Static export** (`output: 'export'` → `out/`), `trailingSlash: true`, `images: { unoptimized: true }`, `eslint.ignoreDuringBuilds: true` |
| Styling | **Design tokens as CSS custom properties** (`styles/tokens/*.css`) + **CSS Modules**. No Tailwind. |
| Fonts | **DM Sans** via `next/font` → `--font-dm-sans` → `--font-sans` |
| Hosting | **Netlify** (static publish of `out/` + **Netlify Functions** in `netlify/functions/`, esbuild bundler) |
| Forms | Netlify Forms (enquiry/contact) |
| Auth & members | **Memberstack** (DOM SDK via hosted CDN; Admin SDK in functions) |
| Payments | **Stripe** (Payment Links, Billing Portal, Webhooks) |
| Ops data (Phase 3) | **Airtable** (bookings, check-ins, spaces), fronted by Netlify Functions |

### Key architectural principle
The browser never holds server secrets. All privileged work (Stripe, Airtable, Memberstack
admin) happens in **Netlify Functions**, which verify the member's Memberstack token before acting.

```
Browser / iPad kiosks
      │  (member JWT)
      ▼
Netlify Functions  ──►  Memberstack Admin API (identity, plans, days, custom fields)
      │             ──►  Stripe API (customers, billing portal)
      │             ──►  Airtable API (bookings, check-ins, spaces)   [Phase 3]
      ▼
Static Next.js site (out/) served by Netlify CDN
```

---

## 3. Repository & environment

- **Repo:** https://github.com/digitaltourismthinktank/thequarter.git (branch `main` = production).
- **Netlify project ID:** `7596f8bd-cad5-4ad6-8850-af9988b2df48`.
- **Live URL:** https://thequarter.netlify.app (custom domain managed separately by the client).
- **Local toolchain:** a project-local `.tooling/` (Node 20, `gh` CLI), git-ignored. `package-lock.json` is git-ignored (Netlify installs fresh; npm is unreliable on the dev machine).

### ⚠️ Critical environment constraint
The current development Mac **deadlocks / OOM-kills** `next build`, `next dev`, and full-project
`tsc` (exit 137, 0% CPU — disk/memory pressure). **Do not rely on local builds.** Validation is via:
- **Netlify cloud builds** (push → build) and `curl`/WebFetch of the deployed site/functions.
- Lightweight local checks only: `node --check <file>.mjs` for function syntax.

### Netlify build config (`netlify.toml`)
- Build command: `npm run build`; publish: `out`; `NODE_VERSION=20`.
- `[functions]` directory `netlify/functions`, `node_bundler = "esbuild"`.
- **Branch deploys:** set to production-only so feature-branch commits don't consume build credits. Phase-3 work happens on `feature/bookings` and is merged to `main` once (one production deploy).

---

## 4. Source layout

```
app/                      Next.js App Router pages (route per folder) + layout.tsx (loads Memberstack CDN + JSON-LD)
components/
  ds/                     Design-system primitives (Button, Icon, …) ported from the design handoff
  site/                   Site components incl. AuthScreen, DashboardClient, useMember
lib/                      Data + config (site, plans, rooms, availability, spaces, perks, events, nav, media,
                          commerce [Stripe URLs], memberstack [client helper])
netlify/functions/        Serverless functions (.mjs) — see §7
styles/tokens/            CSS custom-property design tokens
docs/                     This spec
```

---

## 5. Integrations

### 5.1 Memberstack (identity / plans / days)
- **App ID (public):** `app_cmd30v5y700cg0wux95ltg5ky`. Loaded via the hosted CDN script in
  `app/layout.tsx` (`data-memberstack-app`) → `window.$memberstackDom`. Client helper: `lib/memberstack.ts`.
  Hook: `components/site/useMember.ts` (retries `getCurrentMember({useCache:false})` to ride out the
  post-login session race; after auth use client-side `router.push('/dashboard')` — a full reload bounced to /login).
- **Admin SDK** (`@memberstack/admin`, in functions): `verifyToken`, `members.retrieve({id|email})`,
  `members.update({id, data:{customFields|metaData|json}})`, `members.addFreePlan`/`removeFreePlan({id, data:{planId}})`.
  Member object includes `auth.email`, `planConnections[]` (each `string | {planId, planName, …}`),
  `customFields`, `metaData`, `permissions[]`.
- **Payment stays on Stripe Payment Links** — Memberstack plans are **FREE access tiers** used only for
  gating/labels (avoids Memberstack's payment cut).
- **Plan IDs (`pln_…`)** ↔ allowance:
  | Plan | Memberstack id | Day allowance |
  |---|---|---|
  | Day Pass | `pln_daily-plan-45nv0v26` | 1 (one-off, Typeform) |
  | Visitor | `pln_visitor-plan-blk50re2` | 5 / month |
  | Resident | `pln_resident-plan-mqjy0f6w` | 10 / month |
  | Citizen | `pln_citizen-plan-q9oa04p9` | unlimited |
  | Hybrid Office | `pln_hybrid-plan-r4k60rjp` | 12 / year |
  | Paused | `pln_paused-fns0m38` | n/a (freeze) |
- **Member custom fields** (tolerant key matching in `lib/memberstack.ts`): `days-remaining`,
  `renewal-date`, `door-code`, `first-name`, `last-name`, `company`, `member-since`, `phone-number`, `entry`.
  Citizen shows "Unlimited". `metaData.lastSyncAt` / `metaData.lastEventId` are used by the webhook's
  stale-event guard (see §6).
- **Admin gating (Phase 3):** by **email domain** — anyone signed in `@thinkdigital.travel` is staff
  (env `ADMIN_EMAIL_DOMAIN`, default `thinkdigital.travel`; optional `ADMIN_EMAILS` comma-list for extras).
  No Memberstack permission to manage. Enforced server-side in `_member.mjs` `isAdmin()`. Relies on account
  emails being trustworthy (keep Memberstack email verification on).

### 5.2 Stripe (payments)
- **Payment Links** (in `lib/commerce.ts`): Visitor, Resident, Citizen, Hybrid Office checkout URLs;
  Day Pass → Typeform; billing portal login URL fallback.
- **Price IDs** (live) → plan, used by the webhook to re-tag on switch:
  Citizen `price_0PgS1pw5GSGOu4zJQpVlN6Gm` · Resident `price_0PgRphw5GSGOu4zJ0dnCFwjp` ·
  Visitor `price_0PgRo1w5GSGOu4zJdycNlCpy` · Hybrid `price_0OtrBRw5GSGOu4zJC3vsROvC` ·
  Day Pass `price_0PgRmsw5GSGOu4zJxWrmYHWg` · **Pause £0** `price_0PoNQ6w5GSGOu4zJbBJkYlBT`.
- **Restricted API key** (`STRIPE_SECRET_KEY`, `rk_live_…`): needs **Customers: Read**,
  **Customer Portal: Write** (own-account column), and **Subscriptions: Read** (+ Billing Cadences Read on
  this account) for subscription reads. The webhook itself only needs Customers:Read (it reads price from
  the event payload).
- **Webhook endpoint** ("The Quarter - Netlify", **Live mode**): `…/.netlify/functions/stripe-webhook`,
  subscribed to `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`. The
  signing secret in Netlify (`STRIPE_WEBHOOK_SECRET`) **must match this endpoint** — a mismatch rejects
  every event with `bad-signature` (100% error rate). See §6.

### 5.3 Airtable (Phase-3 ops data)
- Base **"The Quarter — Ops"** `appXJmVtc0qpYkGk6` (workspace DTTT `wsp7Wwy2Bekb07ZHs`).
- Tables & field IDs: see §8.2. Accessed only by Netlify Functions using `AIRTABLE_API_KEY` (a scoped
  Personal Access Token). The client/kiosks never touch Airtable directly.
- Airtable's own grid/calendar is the **admin override tool** for manual external bookings / room blocks.

---

## 6. Stripe → Memberstack sync (Phase 2 — "Part B", live)

Implemented in `netlify/functions/stripe-webhook.mjs` + shared `netlify/functions/_quarter-sync.mjs`.

**On each event (signature-verified):**
- A **stale-event guard** runs first: each member is stamped (`metaData.lastSyncAt` / `lastEventId`); events
  older than the last applied, or duplicates, are skipped. This makes the member reflect the *latest* change
  regardless of Stripe's delivery order / retries.
- `customer.subscription.created|updated`: map the subscription's price → Memberstack plan and **re-tag**
  (`setMemberPlan` adds the target, removes other managed plans). A **£0 / pause price** → the **Paused**
  plan and **freezes** the day balance. A real plan change sets days to the **new plan's allowance (flat)**.
- `invoice.paid`: only a genuine **renewal** (`billing_reason === 'subscription_cycle'`) resets days, **with
  rollover**. Proration/plan-change invoices do **not** touch days (the plan owns that).
- `customer.subscription.deleted`: lapse days to 0.

**Day-balance rules** (`_quarter-sync.mjs`):
- **Renewal** → allowance + **1-month rollover** (carry ≤ allowance; total capped at **2×**). `nextBalance()`.
- **Plan switch** → new plan's allowance **flat** (interim). **Agreed target: usage-aware** (new = new
  allowance − days used this cycle), to be built with check-in (Phase 3). Downgrade caps at the new plan's
  allowance; Stripe pro-rates the money automatically.
- **Pause** → days frozen (Paused plan not in the allowance map → no write).
- **Citizen** → "Unlimited" in all reset paths.

**Billing portal** (`netlify/functions/billing-portal.mjs`): verifies the member token, finds the Stripe
customer by email (prefers the customer that has a subscription — handles duplicate same-email customers),
creates a `billing_portal/session` (uses `STRIPE_BILLING_PORTAL_CONFIG=bpc_…`). Dashboard "Manage plan"
calls it, falling back to the generic portal link.

**Debug tooling (REMOVE before final handover):** `netlify/functions/sim-renewal.mjs` (gated by `SIM_KEY`)
exposes `?inspect`, `?syncstripe`, `?recentsubs`, `?plan=`, renewal sim, `?lapse`; the webhook keeps an
in-memory event ring readable via `GET ?key=SIM_KEY`.

---

## 7. Netlify Functions

| File | Purpose | Key env |
|---|---|---|
| `stripe-webhook.mjs` | Stripe → Memberstack sync (plan/days/pause) + stale-event guard | `STRIPE_WEBHOOK_SECRET`, `MEMBERSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `SIM_KEY` |
| `billing-portal.mjs` | One-click Stripe billing portal session | `MEMBERSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_BILLING_PORTAL_CONFIG` |
| `_quarter-sync.mjs` | Shared sync logic (helper, not an endpoint — leading `_`) | — |
| `sim-renewal.mjs` | Admin test/debug tool (remove before handover) | `MEMBERSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `SIM_KEY` |
| `bookings.mjs` | Spaces, availability, my-bookings, book, cancel (Mon–Fri 08–18, 30-min, overlap guard) | `AIRTABLE_API_KEY`, `MEMBERSTACK_SECRET_KEY` |
| `checkin.mjs` | Self check-in (full/half), Today/Tomorrow reserve, day deduction, usage ledger | `AIRTABLE_API_KEY`, `MEMBERSTACK_SECRET_KEY` |
| `_airtable.mjs` / `_member.mjs` / `_time.mjs` | Shared helpers: Airtable client+IDs; member verify + `isAdmin`; London time + booking rules | — |
| _Still to build_ | admin actions, kiosk endpoints, member booking/check-in UI | `AIRTABLE_API_KEY`, kiosk token |

Function signature is Netlify v2: `export default async function handler(req) → Response`.

---

## 8. Data model

### 8.1 Memberstack (per member)
`planConnections` (plan tier, incl. Paused), `customFields` (see §5.1), `metaData.lastSyncAt`/`lastEventId`
(sync guard). Day balance lives in `days-remaining`; Phase 3 makes the Airtable Check-ins ledger the source
of truth and writes the computed remaining back here.

### 8.2 Airtable base `appXJmVtc0qpYkGk6`
- **Spaces** `tblMA8yMgaRwK1jqY` — Name, Type (Meeting room/Phone pod), Capacity, Capacity label, Bookable,
  Colour, Order. Seeded: The Knight's Tale (8–10), The Chapter House (4), Phone Pod 1, Phone Pod 2.
- **Bookings** `tblrqFJaYYl3pzYoN` — Title, Space (→Spaces), Start, End (dateTime Europe/London),
  Kind (Member/External/Block), Member email, Name (display / external / "blocked for"),
  Status (Confirmed/Cancelled), Source (Web/Kiosk/Admin), Notes.
- **Check-ins** `tblW7PzgfJwsLH1N9` — Ref, Member email, Name, Date, Length (Full/Half), Day cost (1/0.5),
  Status (Planned/Checked-in/Cancelled), Source (Self/Admin/Kiosk), Notes. _(Full field IDs in the team
  memory + retrievable via `get_table_schema`.)_

### Booking rules
Mon–Fri **08:00–18:00**; slots **30 min / 1 hr / half-day (AM 08:00–13:00, PM 13:00–18:00) / full-day**;
no overlaps (read-check-write; low volume → optimistic concurrency); admin can create **External** bookings
and **Block** rooms with a reason. Free for members (fair use; no credit ledger yet).

### Check-in rules
"I'm in" → **full-day default** + **half-day** toggle; quick **Today** (check in now) / **Tomorrow**
(reserve, deduct on arrival) links. Citizen unlimited = record visit, no decrement. Members get an
auto-generated **booking PIN + QR** on their dashboard for kiosk identification.

---

## 9. Environment variables (Netlify)

**Secrets (names only — set in the Netlify UI, never commit):**
`MEMBERSTACK_SECRET_KEY`, `STRIPE_SECRET_KEY` (rk_live_…), `STRIPE_WEBHOOK_SECRET` (whsec_…),
`STRIPE_BILLING_PORTAL_CONFIG` (bpc_…), `SIM_KEY` (debug — remove on handover), `AIRTABLE_API_KEY` (Phase 3).

**Public/derivable:** `NEXT_PUBLIC_SITE_URL` (production domain; `lib/site.ts` defaults to the Netlify URL).
`ADMIN_EMAIL_DOMAIN` (default `thinkdigital.travel`) + optional `ADMIN_EMAILS` allowlist control admin access.
Memberstack App ID and plan/price IDs are public and currently hardcoded.

> Note: the Netlify MCP reliably writes only NON-secret env vars; **set secret keys in the Netlify UI.**

---

## 10. Known gotchas (hard-won)
1. **Local builds OOM** — validate on Netlify only (see §3).
2. **Stripe webhook signing secret must match the live endpoint**, or 100% of events fail `bad-signature`.
3. **Restricted Stripe key scopes** — Customer Portal: Write (own-account column) for the portal;
   Subscriptions: Read (+ Billing Cadences Read) only needed for diagnostics, not the webhook.
4. **Stripe ↔ Memberstack are matched by EMAIL** — a member's Memberstack email must equal their Stripe
   customer email. The `/welcome/[plan]` post-payment flow (task #12) will enforce this.
5. **Out-of-order / retried Stripe events** — handled by the stale-event guard (§6).
6. **Admin `planConnections`** may be id strings or objects — always extract `planId` defensively.
7. **Duplicate same-email Stripe customers** — billing-portal picks the one with a subscription.

---

## 11. Roadmap
- **Phase 3 (current):** bookings + check-in + admin + kiosks (branch `feature/bookings`, tasks #18–26).
- Wire **usage-aware** plan-switch once check-in tracks usage.
- **Task #12:** `/welcome/[plan]` post-payment signup (email-match guarantee).
- Remove debug tooling (`sim-renewal`, webhook recorder, `SIM_KEY`).
- Later: PWA / mobile app.
