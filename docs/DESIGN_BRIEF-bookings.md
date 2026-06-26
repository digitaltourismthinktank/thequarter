# The Quarter — Design brief: member booking & check-in

**For:** Claude Design · **From:** build team · **Date:** 2026-06-26

We've **built and validated** room/pod booking + daily check-in for The Quarter member portal.
This brief asks for the **visual + interaction design** of the member-facing screens — the current
build works but feels clunky (especially date-picking and start/end time selection). We'll implement
your output as React + CSS Modules on the existing token system, so please **design within the system
and reuse the existing components** below.

---

## 1. Brand & system (please stay within this)

**Palette** (CSS tokens already in the codebase — use these, don't introduce new colours):
- Ink (text/dark surfaces): `--ink-900 #1E1A15`
- Page background: `--sand-50 #FBF8F2`; cards: white; sunken: `--sand-100 #F6F1E8`
- Neutrals (borders/muted text): sand-200 `#EEE6D8` … stone-500 `#7E715E` (muted text), stone-700 `#4A4136` (body)
- **Gold accent:** `--gold-500 #BE9B53` (primary fill), `--gold-600 #A6823C` (hover), `--gold-700 #8A6A2E` (gold text on light), `--gold-100 #F7EEDA` (soft wash)
- Danger only: `#A9442F`. **No green anywhere in the UI** (greenery lives in photography). No traffic-light scales.

**Type:** DM Sans, one family used expressively by weight + tracking. Scale: 11/12/14/16/18/22/28/36px+.
Eyebrows are uppercase, letter-spacing `0.14em`. Display is tight (`-0.03em`), bold.

**Voice:** warm, confident, British English, the occasional parenthetical aside. **Never** say desks are
"full / no space." Quiet is a feature ("find your focus"), Buzzing is a draw.

**Reuse these existing design-system components** (`components/ds/`): `Button`, `IconButton`, `Badge`,
`Switch` (ideal for Full/Half), `Select`, `Input`, `Checkbox`, `AvailabilityCalendar` (already exists —
strong candidate for the date/time picker), `Avatar`, `RoomCard` / `SpaceCard`, `PlanCard`. Radius,
elevation and spacing come from `styles/tokens/`.

---

## 2. Screens to design (priority order)

### A. Booking flow — `/book` *(the priority; this is what feels clunky)*
A member books a **meeting room or phone pod**. Flow: choose space → choose date → choose time → confirm,
plus a list of their upcoming bookings.

**Spaces:** The Knight's Tale (meeting room, up to 8–10), The Chapter House (meeting room, up to 4),
The Bell Tower (phone pod), The Scriptorium (phone pod) — *pods must read clearly as pods.*

**Rules:** Mon–Fri, 08:00–18:00, 30-minute increments; also quick options for Morning (08–13),
Afternoon (13–18), Full day. No double-booking.

**Problems to solve (key ask):**
1. **Date selection** currently uses a clunky control. Design an elegant date picker — ideally the
   existing `AvailabilityCalendar`, or a refined week view — that makes "today / this week / book further
   ahead" effortless and on-brand.
2. **Time selection** must be unmistakable. Current "tap start then tap end" confuses people. Propose a
   clearer pattern (e.g. a day **timeline** showing free/busy with an obvious start→end selection or a
   start-time + duration model). Busy vs free must be instantly readable.

**States to cover:** default, hover, selected, disabled (busy slot / past day), loading, empty
(no availability), error (slot just taken), success (booked). Responsive: mobile, tablet/iPad, desktop.

### B. Check-in card (on the member dashboard) — *make it elegant*
A member says they're in. Elements: **Full day / Half day** choice (use `Switch` or a clean segmented
control — the current checkbox is clunky), **I'm in today**, **I'll be in tomorrow**, **plan another day**,
and a list of **planned days** (removable). Show the current day balance.

### C. Member dashboard (home) — *refine the whole* 
Cards: Welcome + email; **Door code** chip (only when set); **Your plan** (name, price · period, "Manage
plan & billing"); **Your visits** (the check-in card, B); **Your bookings** (upcoming room/pod, cancel);
**Your days** (balance or "Unlimited", "Resets on …", "includes N rolled over"); **Quick links**. Goal:
a calm, scannable members' home. Please define the grid and responsive behaviour.

---

## 3. Coming next — keep the language consistent (not for this round)
- **Admin dashboard** (staff): members + days/plan, room calendar, blocks/overrides.
- **Per-room iPad kiosk** (landscape): one room's status + tap-to-book.
- **Entrance lobby screen** (PORTRAIT, big): today's room/pod availability; workspace status (The Hop
  Yard / The Vineyard / Dane John Gardens) when booked; a **busyness band** (Quiet → Steady → Busy →
  Buzzing) shown as a **tonal gold scale** (off-white → deep gold, never traffic lights); and **upcoming
  events** ("Events this month in The Kentish Pantry"). A consistent visual language across these would help.

---

## 4. Data each element shows (so mockups are realistic)
- **Space:** name; type (Meeting room / Phone pod / Workspace); capacity label ("up to 10", "4", pod).
- **Availability:** per 30-min slot, free or busy, 08:00–18:00.
- **Booking:** space, date, start–end time, cancel.
- **Check-in:** checked-in today (Full/Half) or not; day balance (number or "Unlimited"); planned future days.
- **Plan:** name, price, period, renewal date, rolled-over days, door code.

## 5. Deliverables
High-fidelity designs (Figma and/or HTML/CSS) for **A, B, C** with **all interaction states** and
**responsive** layouts (mobile, iPad, desktop), using the tokens in §1 and reusing the §1 components.
Please annotate hover / active / focus / selected / disabled / loading / empty / error.

## 6. Reference
- **Live current build** (member-gated): https://deploy-preview-1--thequarter.netlify.app → log in, then
  `/dashboard` and `/book`. (Build team can supply screenshots if a login isn't available.)
- **Tokens:** `styles/tokens/colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `base.css`.
- **Existing components:** `components/ds/*` (note `AvailabilityCalendar`, `Switch`, `Select`, `Button`, `Badge`).
- **Current (to be redesigned):** `components/site/BookingClient.tsx`, `CheckInCard.tsx`,
  `MyBookingsCard.tsx`, `WeekStrip.tsx` (+ their `.module.css`).
