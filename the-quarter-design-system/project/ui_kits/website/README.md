# Website UI kit — The Quarter

A full, interactive click-through of the public marketing site, composed entirely from the bundled design-system components.

**Open:** `index.html` (hash-routed single page).

**Screens**
- `Home.jsx` — hero, included-as-standard strip, the spaces, meeting-room teaser (revenue lever), plans, plantspiration feature, closing CTA.
- `Spaces.jsx` — the spaces overview, café feature, meeting-room list, included strip.
- `Plans.jsx` — all five plans (Day Pass → Hybrid Office), included items, teams panel, FAQ.
- `MeetingRooms.jsx` — **weekly availability + reservation**: room switcher, `AvailabilityCalendar`, sticky booking rail (package + catering), enquiry fallback.
- `Perks.jsx` — filterable partner-perk catalogue.
- `Events.jsx` — what's on (socials, workshops, talks).
- `DayPass.jsx` — Day Pass checkout with order summary + success state.
- `Login.jsx` — member login (links through to the dashboard kit).

**Shared:** `data.jsx` (all real copy — plans, spaces, rooms, perks, the week's availability) and `sections.jsx` (Section / SectionHead / Eyebrow / Photo / IncludedStrip helpers). `App.jsx` is the shell + hash router.

**Photography:** every image is an art-directed `.q-photo` placeholder with a caption describing the intended warm, real shot (cathedral view, plants, breakfast, people). Replace with real imagery — no generic office stock.
