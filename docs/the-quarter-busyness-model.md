# The Quarter — Busyness Model & Calendar Reference

A build reference for the "how busy is it likely to be" screen. It turns any date into a **busyness band**, a **room availability picture**, and **brand-appropriate copy** for each. Drive the screen from this.

Based on 14 months of booking data (Jan 2025 to Feb 2026): 379 bookings, 1,007 person-days, 102 unique visitors.

> **Read this first.** Desks effectively never sell out. Even the busiest days reach about 8 to 9 people against 16 to 17 desks (around 29% at peak). So the screen communicates *atmosphere and company*, not "is there room." There is almost always a desk free. The only real scarcity is whole rooms, which do get reserved. See section 5.

---

## 1. The model in one line

```
expected people = dayBase[weekday] × monthFactor[month] × growthFactor
```

Then map the result to a band:

| Band | Expected people | Feel |
|---|---|---|
| Quiet | under 2.5 | Calm, spacious, deep focus |
| Steady | 2.5 to 3.7 | A comfortable hum |
| Busy | 3.7 to 5.0 | Lively and sociable |
| Buzzing | 5.0 and up | Fullest and most social |

`growthFactor` defaults to **1.0**. Numbers are trending up (January was +44% year on year, average group size has risen from 2.7 to 3.4), so treat the headcounts as a floor and raise the factor as live numbers climb. Better still, blend in real bookings once the new system captures them (section 9).

---

## 2. Day of week

The base pattern, from total recorded attendance per weekday. Tuesday and Thursday lead, partly because the corporate team is in (and meeting rooms cluster there). Friday is the calmest weekday.

| Day | Typical people | Band (baseline month) | What drives it |
|---|---|---|---|
| Monday | ~3.4 | Steady | Settled start to the week |
| Tuesday | ~4.8 | Busy / Buzzing | Corporate team in + meeting room demand |
| Wednesday | ~3.3 | Steady | Consistent mid-week |
| Thursday | ~4.1 | Busy | Corporate team in + meeting room demand |
| Friday | ~2.7 | Steady / Quiet | The quiet focus day. Summer Fridays are the calmest of all |
| Saturday / Sunday | 0 | Closed | Not currently offered (section 6) |

`dayBase`: Mon 3.4, Tue 4.8, Wed 3.3, Thu 4.1, Fri 2.7.

---

## 3. Month and season

The Quarter has a clear annual rhythm. Late autumn through January is the liveliest stretch (January 2026 was the strongest month on record). April, May, July and August are the quiet months, the "summer slump."

| Month | Factor | Character |
|---|---|---|
| January | 1.25 | Peak. Strongest of the year. New Year, escape-from-home effect |
| February | 1.10 | Still strong, post-peak |
| March | 1.00 | Healthy, settling toward average |
| April | 0.75 | Slump begins |
| May | 0.68 | Quietest month on record |
| June | 0.88 | Transitional, picking up |
| July | 0.75 | Summer slump |
| August | 0.80 | Summer slump |
| September | 1.00 | Recovery underway |
| October | 1.15 | Building toward peak |
| November | 1.20 | Peak |
| December | 1.15 | Busy on the days open, then winds down (section 6) |

---

## 4. The full grid (every weekday, every month)

The practical answer to "what does each day of the year look like." Cells are the resulting band. Use this directly, or compute live from the formula.

| Day | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Mon** | Busy | Busy | Steady | Steady | Quiet | Steady | Steady | Steady | Steady | Busy | Busy | Busy |
| **Tue** | Buzzing | Buzzing | Busy | Steady | Steady | Busy | Steady | Busy | Busy | Buzzing | Buzzing | Buzzing |
| **Wed** | Busy | Steady | Steady | Quiet | Quiet | Steady | Quiet | Steady | Steady | Busy | Busy | Busy |
| **Thu** | Buzzing | Busy | Busy | Steady | Steady | Steady | Steady | Steady | Busy | Busy | Busy | Busy |
| **Fri** | Steady | Steady | Steady | Quiet | Quiet | Quiet | Quiet | Quiet | Steady | Steady | Steady | Steady |

The story in one glance: Tuesdays buzz almost all year, easing only in deep summer. Fridays sit Quiet to Steady and are the natural focus day. The quiet zone is April, May and July. The lively zone is November to February.

