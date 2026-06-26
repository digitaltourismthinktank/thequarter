# The Quarter — Design brief, Part 2: the whole member journey & every screen

**For:** Claude Design · **From:** build team · **Date:** 2026-06-26
**Follows on from:** *Design brief: member booking & check-in* (Part 1). Please treat this as a
**continuation** — same brand, same token system, same components. Part 1 asked you to redesign the
booking flow, check-in card and dashboard. **This part widens the scope to the entire journey** — from
the moment someone pays, through daily life as a member, to the staff and on-site screens — so the whole
experience hangs together as one designed system.

Everything described here is **already built and working** (member-gated preview below). We're not asking
"can it work" — we're asking you to make all of it **feel like one calm, confident, premium product**.
We implement your output as React + CSS Modules on the existing tokens, so please design **within the
system and reuse the existing components**.

---

## 0. The big picture — one continuous journey

Design these as a single arc, not eight unrelated screens. A person flows through it like this:

```
        PUBLIC SITE                 ONBOARDING                 DAILY MEMBER LIFE
  ┌─────────────────┐        ┌──────────────────┐       ┌───────────────────────────┐
  │ Home · Spaces · │  pay   │  /welcome/<plan> │ login │  /dashboard               │
  │ Plans · Events  ├───────▶│  create account, ├──────▶│  • days + renewal         │
  │ (Stripe link)   │ Stripe │  email pre-filled│       │  • check in (today/tom.)  │
  └─────────────────┘        │  plan + days set │       │  • upcoming bookings      │
                             └──────────────────┘       │  • what's on              │
                                                         └───────────┬───────────────┘
                                                                     │ book
                                                                     ▼
                                                         ┌───────────────────────────┐
                            scan QR on a room ──────────▶│  /book  (room preselected)│
                            (kiosk, see below)           │  pick date → time → done  │
                                                         └───────────────────────────┘

        ON-SITE, AMBIENT (no login)
  ┌──────────────────────────┐     ┌───────────────────────────────┐
  │  Entrance screen /screen │     │  Per-room kiosk /kiosk?room=  │
  │  PORTRAIT · lobby        │     │  LANDSCAPE · on each room door │
  │  busyness · rooms today  │     │  status now + QR "book on your │
  │  · what's on (community) │     │  phone" → deep-links to /book  │
  └──────────────────────────┘     └───────────────────────────────┘
```

Two "front doors" to booking: the **dashboard** (planned, from anywhere) and a **room's kiosk QR**
(spontaneous, standing outside the room). Both land in the same `/book`. The two ambient screens
(entrance + kiosk) are unauthenticated and exist to **build community and reduce friction**, not to gate.

---

## 1. Brand & system — unchanged from Part 1 (recap, please honour)

