/** The Quarter — navigation + footer information architecture. */

export interface NavLink {
  label: string;
  href: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'The Spaces', href: '/spaces' },
  { label: 'Plans', href: '/plans' },
  { label: 'Meeting rooms', href: '/meeting-rooms' },
  { label: 'Perks', href: '/perks' },
  { label: 'Events', href: '/events' },
  { label: 'About', href: '/about' },
];

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: 'Visit',
    links: [
      { label: 'The Spaces', href: '/spaces' },
      { label: 'Meeting rooms', href: '/meeting-rooms' },
      { label: 'The Quarter Café', href: '/spaces#cafe' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    title: 'Members',
    links: [
      { label: 'Plans & pricing', href: '/plans' },
      { label: 'Perks', href: '/perks' },
      { label: 'Member login', href: '/login' },
      { label: 'Day Pass', href: '/day-pass' },
    ],
  },
  {
    title: 'The Quarter',
    links: [
      { label: 'Our story', href: '/about' },
      { label: 'Plantspiration', href: '/about#plantspiration' },
      { label: 'Location & contact', href: '/location' },
    ],
  },
];

/** Small print links in the footer's bottom row. */
export const LEGAL_LINKS: NavLink[] = [
  { label: 'Privacy', href: '/location#contact' },
  { label: 'House rules', href: '/location#contact' },
  { label: 'Contact', href: '/location' },
];