---

## 5. Rooms and "usually booked"

This is where real availability matters. Show whole-room status separately from the overall busyness band.

| Space | Capacity | Typical status | How to show it |
|---|---|---|---|
| **Main Space (Room A)** | 7 desks | **Reserved every Tue and Thu** (corporate team, privatised) | Tue/Thu: "Usually reserved." Mon/Wed/Fri: open. This is the clearest "usually booked" flag |
| **Flexi Room area (Room B)** | 6 desks | Open to members; booths reservable for calls | "Open." Individual booths may be in use |
| **Downstairs desks** | 3 to 4 | Open | "Open" |
| **The Board Room** | 8 to 10 | Bookable, variable | "Usually available." More likely booked Tue/Thu |
| **The Hop Yard** | High-spec meeting room | Bookable, highest margin | "Usually available, book ahead." Fills first on Tue/Thu |
| **The Chapter House** | High-spec meeting room | Bookable, highest margin | As The Hop Yard |
| **The Quarter Café** | Up to 10 | Never bookable, always open | The social heart. Don't show as a bookable resource |
| **Phone booths (×2)** | 2 | First come, untracked | "Usually free" |

**Meeting room booking likelihood (chance any room is booked, by day):** Mon ~18%, Tue ~47%, Wed ~18%, Thu ~53%, Fri ~11%. Across three bookable rooms that means *a* room is often in use on Tue/Thu, but any single room is usually still free. Suggested screen line: **"Meeting rooms: usually available. Tuesdays and Thursdays fill first, so book ahead."**

---

## 6. Overrides (apply on top of the model)

These take priority over the grid.

- **Weekends.** Closed. Show: "Closed today. We're a weekday space, for now." (A known strategic gap, not a permanent rule.)
- **Bank holidays (England & Wales).** Closed. Don't hardcode the dates: pull the gov.uk feed at `https://www.gov.uk/bank-holidays.json` (the `england-and-wales` division) and treat those days as Closed. It updates itself each year.
- **Christmas and New Year.** Reduced. Late December into the first day or two of January runs on far fewer open days. Treat roughly 24 Dec to 1 Jan as Closed or reduced, and confirm the actual opening days each year.
- **First full working week of January.** Surge. The strongest week of the year. Apply an uplift on top of the January factor.
- **Monthly social (last Thursday or Friday).** Busier from late afternoon. Flag the *evening* as socially busy even when the daytime band is lower. This matters most on Fridays, which otherwise read Quiet.
- **Event days (Summer Fridays, business briefings, open doors).** A programmed event lifts that day, typically a quiet Friday, toward Steady or Busy. Drive this from the events calendar, not the base model, and let it override the band for that date.

---

## 7. Week-level wrinkles

Smaller effects worth handling once the basics are in:

- **Week of a Monday bank holiday.** Monday is closed; Tuesday to Friday can run slightly quieter as people extend the break. Nudge down a little.
- **The Christmas fortnight.** Heavily reduced. Treat as closed or quiet throughout.
- **University terms and holidays.** At most a soft effect. Members are mostly professionals and freelancers, so term dates barely move desk numbers in the data. Only worth surfacing if student co-working offers are actually running.
- **Start or end of month.** No meaningful signal. Don't model it.

---

## 8. Copy and brand rules for the screen

Band labels and one-liners. Warm, second person, never negative.

| Band | Label | Suggested line |
|---|---|---|
| Quiet | Quiet | "A calm one. Perfect if you're here to find your focus." |
| Steady | Steady | "A comfortable hum. Company when you want it, quiet when you don't." |
| Busy | Busy | "Lively and sociable. A good day for familiar faces." |
| Buzzing | Buzzing | "Our liveliest. Come for the company (and the coffee)." |

Rules:

- **Never say "full," "no space," or "fully booked" for desks.** There's almost always a desk. Scarcity language only applies to whole rooms.
- **Never make Quiet sound dead or empty.** Quiet is a feature: focus, calm, room to think. Lean on "find your focus."
- **Buzzing is a draw, not a warning.** Lean on "love who you meet."
- **Colour.** Black, white and gold only, no green. Do **not** use a traffic-light red/amber/green scale: it clashes with the palette and wrongly frames quiet as "bad." Use a tonal scale instead, for example off-white/grey for Quiet through to deep gold or black for Buzzing.
- Keep the voice on brand: warm, understated, the odd parenthetical aside.

