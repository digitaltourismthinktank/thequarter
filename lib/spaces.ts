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
    name: 'The Open Workspace',
    tag: 'Main desks',
    blurb: 'Open desks in the light, with the hum of people finding their focus. Your day, your seat.',
    photo: PHOTOS.mainSpace,
    meta: [
      { icon: 'users', label: 'Open seating' },
      { icon: 'leaf', label: 'Plantspiration' },
    ],
    href: '/spaces#open-workspace',
  },
  {
    id: 'flexi',
    name: 'The Flexi Rooms',
    tag: 'The Bell Tower & the Scriptorium',
    blurb: 'Private slat-lined booths for a call, a catch-up or an hour of quiet. Included with every desk plan.',
    photo: PHOTOS.flexi,
    meta: [
      { icon: 'door-open', label: 'Drop-in' },
      { icon: 'users', label: '1–2 people' },
    ],
    href: '/spaces#flexi',
  },
  {
    id: 'cafe',
    name: 'The Quarter Café',
    tag: 'Open social space',
    blurb: 'The cathedral view, the natural light and the breakfast. Not bookable — just ours to share.',
    photo: PHOTOS.cafe,
    meta: [
      { icon: 'coffee', label: 'Lavazza & breakfast' },
      { icon: 'leaf', label: 'Cathedral view' },
    ],
    href: '/spaces#cafe',
  },
];

export const INCLUDED: SpaceMetaItem[] = [
  { icon: 'wifi', label: 'Fibre internet' },
  { icon: 'briefcase', label: 'Ergonomic desks' },
  { icon: 'monitor', label: 'Plug-and-play A/V' },
  { icon: 'utensils', label: 'Daily healthy breakfast' },
  { icon: 'coffee', label: 'Lavazza coffee & premium drinks' },
  { icon: 'door-open', label: 'Access to the Flexi Rooms' },
];
