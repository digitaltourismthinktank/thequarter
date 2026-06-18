/* The Quarter — shared content for the website & app kits.
   Real copy, no placeholder text. Exposed on window for the other kit scripts. */

const LOGO_BLACK = '../../assets/logo-wordmark-black.png';

// Real photography of The Quarter (Cathedral Quarter, Canterbury).
const P = '../../assets/photos/';
const PHOTOS = {
  hero: P + 'photo-3939.jpg',          // cathedral through the window, people collaborating
  mainSpace: P + 'main-space.jpg',     // open desks, plants, people working
  mainSpaceWide: P + 'main-space-wide.jpg',
  flexi: P + 'flexi-booths.jpg',       // the Bell Tower & Scriptorium booths
  flexiAvailable: P + 'flexi-available.jpg',
  cafe: P + 'cafe.jpg',                // the Quarter Café breakfast bar
  catering: P + 'photo-3942.jpg',      // the Quarter Café catering spread
  breakfast: P + 'photo-1949.jpg',     // caprese / fresh food
  boardroom: P + 'photo-3937.jpg',     // hybrid-ready meeting room with AV
  meetingWindow: P + 'photo-3939.jpg', // round table by the cathedral window
};

const NAV_LINKS = [
  { label: 'The Spaces', href: '#/spaces' },
  { label: 'Plans', href: '#/plans' },
  { label: 'Meeting rooms', href: '#/rooms' },
  { label: 'Perks', href: '#/perks' },
  { label: 'Events', href: '#/events' },
];

const FOOTER_COLUMNS = [
  { title: 'Visit', links: [{ label: 'The Spaces' }, { label: 'Meeting rooms' }, { label: 'The Quarter Café' }, { label: 'Events' }] },
  { title: 'Members', links: [{ label: 'Plans & pricing' }, { label: 'Perks' }, { label: 'Member login' }, { label: 'Day Pass' }] },
  { title: 'The Quarter', links: [{ label: 'Our story' }, { label: 'Plantspiration' }, { label: 'Contact' }] },
];

const PLANS = [
  { name: 'Day Pass', price: '£21.60', period: 'one day', summary: 'Your way in. A single day to feel the place.', features: ['Fibre & ergonomic desks', 'Daily healthy breakfast', 'Lavazza coffee & premium drinks', 'Access to the Flexi Rooms'] },
  { name: 'Visitor', price: '£84', period: 'five days', summary: 'Five days to use across the month.', features: ['Everything in Day Pass', 'Five days, flexible', 'A change of scene when you need it'] },
  { name: 'Resident', price: '£138', period: 'ten days', summary: 'Ten days a month to call your own.', features: ['Everything in Visitor', 'Ten days a month', 'Your favourite corner, most weeks'] },
  { name: 'Citizen', price: '£258', period: 'a month', featured: true, badge: 'Most loved', summary: 'Unrestricted. For those who are mostly here.', features: ['Everything in Resident', 'Unrestricted access', 'Priority room booking', 'A proper second home'] },
  { name: 'Hybrid Office', price: '£42', period: 'a month', summary: 'A Canterbury address, plus days when you need them.', features: ['Canterbury mailing address', 'Twelve days a year', 'Use the space on your terms'] },
];

const INCLUDED = [
  { icon: 'wifi', label: 'Fibre internet' },
  { icon: 'briefcase', label: 'Ergonomic desks' },
  { icon: 'monitor', label: 'Plug-and-play A/V' },
  { icon: 'utensils', label: 'Daily healthy breakfast' },
  { icon: 'coffee', label: 'Lavazza coffee & premium drinks' },
  { icon: 'door-open', label: 'Access to the Flexi Rooms' },
];

