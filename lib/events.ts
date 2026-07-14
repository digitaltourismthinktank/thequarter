/** The Quarter — what's on. Member socials, business briefings and charity
   Friday access. (We never advertise free trial days — the public way in is the
   Day Pass.) */

export type EventKind = 'Community' | 'Briefing' | 'Charity' | 'Workshop' | 'Talk' | 'Social';

export interface QuarterEvent {
  date: string; // e.g. '19 Jun'
  day: string; // e.g. 'Fri'
  title: string;
  time: string;
  kind: EventKind;
  blurb: string;
}

export const EVENTS: QuarterEvent[] = [
  {
    date: '19 Jun',
    day: 'Fri',
    title: 'Friday breakfast social',
    time: '08:30 – 10:00',
    kind: 'Community',
    blurb: 'Start the weekend early. Pastries, coffee and good company in the café.',
  },
  {
    date: '24 Jun',
    day: 'Wed',
    title: 'Business briefing: getting found locally',
    time: '12:30 – 13:30',
    kind: 'Briefing',
    blurb: 'A short, practical session for members growing a business in and around Canterbury. Lunch on us.',
  },
  {
    date: '26 Jun',
    day: 'Fri',
    title: 'Charity Friday',
    time: '09:00 – 17:00',
    kind: 'Charity',
    blurb: 'On the last Friday of the month we welcome friends of members for a suggested donation to a Canterbury charity.',
  },
  {
    date: '02 Jul',
    day: 'Thu',
    title: 'Plantspiration: repotting workshop',
    time: '17:30 – 19:00',
    kind: 'Workshop',
    blurb: 'Bring a tired plant or take one home. A hands-in-the-soil hour with our resident grower.',
  },
  {
    date: '10 Jul',
    day: 'Fri',
    title: 'Summer rooftop drinks',
    time: '18:00 – late',
    kind: 'Social',
    blurb: 'The cathedral, golden hour and a glass of something. Our favourite evening of the month.',
  },
];
