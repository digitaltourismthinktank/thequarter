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
}

const PACKAGES = 'Half & full-day packages';

export const MEETING_ROOMS: MeetingRoom[] = [
  {
    slug: 'the-board-room',
    name: 'The Board Room',
    capacity: '8–10',
    status: 'available',
    blurb: 'Hybrid-ready boardroom for the meetings that matter, with plug-and-play A/V on the wall.',
    description:
      'Our largest room, made for the meetings that matter. A long table, a wall-mounted screen and plug-and-play hybrid A/V mean you can have the room and the call in equal measure. Add catering and we’ll look after the rest.',
    photo: PHOTOS.boardroom,
    features: [
      { icon: 'monitor', label: 'Hybrid-ready A/V' },
      { icon: 'users', label: 'Seats 8–10' },
    ],
    specs: [
      { label: 'Capacity', value: '8–10 people' },
      { label: 'A/V', value: 'Hybrid-ready, plug-and-play' },
      { label: 'Display', value: 'Wall-mounted screen' },
      { label: 'Connectivity', value: 'Fibre internet' },
      { label: 'Layout', value: 'Boardroom' },
      { label: 'Catering', value: 'Lavazza, pastries & lunch on request' },
    ],
    priceNote: PACKAGES,
  },
  {
    slug: 'the-hop-yard',
    name: 'The Hop Yard',
    capacity: '6–8',
    status: 'soon',
    statusLabel: 'Free at 14:00',
    blurb: 'A high-spec meeting room with warmth and character. Made for focused, creative work.',
    description:
      'A high-spec room with warmth and character — the right size for a workshop, a pitch or a half-day of focused, creative work. Plug-and-play A/V and fibre throughout, with catering whenever you need it.',
    photo: PHOTOS.boardroom,
    features: [
      { icon: 'monitor', label: 'Plug-and-play A/V' },
      { icon: 'wifi', label: 'Fibre' },
    ],
    specs: [
      { label: 'Capacity', value: '6–8 people' },
      { label: 'A/V', value: 'Plug-and-play' },
      { label: 'Display', value: 'Screen & screen-share' },
      { label: 'Connectivity', value: 'Fibre internet' },
      { label: 'Layout', value: 'Flexible' },
      { label: 'Catering', value: 'Lavazza, pastries & lunch on request' },
    ],
    priceNote: PACKAGES,
  },
  {
    slug: 'the-chapter-house',
    name: 'The Chapter House',
    capacity: '4–6',
    status: 'busy',
    blurb: 'Our most intimate high-spec room, with the cathedral right there in the window.',
    description:
      'Our most intimate high-spec room, with the cathedral right there in the window. A round table for the conversations that need a little more closeness — interviews, one-to-ones and small, important meetings.',
    photo: PHOTOS.meetingWindow,
    features: [
      { icon: 'users', label: 'Seats 4–6' },
      { icon: 'leaf', label: 'Cathedral view' },
    ],
    specs: [
      { label: 'Capacity', value: '4–6 people' },
      { label: 'A/V', value: 'Plug-and-play' },
      { label: 'Display', value: 'Screen & screen-share' },
      { label: 'Connectivity', value: 'Fibre internet' },
      { label: 'Layout', value: 'Round table' },
      { label: 'Catering', value: 'Lavazza, pastries & lunch on request' },
    ],
    priceNote: PACKAGES,
  },
];

export const ROOM_SLUGS = MEETING_ROOMS.map((r) => r.slug);

export function getMeetingRoom(slug: string): MeetingRoom | undefined {
  return MEETING_ROOMS.find((r) => r.slug === slug);
}
