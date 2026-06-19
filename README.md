# The Quarter — website (phase 1)

The public marketing site for **The Quarter**, a boutique coworking space in Canterbury's Cathedral Quarter, run by the Digital Tourism Think Tank.

Built on the handoff design system in [`the-quarter-design-system/`](the-quarter-design-system/) — its tokens and components are reused throughout; the visual language is not re-invented.

## Stack

- **Next.js (App Router) + TypeScript**, statically exported (`output: 'export'`) to plain HTML for the CDN — best for SEO/AEO and lowest hosting cost.
- **Design tokens** as CSS custom properties (`styles/tokens/`), **DM Sans** via `next/font`, components styled with **CSS Modules**.
- Deployed to **Netlify** (static `out/`), with enquiry/contact handled by **Netlify Forms**.

## Local development

Node 20 is required. A project-local copy lives in `.tooling/node` (git-ignored); add it to your PATH, or use your own Node 20.

```bash
export PATH="$PWD/.tooling/node/bin:$PATH"   # if using the bundled toolchain
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
```

## Project structure

```
app/                  routes (home, about, spaces, plans, meeting-rooms[/room],
                      perks, events, location, day-pass, login, signup, dashboard)
components/ds/        design-system components ported to TSX (Button, Card set,
                      AvailabilityCalendar, form controls, …)
components/site/      site chrome & composite components (Navbar, Footer,
                      AnnouncementBar, EnquiryForm, MeetingRoomsExplorer, …)
lib/                  content + data (plans, rooms, spaces, perks, events),
                      commerce config, and the availability data seam
styles/               global stylesheet + design tokens
```

## Things to fill in (search for these)

Edit [`lib/commerce.ts`](lib/commerce.ts) or set env vars (env wins):

| What | Constant / env var |
| --- | --- |
| Visitor plan checkout | `NEXT_PUBLIC_STRIPE_VISITOR_URL` |
| Resident plan checkout | `NEXT_PUBLIC_STRIPE_RESIDENT_URL` |
| Citizen plan checkout | `NEXT_PUBLIC_STRIPE_CITIZEN_URL` |
| Hybrid Office checkout | `NEXT_PUBLIC_STRIPE_HYBRID_OFFICE_URL` |
| Day Pass booking (Typeform) | `NEXT_PUBLIC_TYPEFORM_DAYPASS_URL` |
| Production domain | `NEXT_PUBLIC_SITE_URL` |
| Contact email / phone | `lib/site.ts` |

Plan CTAs fall back to the contact page until a checkout URL is set, so nothing 404s.

## Deploy (Netlify)

Connect this GitHub repo in Netlify → it reads [`netlify.toml`](netlify.toml) (build `npm run build`, publish `out/`). Set the env vars above in **Site settings → Environment**. Each push builds a deploy; pull requests get preview deploys.

## Phase 2 seams (built to slot in without rework)

- **Live room availability** — `lib/availability.ts` exposes `getWeeklyAvailability(roomSlug)`; swap its body for a live API. The `AvailabilityCalendar` component is unchanged.
- **Auth + member dashboard** — `/login` and `/signup` are stubbed entry points routing to the placeholder `/dashboard`.
- **Perks redemption** — the public `/perks` page is a teaser; redemption lives in the member app.
- **Day Pass payment** — `components/site/DayPassEmbed.tsx` isolates the Typeform; swap to Stripe Checkout later.
