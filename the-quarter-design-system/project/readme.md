# The Quarter — Design System

A digital identity and product design system for **The Quarter**, a boutique coworking space on the first floor of a renovated building in Canterbury's Cathedral Quarter, with cathedral views from the café. The Quarter is run by the **Digital Tourism Think Tank** as a considered sideline — not a corporate chain. People come for warmth, human contact and a change of scene; an escape from working at home.

The system is built to scale across four surfaces that share one language:
1. **Marketing website** (public)
2. **Member dashboard & web app** (account, bookings, rewards)
3. **In-office display screens** (glanceable room availability, wall-mounted)
4. **Future native member app** (phone)

> **Brand promise:** *So much more than a workspace.* Elevated, contemporary and confident — but unmistakably warm. Hospitality-grade, not tech-startup. **Wherever "slick" and "warm" pull against each other, warmth wins.**

---

## Sources used to build this system

- **GitHub:** [`digitaltourismthinktank/thequarter-design`](https://github.com/digitaltourismthinktank/thequarter-design) — the design-system repo (empty at time of build; this project populates it). Explore it for any future brand artefacts.
- **Logo files** (provided, used exactly as-is): the black "The Quarter" wordmark, white wordmark, the rounded-square mark, and the app icon with its quarter-circle cut. Stored in `assets/`.
- **Reference brands studied** (not copied): silversquare.eu (design-led, biophilic warmth), wework.com/en-GB (category baseline for booking/plan UX — to transcend), thenestwork.be (boutique refinement), Fora, Second Home (plantspiration), Soho Works (members-club feel).

Nothing here depends on the reader having access to those sources; links are stored for deeper future work.

---

## CONTENT FUNDAMENTALS — how The Quarter writes

**Voice:** warm, confident, conversational, never corporate. We sound like a well-read host who happens to run a beautiful room — relaxed but precise. **British English throughout** (organise, programme, neighbourhood, "Monday to Friday").

**Person:** address the reader as **you**; speak as **we / our**. "Come and see what we've built." "Your plan, your days, your room."

**Casing:** sentence case almost everywhere — headings, buttons, labels. UPPERCASE is reserved for the small gold eyebrow/overline and micro UI labels (with wide tracking). Never SHOUT in body copy.

**Tone tests:**
- ✅ "Find your focus." · "An escape from home." · "So much more than a workspace."
- ✅ "The cathedral view, the natural light and the breakfast." · "Run as a considered sideline."
- ❌ "Leverage our best-in-class workspace solutions." · "Unlock productivity." · "Synergise."

**Phrases we own:** *plantspiration* (our plant-filled aesthetic), *find your focus*, *an escape from home*, *so much more than a workspace*, *the Cathedral Quarter*.

**Numbers & money:** prices include VAT and are written with the £ sign ("£21.60", "£258 a month"). Meeting-room pricing is "quoted on enquiry"; design around half-day and full-day packages with catering. Plans: Day Pass £21.60 (one day), Visitor £84 (five days), Resident £138 (ten days), Citizen £258 a month (unrestricted), Hybrid Office £42 a month (Canterbury mailing address + twelve days a year).

**Emoji:** none. We don't use emoji in product or marketing copy. Warmth comes from words, photography and space — not from 🌿.

**Hard copy rules:** Never advertise free trial days — the public entry point is always the **Day Pass**. Never reference or rely on Canterbury BID.

---

## VISUAL FOUNDATIONS

**The feeling:** fresh, light, full of plants. Generous whitespace, an airy uncluttered feel, soft rounded corners. The cathedral view, the natural light, the greenery and the breakfast are the emotional hero — carried by **photography**, never by UI chrome.

**Colour.** Foundation is **black, white and gold** (the logo is a black wordmark; gold is the accent), extended with refined **warm neutrals** — a *Sand* scale for paper/surfaces and a *Stone* scale for text/borders.
- **Ink** `#1E1A15` — a warm near-black (espresso, not pure black) for text and confident surfaces. Pure black is reserved for the logo lock-up.
- **Paper** — warm cream page `#FBF8F2`; white `#FFFFFF` for raised cards.
- **Gold** `#BE9B53` (gold-500) — the single accent: fills, highlights, the Quarter Card. `gold-700` `#8A6A2E` is the only gold that passes contrast for *text* on light.
- **No green as a UI or brand colour.** Greenery lives exclusively in photography. Functional status colours (success/warning/danger/info) are warm-shifted and used only for status, never as brand colour.

**Type.** One family used expressively: **DM Sans** (clean, modern, warm geometric sans). Display sizes run **bold with tight tracking** (−0.03em) and tight leading (1.04); body stays **regular, airy** (line-height 1.5). Eyebrows are uppercase, 600 weight, 0.14em tracking, in gold-700. The 8px-base type scale runs 11 → 96px (the largest reserved for the in-office display). *Substitution note: DM Sans is loaded from Google Fonts — see Caveats.*

**Spacing & layout.** 8px base rhythm; sections on the website breathe at 104–128px vertical. Container max 1200px (1320 wide; 760 for long-form reading). Whitespace is a brand value — when in doubt, add air.

**Corners & cards.** Soft and rounded everywhere. Inputs 14px, cards 20px, feature panels 28px, hero media 40px, buttons are full **pills** (sm buttons use 10px). A standard card = white surface, 1px `sand-200` border, soft `--shadow-card`, **lifts 4px** on hover with a deeper shadow. No coloured-left-border cards, no harsh outlines.

**Elevation.** Shadows are **soft, low and warm-tinted** — cast in espresso `rgba(30,26,21,…)`, never blue-grey. Nothing floats aggressively. The Quarter Card gets a special **gold glow** (`--shadow-gold`).

**Backgrounds & imagery.** Cream and white grounds; the dark footer + Quarter Card use the warm ink ground. Imagery is **warm, natural-light, real** — the cathedral through the café window, the open Main Space, the slat-lined Flexi booths (the Bell Tower & the Scriptorium), the hybrid-ready meeting rooms, the daily breakfast and people at our socials. **No generic office stock.** Real photography of the space lives in **`assets/photos/`** and is wired throughout the kits (hero, space/room cards, features, login, app). The brand's one geometric motif is the **quarter-circle** (from the app icon), reused as a soft gold arc on the Quarter Card and as occasional section accents.

**Motion.** Gentle and assured. Fades and soft 4px lifts on hover; gold focus rings (`0 0 0 4px rgba(190,155,83,.18)`). Standard easing `cubic-bezier(.4,0,.2,1)`; a softer settle `cubic-bezier(.16,1,.3,1)` for lifts. Durations 140 / 220 / 420ms. No bounces, no infinite decorative loops.

**Hover / press states.** Hover = darker fill (primary ink → ink-800) or a sand tint (ghost/secondary) and a slight card lift. Press = scale to 0.97. Secondary (outline) buttons invert to ink-on-fill on hover. Links shift to ink and nudge their trailing arrow +3px.

**Transparency & blur.** Used sparingly: the light navbar is `rgba(251,248,242,.86)` with a `blur(12px)` backdrop; the dark navbar is fully transparent over hero imagery. Otherwise surfaces are solid.

**Accessibility.** Mind contrast — gold is decorative/accent; use ink or gold-700 for text. The in-office display uses large type and strong contrast for across-the-room legibility. Focus is always visible (gold ring).

---

## ICONOGRAPHY

- **Style:** line icons on a 24px grid, **1.75 stroke**, round caps and joins — calm and hospitality-grade, matching Lucide's geometry. Implemented as the bundled **`Icon`** component with a curated path set (no external dependency in the React bundle).
- **Where they come from:** the curated subset mirrors **[Lucide](https://lucide.dev)**. If you need an icon outside the set, add it to `components/core/Icon.jsx` using the matching Lucide path (keep 1.75 stroke, round caps) rather than mixing icon families. *Substitution note: icons are Lucide-style line icons, not a bespoke set — flag if a proprietary icon library is expected.*
- **Available names:** arrow-right/left/up-right, check, plus, minus, x, chevron-down/right, calendar, clock, users, user, wifi, coffee, leaf, monitor, map-pin, star, gift, credit-card, menu, search, bell, settings, sparkles, door-open, briefcase, log-out, utensils, phone.
- **Colour:** icons inherit `currentColor`; accent icons use `gold-600` / `gold-700`. Used at 15–20px inline, larger in empty states.
- **Emoji / unicode as icons:** never. Use the `Icon` component.

---

## INDEX — what's in this system

**Foundations (root)**
- `styles.css` — the single entry point consumers link. `@import` manifest only.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `fonts.css`, `base.css`.
- `guidelines/*.card.html` — foundation specimen cards (Colours, Type, Spacing, Brand) shown in the Design System tab.
- `assets/` — the logo lock-ups, rounded mark and app icon.

**Components** (`components/`, bundled to `window.TheQuarterDesignSystem_*`)
- `core/` — **Button, IconButton, Badge, Avatar, Icon**
- `forms/` — **Input, Select, Checkbox, Switch**
- `navigation/` — **Navbar, Footer**
- `cards/` — **SpaceCard, PlanCard, RoomCard, PerkCard**
- `dashboard/` — **StatTile, QuarterCard, AvailabilityCalendar, EmptyState**

Each directory has a `*.card.html` demonstrating its components, and every component has a `.d.ts` (props) and `.prompt.md` (what/when + usage).

**UI kits** (`ui_kits/`)
- `website/` — homepage, the spaces, plans & pricing, meeting rooms + weekly availability, perks, Day Pass checkout.
- `dashboard/` — the member dashboard (plan & days, booking, the Quarter Card + perks, account).
- `display/` — wall-mounted in-office availability board.
- `app/` — phone-scale member app (room availability + perks).

**Skill**
- `SKILL.md` — makes this folder usable as a downloadable Agent Skill.

---

*Built by the Digital Tourism Think Tank design effort. Keep the logo exactly as provided; let everything else evolve. Warmth wins.*
