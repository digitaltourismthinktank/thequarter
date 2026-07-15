import { PHOTOS } from './media';
import type { IconName } from '@/components/ds/Icon';

/** The Quarter — the spaces, and what every desk plan includes. */

export interface SpaceMetaItem {
  icon: IconName;
  label: string;
}

export interface SpaceItem {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  photo: { src: string; alt: string };
  meta: SpaceMetaItem[];
  href: string;
}

export const SPACES: SpaceItem[] = [
  {
    id: 'open-workspace',
    name: 'The Open Workspaces',
    tag: 'Main desks',
    blurb: 'Open desks across three bright, plant-filled rooms — the hum of people finding their focus. Your day, your seat.',
    photo: PHOTOS.mainSpace,
    meta: [
      { icon: 'users', label: 'Open seating' },
      { icon: 'leaf', label: 'Plantspiration' },
    ],
    href: '/spaces#open-workspace',
  },
  {
    id: 'flexi',
    name: 'The Phone Pods',
    tag: 'The Bell Tower & the Scriptorium',
    blurb: 'Private slat-lined booths for a call, a catch-up or an hour of quiet. Included with every desk plan — or book one on its own for a single meeting.',
    photo: PHOTOS.flexi,
    meta: [
      { icon: 'door-open', label: 'Drop-in' },
      { icon: 'users', label: '1–2 people' },
    ],
    href: '/spaces#flexi',
  },
  {
    id: 'cafe',
    name: 'The Kentish Pantry',
    tag: 'Open social space',
    blurb: 'The cathedral view, the natural light and the breakfast. Not bookable — just ours to share.',
    photo: PHOTOS.breakfast,
    meta: [
      { icon: 'coffee', label: 'Coffee & breakfast' },
      { icon: 'landmark', label: 'Cathedral view' },
    ],
    href: '/spaces#cafe',
  },
];

export const INCLUDED: SpaceMetaItem[] = [
  { icon: 'wifi', label: 'Fibre internet' },
  { icon: 'monitor', label: 'A monitor at every desk' },
  { icon: 'coffee', label: 'Bean-to-cup coffee & teas' },
  { icon: 'utensils', label: 'Breakfast, yoghurts & cereals' },
  { icon: 'cake', label: 'Pastries & cakes, on us' },
  { icon: 'door-open', label: 'Phone pods for calls' },
  { icon: 'heart', label: 'Dog friendly' },
];
