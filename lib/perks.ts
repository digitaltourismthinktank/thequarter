/** The Quarter — local perks network (public teaser). Redemption happens in the
   member app (phase 2); these are the shopfront. */

export interface Perk {
  partner: string;
  category: string;
  perk: string;
  expires: string;
}

export const PERKS: Perk[] = [
  { partner: 'The Pound Bar', category: 'Food & drink', perk: '20% off brunch, Monday to Friday', expires: 'Ends 30 Jun' },
  { partner: 'Curzon Canterbury', category: 'Culture', perk: '2-for-1 cinema tickets midweek', expires: 'Always on' },
  { partner: 'Lavazza at home', category: 'Coffee', perk: 'Members-only bean subscription discount', expires: 'Always on' },
  { partner: 'The Goods Shed', category: 'Food & drink', perk: 'A free pastry with any coffee', expires: 'Ends 14 Jul' },
  { partner: 'Canterbury Cycles', category: 'Getting here', perk: '15% off servicing & rentals', expires: 'Always on' },
  { partner: 'Marlowe Theatre', category: 'Culture', perk: 'Priority booking on selected shows', expires: 'Always on' },
];

/** Distinct categories, with 'All' first — for the public filter. */
export const PERK_CATEGORIES = ['All', ...Array.from(new Set(PERKS.map((p) => p.category)))];
