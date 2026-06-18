---
name: thequarter-design
description: Use this skill to generate well-branded interfaces and assets for The Quarter — the boutique coworking space in Canterbury's Cathedral Quarter — for production or throwaway prototypes/mocks. Contains essential design guidelines, colours, type, fonts, logos, and a UI kit component library for prototyping the marketing website, member dashboard, in-office display and member app.
user-invocable: true
---

Read the `readme.md` file within this skill first — it holds the brand context, content fundamentals (voice, British English, casing, phrases we own), visual foundations (warm black/white/gold palette + sand & stone neutrals, DM Sans type, soft rounded corners, espresso-tinted shadows), and the iconography approach. Then explore the other files.

**Key rules to honour every time:**
- Keep the logo exactly as provided (`assets/`). Never redraw the wordmark.
- **Warmth wins over slickness** in any conflict. Hospitality-grade, not tech-startup.
- **No green as a UI or brand colour** — greenery lives only in photography.
- British English throughout. No emoji. Never advertise free trial days (the public entry point is the Day Pass). Never reference Canterbury BID.
- Use real, warm photography (cathedral view, plants, breakfast, people) — no generic office stock. This system uses art-directed `.q-photo` placeholders with captions; replace them with real imagery.

**What's here:**
- `styles.css` + `tokens/` — link `styles.css` for all colour/type/spacing/elevation tokens and the DM Sans webfont.
- `components/` — the React component library (Button, IconButton, Badge, Avatar, Icon, Input, Select, Checkbox, Switch, Navbar, Footer, SpaceCard, PlanCard, RoomCard, PerkCard, StatTile, QuarterCard, AvailabilityCalendar, EmptyState). Each has a `.d.ts` (props) and `.prompt.md` (usage).
- `ui_kits/` — full interactive recreations: `website/`, `dashboard/`, `display/`, `app/`.
- `guidelines/` — foundation specimen cards.

If creating visual artefacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask a few focused questions, then act as an expert designer who outputs HTML artefacts _or_ production code, depending on the need.

**Sources:** built from The Quarter brief and the (empty) design repo `digitaltourismthinktank/thequarter-design`. Icons are Lucide-style line icons.