const SPACES = [
  { name: 'The Main Space', tag: 'Open desks', blurb: 'Open desks in the light, with the hum of people finding their focus. Your day, your seat.', img: PHOTOS.mainSpace, caption: 'Main Space — open desks, plants, natural light', meta: [{ icon: 'users', label: 'Open seating' }, { icon: 'leaf', label: 'Plantspiration' }] },
  { name: 'The Flexi Rooms', tag: 'The Bell Tower & Scriptorium', blurb: 'Private slat-lined booths for a call, a catch-up or an hour of quiet. Included with every desk plan.', img: PHOTOS.flexi, caption: 'Flexi booths — the Bell Tower & the Scriptorium', meta: [{ icon: 'door-open', label: 'Drop-in' }, { icon: 'users', label: '1–2 people' }] },
  { name: 'The Quarter Café', tag: 'Open social space', blurb: 'The cathedral view, the natural light and the breakfast. Not bookable — just ours to share.', img: PHOTOS.cafe, caption: 'The Quarter Café — breakfast bar, plants', meta: [{ icon: 'coffee', label: 'Lavazza & breakfast' }, { icon: 'leaf', label: 'Cathedral view' }] },
];

const ROOMS = [
  { name: 'The Board Room', capacity: '8–10', status: 'available', blurb: 'Hybrid-ready boardroom for the meetings that matter, with plug-and-play A/V on the wall.', img: PHOTOS.boardroom, caption: 'Board Room — long table, hybrid AV, slat wall', features: [{ icon: 'monitor', label: 'Hybrid-ready A/V' }, { icon: 'users', label: 'Seats 8–10' }], priceNote: 'Half & full-day packages' },
  { name: 'The Hop Yard', capacity: '6–8', status: 'soon', statusLabel: 'Free at 14:00', blurb: 'A high-spec meeting room with warmth and character. Made for focused, creative work.', img: PHOTOS.boardroom, caption: 'The Hop Yard — bright meeting room, AV screen', features: [{ icon: 'monitor', label: 'Plug-and-play A/V' }, { icon: 'wifi', label: 'Fibre' }], priceNote: 'Half & full-day packages' },
  { name: 'The Chapter House', capacity: '4–6', status: 'busy', blurb: 'Our most intimate high-spec room, with the cathedral right there in the window.', img: PHOTOS.meetingWindow, caption: 'Chapter House — round table, cathedral view', features: [{ icon: 'users', label: 'Seats 4–6' }, { icon: 'leaf', label: 'Cathedral view' }], priceNote: 'Half & full-day packages' },
];

const PERKS = [
  { partner: 'The Pound Bar', category: 'Food & drink', perk: '20% off brunch, Monday to Friday', expires: 'Ends 30 Jun' },
  { partner: 'Curzon Canterbury', category: 'Culture', perk: '2-for-1 cinema tickets midweek', expires: 'Always on' },
  { partner: 'Lavazza at home', category: 'Coffee', perk: 'Members-only bean subscription discount', expires: 'Always on' },
  { partner: 'The Goods Shed', category: 'Food & drink', perk: 'A free pastry with any coffee', expires: 'Ends 14 Jul' },
  { partner: 'Canterbury Cycles', category: 'Getting here', perk: '15% off servicing & rentals', expires: 'Always on' },
  { partner: 'Marlowe Theatre', category: 'Culture', perk: 'Priority booking on selected shows', expires: 'Always on' },
];

const WEEK_DAYS = [
  { label: 'Mon', date: '16' }, { label: 'Tue', date: '17' }, { label: 'Wed', date: '18' },
  { label: 'Thu', date: '19' }, { label: 'Fri', date: '20' },
];
const WEEK_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const WEEK_DATA = [
  ['available', 'busy', 'available', 'soon', 'available'],
  ['busy', 'available', 'available', 'busy', 'available'],
  ['available', 'available', 'busy', 'available', 'soon'],
  ['busy', 'busy', 'available', 'available', 'available'],
  ['available', 'soon', 'available', 'busy', 'available'],
  ['available', 'available', 'busy', 'available', 'busy'],
  ['available', 'busy', 'available', 'available', 'available'],
];

Object.assign(window, {
  QData: { LOGO_BLACK, PHOTOS, NAV_LINKS, FOOTER_COLUMNS, PLANS, INCLUDED, SPACES, ROOMS, PERKS, WEEK_DAYS, WEEK_SLOTS, WEEK_DATA },
});