- **Palette (tokens, don't invent colours):** Ink `--ink-900 #1E1A15`; page `--sand-50 #FBF8F2`; cards white;
  sunken `--sand-100 #F6F1E8`; borders sand-200 `#EEE6D8`; muted text stone-500 `#7E715E`; body stone-700
  `#4A4136`. **Gold accent:** `--gold-500 #BE9B53` (primary), `--gold-600 #A6823C` (hover), `--gold-700
  #8A6A2E` (gold text on light), `--gold-100 #F7EEDA` (wash). Danger only `#A9442F`.
- **No green anywhere in the UI.** Greenery lives only in photography. **No traffic-light scales** — busyness
  is a **tonal gold** ramp (off-white → deep gold).
- **Type:** DM Sans, expressive by weight + tracking. 11/12/14/16/18/22/28/36px+. Eyebrows uppercase,
  tracking `0.14em`. Display tight (`-0.03em`), bold.
- **Voice:** warm, confident, British English, the occasional parenthetical aside. **Never** "full / no
  space" — Quiet is a feature ("find your focus"), Buzzing is a draw.
- **Reuse `components/ds/`:** `Button`, `IconButton`, `Badge`, `Switch`, `Select`, `Input`, `Checkbox`,
  `AvailabilityCalendar`, `Avatar`, `RoomCard`/`SpaceCard`, `PlanCard`. Radius/elevation/spacing from
  `styles/tokens/`.

### The naming canon (use these exact names, with the right category words)
- **Meeting rooms:** **The Knight's Tale** (up to 8–10) · **The Chapter House** (up to 4).
- **Phone pods:** **The Bell Tower** · **The Scriptorium**. *Always read clearly as pods, not rooms.*
- **Workspaces** (open desks — *not bookable*, shown for ambience, can be marked unavailable by staff):
  **The Hop Yard** · **The Vineyard** · **Dane John Gardens**.
- **Events venue:** **The Kentish Pantry**.
- Tone for workspaces: *"spaces usually available"* — never a count, never "full".

---

## 2. Screens to design

Part 1 covered **A booking**, **B check-in card**, **C dashboard** — please carry those through, with the
**two additions** noted in A. The new work in this round is **D–H**.

### A. Booking flow — `/book`  *(from Part 1, plus deep-link)*
Unchanged ask from Part 1 (elegant date picker + unmistakable time selection; Mon–Fri 08:00–18:00, 30-min,
plus Morning 08–13 / Afternoon 13–18 / Full day; no double-booking). **New:** the page can arrive with a
room **preselected** (`/book?room=<id>`, from a kiosk QR) — design the "room already chosen, just pick when"
entry state, ideally with a gentle confirmation of which room they're booking and an easy way to switch.

### B. Check-in card  *(from Part 1)*  ·  ### C. Member dashboard  *(from Part 1)*
Carry through Part 1. One addition to C: a **"What's on"** card (upcoming events in The Kentish Pantry —
title, date, short line). The dashboard is the member's calm home: plan + days, check-in, bookings, what's on,
door-code chip, quick links. Please define the grid + responsive behaviour across the now-larger card set.

### D. Welcome / onboarding — `/welcome/<plan>`  *(new — the first thing a paying member sees)*
Immediately after Stripe checkout, the member lands here to **create their login**. This is the emotional
"you're in" moment — make it feel like a warm doorway, not a form.
- **Content:** a welcome headline; a line confirming the **plan they just bought** (name · price · period);
  fields: **email** (pre-filled and locked to the address they paid with — explain gently why), **first /
  last name**, **password**; a primary **Create my account**; a quiet "Already have an account? Log in".
- **States:** loading (resolving their payment), email-locked vs editable, validation error, submitting,
  unknown-plan fallback. Mobile-first (many will do this on a phone, just after paying).
- **Why it matters:** the email must match Stripe so plan + days stay in sync — the design should make
  "keep this email" feel reassuring, not restrictive.

### E. Auth — `/login`, `/signup`, password reset  *(new — small but on the path)*
Simple, branded auth screens. Login (email + password, forgot link), the reset request + reset states, and a
generic signup (most people arrive via D, but `/signup` exists). Calm, single-column, same doorway feeling as
D. Cover error (wrong credentials), loading, success/redirect.

### F. Admin dashboard — `/admin`  *(new — staff-facing, but still The Quarter)*
Staff-only (gated by work email). It should feel like the **same family** as the member side — same palette
and type — but **denser and more utilitarian**, optimised for quick action behind the desk. Three panes
(tabs or a left rail — your call):

1. **Members** — searchable list; per member: name, email, plan, **days remaining**, renewal date. Actions:
   **adjust days** (＋/− with a reason), **check someone in manually** (Full/Half), see who's in today.
2. **Rooms** — a **week calendar** (Mon–Fri, 08:00–18:00) across all bookable spaces showing member bookings,
   external bookings and blocks. Actions: **add a block** (e.g. The Hop Yard reserved Tue/Thu, maintenance,
   private hire), **add an external booking** (non-member, with a name), **cancel** a booking. This is how
   staff drive what the entrance screen shows as unavailable.
3. **Events** — manage **The Kentish Pantry** events: list, **create / edit / delete** (title, date/time,
   short description, published toggle). Published future events feed the member "What's on" + entrance screen.

**States:** list / empty / loading / saving / error; a confirm step for destructive actions (cancel, delete,
big day adjustments). Please design the **week-calendar** carefully — it's the densest thing in the product
and currently the most utilitarian. Responsive down to a laptop; staff may also glance on a tablet.

### G. Per-room kiosk — `/kiosk?room=<id>`  *(new — landscape, on each room's door)*
A small always-on display (iPad or any screen) mounted by each meeting room / pod. **No login, no PIN, no
keyboard** — so it works on a plain screen too. It shows, big and glanceable from across the room:
- **Room name** + type (meeting room · capacity, or "Phone pod").
- **Status now:** *Available now* / *Busy until 14:30* / *Closed for today* — instantly readable.
- **A QR code:** "**Scan to book on your phone**". Scanning opens `/book?room=<id>` on the member's own phone
  (logged into their account) — so booking happens securely on personal devices, and the kiosk never needs
  input. (We swapped away from a kiosk PIN for exactly this reason.)
- **Today's schedule:** a short list of today's bookings/blocks for that room.
- **Two moods:** **free = warm gold** (`--gold-100` field, ink text); **busy = deep ink** (`--ink-900`,
  sand text). No traffic lights. Design both. Make the QR feel inviting, not like an error code — it's the
  call to action.

### H. Entrance lobby screen — `/screen`  *(new — PORTRAIT, big, ambient, community)*
A tall display in the entrance. **No login.** Its job is to make the space feel **alive and welcoming** and to
quietly orient people. Sections, top to bottom (your hierarchy):
- **A busyness band** — today's vibe as a **tonal gold scale**: Quiet → Steady → Busy → Buzzing (off-white →
  deep gold). This is a *feeling*, not a percentage or a count. See `docs/the-quarter-busyness-model.md` for the
  model and the exact wording per band. **Never** "full".