---

## 9. Data confidence and recalibration

- Built on 14 months and 102 unique visitors. Strong for the *shape* (which days and months are busier), lighter for precise daily counts.
- Numbers are climbing. Treat the headcounts as a floor. Raise `growthFactor`, or recalibrate `dayBase` from the trailing 6 to 12 months, as the new system gathers data.
- Saturday saw a single booking in the whole period, so weekends are treated as closed.
- **Recommended next step once live:** shift the screen from purely *predicted* to *predicted, then adjusted by today's actual bookings* (room reservations especially). The model is the fallback; real occupancy beats it whenever you have it.

---

## 10. Machine-readable config

Drop-in for the build. Tune values here rather than in component code.

```json
{
  "model": {
    "formula": "expected = dayBase[weekday] * monthFactor[month] * growthFactor",
    "growthFactor": 1.0,
    "bands": [
      { "id": "quiet",   "min": 0.0, "max": 2.5,  "label": "Quiet",   "line": "A calm one. Perfect if you're here to find your focus." },
      { "id": "steady",  "min": 2.5, "max": 3.7,  "label": "Steady",  "line": "A comfortable hum. Company when you want it, quiet when you don't." },
      { "id": "busy",    "min": 3.7, "max": 5.0,  "label": "Busy",    "line": "Lively and sociable. A good day for familiar faces." },
      { "id": "buzzing", "min": 5.0, "max": 99.0, "label": "Buzzing", "line": "Our liveliest. Come for the company (and the coffee)." }
    ]
  },
  "dayBase": { "mon": 3.4, "tue": 4.8, "wed": 3.3, "thu": 4.1, "fri": 2.7, "sat": 0, "sun": 0 },
  "monthFactor": {
    "jan": 1.25, "feb": 1.10, "mar": 1.00, "apr": 0.75, "may": 0.68, "jun": 0.88,
    "jul": 0.75, "aug": 0.80, "sep": 1.00, "oct": 1.15, "nov": 1.20, "dec": 1.15
  },
  "rooms": {
    "mainSpaceRoomA": { "name": "Main Space (Room A)", "desks": 7, "privatised": ["tue", "thu"], "status": "Usually reserved Tue and Thu (corporate team)" },
    "flexiRoomB":     { "name": "Flexi Room area (Room B)", "desks": 6, "bookable": false, "status": "Open; booths reservable for calls" },
    "downstairsDesks":{ "name": "Downstairs desks", "desks": 4, "bookable": false, "status": "Open" },
    "boardRoom":      { "name": "The Board Room", "capacity": 10, "bookable": true, "status": "Usually available; more likely booked Tue/Thu" },
    "hopYard":        { "name": "The Hop Yard", "bookable": true, "status": "Usually available, book ahead" },
    "chapterHouse":   { "name": "The Chapter House", "bookable": true, "status": "Usually available, book ahead" },
    "cafe":           { "name": "The Quarter Café", "bookable": false, "status": "Always open, never bookable" },
    "phoneBooths":    { "name": "Phone booths", "count": 2, "bookable": false, "status": "Usually free" }
  },
  "meetingRoomBookedChance": { "mon": 0.18, "tue": 0.47, "wed": 0.18, "thu": 0.53, "fri": 0.11 },
  "overrides": {
    "closedWeekends": true,
    "bankHolidaysFeed": "https://www.gov.uk/bank-holidays.json",
    "bankHolidaysDivision": "england-and-wales",
    "christmasReducedFrom": "12-24",
    "christmasReducedTo": "01-01",
    "januaryFirstWeekUplift": 1.15,
    "mondayBankHolidayWeekFactor": 0.9,
    "eventCalendarOverridesBand": true
  },
  "brand": {
    "palette": ["#1A1A1A", "#FFFFFF", "#D4A843", "#F5F3EF"],
    "noGreen": true,
    "noTrafficLightScale": true,
    "neverSayForDesks": ["full", "no space", "fully booked"]
  }
}
```
