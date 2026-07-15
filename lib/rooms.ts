import { PHOTOS } from './media';
import type { IconName } from '@/components/ds/Icon';
import type { RoomStatus } from '@/components/ds/RoomCard';

/** The Quarter — bookable meeting rooms (the revenue lever). Each room carries
   the copy + specs the detail page needs. Pricing is quoted on enquiry. */

export interface RoomFeatureItem {
  icon: IconName;
  label: string;
}

export interface RoomSpec {
  label: string;
  value: string;
}

export interface MeetingRoom {
  slug: string;
  name: string;
  capacity: string;
  status: RoomStatus;
  statusLabel?: string;
  blurb: string;
  description: string;
  photo: { src: string; alt: string };
  features: RoomFeatureItem[];
  specs: RoomSpec[];
  priceNote: string;
  /** Package prices, £ inc-VAT (for the native booking + display). */
  price: { half: number; full: number };
}

/** Lunch add-on (The Sandwich Bar: baguette + cake), £ inc-VAT per head. */
export const LUNCH_ADD_ON = { label: 'Lunch (baguette & cake)', perHead: 12 };
/** 20% off room hire on quiet days — openly marketed. Lunch stays full price. */
export const QUIET_DAYS = [1, 3, 5]; // Mon, Wed, Fri (0=Sun)
export const QUIET_DAY_DISCOUNT = 0.2;

export const MEETING_ROOMS: MeetingRoom[] = [
  {
    slug: 'the-knights-tale',
    name: 'The Knight’s Tale',
    capacity: '8–10',
    status: 'available',
    blurb: 'Hybrid-ready boardroom for the meetings that matter, with plug-and-play A/V on the wall.',
    description:
      'Our largest room, made for the meetings that matter. A long table, a wall-mounted screen and plug-and-play hybrid A/V mean you can have the room and the call in equal measure. Add lunch and we’ll look after the rest.',
    photo: PHOTOS.boardroom,
    features: [
      { icon: 'monitor', label: 'Hybrid-ready A/V' },
      { icon: 'users', label: 'Seats 8–10' },
      { icon: 'coffee', label: 'Coffee, tea, filtered water, pastries & soft drinks included' },
    ],
    specs: [
      { label: 'Capacity', value: 'Up to 8–10 people' },
      { label: 'A/V', value: 'Hybrid-ready, plug-and-play' },
      { label: 'Display', value: 'Wall-mounted screen' },
      { label: 'Connectivity', value: 'Fibre internet' },
      { label: 'Layout', value: 'Boardroom' },
      { label: 'Catering', value: 'Lunch add-on on request' },
    ],
    priceNote: 'From £144 half-day · £240 full-day (inc. VAT)',
    price: { half: 144, full: 240 },
  },
  {
    slug: 'the-chapter-house',
    name: 'The Chapter House',
    capacity: '4',
    status: 'busy',
    blurb: 'Our most intimate high-spec room, with the cathedral right there in the window.',
    description:
      'Our most intimate high-spec room, with the cathedral right there in the window. A round table for the conversations that need a little more closeness — interviews, one-to-ones and small, important meetings.',
    photo: PHOTOS.meetingWindow,
    features: [
      { icon: 'users', label: 'Seats up to 4' },
      { icon: 'landmark', label: 'Cathedral view' },
      { icon: 'coffee', label: 'Coffee, tea, filtered water, pastries & soft drinks included' },
    ],
    specs: [
      { label: 'Capacity', value: 'Up to 4 people' },
      { label: 'A/V', value: 'Plug-and-play' },
      { label: 'Display', value: 'Screen & screen-share' },
      { label: 'Connectivity', value: 'Fibre internet' },
      { label: 'Layout', value: 'Round table' },
      { label: 'Catering', value: 'Lunch add-on on request' },
    ],
    priceNote: 'From £90 half-day · £150 full-day (inc. VAT)',
    price: { half: 90, full: 150 },
  },
];

export const ROOM_SLUGS = MEETING_ROOMS.map((r) => r.slug);

export function getMeetingRoom(slug: string): MeetingRoom | undefined {
  return MEETING_ROOMS.find((r) => r.slug === slug);
}