- **Meeting rooms & pods — today:** each space with its status (free now / next free time). The four bookable
  spaces by name.
- **Workspaces:** The Hop Yard / The Vineyard / Dane John Gardens — shown as *"spaces usually available"*, or
  **Unavailable** when staff have blocked them (e.g. The Hop Yard on private-hire days). Never a number.
- **What's on:** "This month in The Kentish Pantry" — upcoming events to build community.
- It auto-refreshes; design it to be legible **across a room**, in portrait, with generous type.

---

## 3. The busyness language (shared across H, and anywhere we show "how busy")
Four bands, as a **tonal gold ramp**, never traffic-light: **Quiet** ("room to think") → **Steady** →
**Busy** → **Buzzing** ("the place is humming"). Full model, factors and copy in
`docs/the-quarter-busyness-model.md`. Please design the band as a reusable motif (it appears on the entrance
screen and could appear subtly on the dashboard). It must read instantly and **never feel like a warning**.

## 4. Data each element shows (so mockups are realistic)
- **Space:** name; type (Meeting room / Phone pod / Workspace); capacity label ("up to 10", "4", "Phone pod").
- **Availability:** per 30-min slot, free or busy, 08:00–18:00, Mon–Fri.
- **Booking:** space, date, start–end, who (member or external name), cancel.
- **Block:** space, date, start–end, reason/label.
- **Check-in:** in today (Full/Half) or not; day balance (number or "Unlimited"); planned future days.
- **Member (admin):** name, email, plan, days remaining, renewal date.
- **Plan:** name, price, period, renewal date, rolled-over days, door code.
- **Event:** title, date/time, short description, published.
- **Busyness:** one of four bands + a short on-brand line.

## 5. Deliverables
High-fidelity designs (Figma and/or HTML/CSS) for **D, E, F, G, H** (and the **A deep-link** entry state),
carrying through **A, B, C** from Part 1 so the set is coherent. For each: **all interaction states**
(default / hover / active / focus / selected / disabled / loading / empty / error / success where relevant)
and **responsive** layouts. Note the orientation per surface: **member + admin** = mobile/tablet/desktop;
**kiosk (G)** = landscape; **entrance (H)** = portrait. Use the §1 tokens and reuse the §1 components, and keep
the naming canon exact.

## 6. Reference
- **Live build** (member-gated): https://deploy-preview-1--thequarter.netlify.app
  - Member: `/login` → `/dashboard`, `/book` (try `/book?room=<id>` for the deep-link state).
  - Onboarding: `/welcome/resident` (and `visitor` / `citizen` / `hybrid-office`).
  - Ambient (no login): `/screen` (portrait), `/kiosk?room=<id>` (landscape). Build team can supply space IDs +
    screenshots.
  - Admin: `/admin` (staff email required — build team can screenshot).
- **Tokens:** `styles/tokens/colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `base.css`.
- **Components:** `components/ds/*` (note `AvailabilityCalendar`, `Switch`, `Select`, `Button`, `Badge`).
- **Busyness model:** `docs/the-quarter-busyness-model.md`.
- **Current (to be redesigned), `components/site/`:** `BookingClient`, `CheckInCard`, `MyBookingsCard`,
  `WeekStrip`, `DashboardClient`, `EventsCard`, `WelcomeClient`, `AdminClient`, `KioskClient`, `ScreenClient`
  (+ each `.module.css`).
- **Part 1 brief:** `docs/DESIGN_BRIEF-bookings.md`.
