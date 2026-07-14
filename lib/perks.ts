/** The Quarter — local perks network (public teaser). These are the crawlable SEED
   for the public /perks grid; at runtime PerksGrid swaps in the live perks from the
   Airtable backend (the same source members see), so editing a partner in the back
   end updates the public site. Keep this list roughly current as the no-JS fallback. */

export interface Perk {
  partner: string;
  category: string;
  perk: string;
  expires: string;
}

export const PERKS: Perk[] = [
  { partner: 'The Pound Bar', category: 'Food & drink', perk: '20% off brunch, Monday to Friday', expires: 'Ends 30 Jun' },
  { partner: 'Curzon Canterbury', category: 'Culture', perk: '2-for-1 cinema tickets midweek', expires: 'Always on' },
  { partner: 'The Goods Shed', category: 'Food & drink', perk: 'A free pastry with any coffee', expires: 'Ends 14 Jul' },
  { partner: 'Canterbury Cycles', category: 'Getting here', perk: '15% off servicing & rentals', expires: 'Always on' },
  { partner: 'Marlowe Theatre', category: 'Culture', perk: 'Priority booking on selected shows', expires: 'Always on' },
];

/** Distinct categories, with 'All' first — for the public filter. */
export const PERK_CATEGORIES = ['All', ...Array.from(new Set(PERKS.map((p) => p.category)))];
