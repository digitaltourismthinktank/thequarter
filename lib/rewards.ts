/**
 * The Quarter — Quarter Rewards economy (single source of truth).
 *
 * Per CODE_BRIEF §4: the dominant earn is a fixed % of *actual payment*, so total
 * give-back is structurally capped at ~2–3% of revenue. Every value here is tunable
 * without touching components — the "How you earn" card and the earn engine both read
 * from this file. These are the brief's confirmed-as-defaults; dial before launch.
 *
 * NOTE (brief overrides prototype): the design prototype showed an older earn list
 * (+100/+50, room-booking +80, monthly loyalty +200, flat annual +600). The brief
 * deliberately removes points-for-nothing and the room-booking bonus (members book
 * rooms free), so the values below are the brief's, rendered into the design's layout.
 */
import type { IconName } from '@/components/ds/Icon';
import type { PlanId } from './plans';

// --- Anchor + earn rules (the economy dial — confirm before launch) -------------

/** Redemption anchor: 100 points = £1 of reward value. */
export const POINTS_PER_POUND_VALUE = 100;

/** 2% give-back, applied to every real PAID transaction (membership, day pass,
 *  carnet, external/company room hire + lunch add-ons). Member room bookings are
 *  free (fair use) → they earn NO spend points. */
export const POINTS_PER_GBP = 2;

export const CHECKIN_BONUS = 15; // per check-in, any plan
export const CHECKIN_QUIET_BONUS = 30; // per check-in on a busyness 'quiet' day
export const CHECKIN_BONUS_CAP = 12; // counted check-ins per calendar month
export const REFERRAL_BONUS = 500; // one-off, when the referred friend starts a paid plan/carnet
export const WELCOME_BONUS = 150; // one-off, on first paid plan/carnet

/** Points for a real GBP payment (rounded). The canonical spend-earn. */
export const pointsForGBP = (gbp: number) => Math.round(POINTS_PER_GBP * Math.max(0, gbp));
/** £ reward value of a points balance. */
export const poundsValue = (points: number) => Math.max(0, points) / POINTS_PER_POUND_VALUE;

// --- "How you earn" rows (rendered straight from the values above) --------------

export interface EarnRule {
  icon: IconName;
  title: string;
  note: string;
  /** Display string for the right-aligned value, e.g. "+30" or "2 per £1". */
  value: string;
  /** The lead row is emphasised (gold wash) on the Rewards page. */
  lead?: boolean;
}

export const EARN_RULES: EarnRule[] = [
  {
    icon: 'sparkles',
    title: 'Check in on a quiet day',
    note: 'Our gentle nudge to spread the week out — worth double.',
    value: `+${CHECKIN_QUIET_BONUS}`,
    lead: true,
  },
  { icon: 'door-open', title: 'Check in any day', note: 'Just for being here.', value: `+${CHECKIN_BONUS}` },
  {
    icon: 'pound-sterling',
    title: 'Spend at The Quarter',
    note: 'Plans, day passes, the carnet, room hire and lunches.',
    value: `${POINTS_PER_GBP} per £1`,
  },
  { icon: 'users', title: 'Refer a friend', note: 'When they start their first paid plan.', value: `+${REFERRAL_BONUS}` },
  {
    icon: 'star',
    title: 'Join annually',
    note: `Earn ${POINTS_PER_GBP} points per £1 on the year, up front — a big boost.`,
    value: 'Big boost',
  },
  { icon: 'gift', title: 'Welcome bonus', note: 'A warm hello on your first paid plan.', value: `+${WELCOME_BONUS}` },
];

// --- Rewards catalogue ----------------------------------------------------------

/**
 * Funding source for a reward. Drives the float logic (CODE_BRIEF §8):
 *  - 'inventory'  — Quarter stock/merch/guest pass; no float to draw down.
 *  - 'partner'    — partner-funded; draws the partner's prepaid float.
 *  - 'quarter'    — Quarter-funded float at a partner (we pre-pay).
 * Admin-only — never shown to members.
 */
export type FundingType = 'inventory' | 'partner' | 'quarter';

export interface RewardSeed {
  id: string;
  partner: string;
  title: string;
  cost: number; // points
  funding: FundingType;
  category: string;
  icon: IconName;
  /** How staff apply it at the till (shown on the verification page). */
  pos: string;
  /** Hero reward (the standout). Confirm with Riva — Corkk is the reliable pick. */
  hero?: boolean;
}

/**
 * Seed catalogue (CODE_BRIEF §4). Costs are illustrative — real costs are set in
 * admin (Airtable). The Cathedral Pass is modelled as a low-cost £6-cover reward,
 * NOT a hero; the hero is an evening at Corkk (the Ivy is dropped as unreliable —
 * confirm the final hero with Riva). Seeds the Airtable Rewards table on first run.
 */
export const CATALOGUE_SEED: RewardSeed[] = [
  { id: 'treat', partner: 'A.T. Patisserie', title: 'A treat on us', cost: 300, funding: 'partner', category: 'Bakery & treats', icon: 'cake', pos: 'Give the member one patisserie item of their choice; we settle it.' },
  { id: 'coffee', partner: 'Burgate Coffee', title: 'A coffee, our treat', cost: 350, funding: 'quarter', category: 'Coffee & café', icon: 'coffee', pos: 'One coffee of their choice on The Quarter.' },
  { id: 'refillery', partner: 'The Refillery', title: 'A refillery item', cost: 500, funding: 'partner', category: 'Shopping & lifestyle', icon: 'shopping-bag', pos: 'One standard refill item; we settle it.' },
  { id: 'tote', partner: 'The Quarter', title: 'Quarter tote or notebook', cost: 500, funding: 'inventory', category: 'Shopping & lifestyle', icon: 'gift', pos: 'Hand over one Quarter tote or notebook from stock.' },
  { id: 'cathedral', partner: 'Canterbury Cathedral', title: 'Cathedral Pass covered', cost: 650, funding: 'quarter', category: 'Culture & heritage', icon: 'landmark', pos: 'We reimburse the £6 five-year Pass for an eligible member who applies directly to the Cathedral.' },
  { id: 'corkk-glass', partner: 'Corkk', title: 'A glass at Corkk', cost: 700, funding: 'quarter', category: 'Drinks & wine', icon: 'wine', pos: 'One glass from the by-the-glass list; we settle it.' },
  { id: 'guest-pass', partner: 'The Quarter', title: 'A guest day pass', cost: 1400, funding: 'inventory', category: 'Workspace', icon: 'ticket', pos: 'Issue one guest day pass for a friend.' },
  { id: 'corkk-two', partner: 'Corkk', title: 'Two glasses at Corkk', cost: 1400, funding: 'quarter', category: 'Drinks & wine', icon: 'wine', pos: 'Two glasses from the by-the-glass list; we settle it.' },
  { id: 'corkk-evening', partner: 'Corkk', title: 'An evening at Corkk', cost: 2000, funding: 'partner', category: 'Drinks & wine', icon: 'sparkles', pos: 'A wine flight for the member next door; we settle it.', hero: true },
];

// --- Annual prepay (Pass A·6) — provisional, confirm with Riva ------------------

export interface AnnualOption {
  monthly: number; // £/month (incl. VAT)
  annual: number; // £/year prepaid (incl. VAT)
}

/** Plans that offer an annual term. Indicative figures from the design (≈2 months
 *  free); wire the real Annual Stripe prices before this goes live. */
export const ANNUAL_PLANS: Partial<Record<PlanId, AnnualOption>> = {
  citizen: { monthly: 258, annual: 2580 },
  resident: { monthly: 138, annual: 1380 },
  visitor: { monthly: 84, annual: 840 },
};

/** Annual saving vs paying monthly for a year. */
export const annualSaving = (o: AnnualOption) => Math.max(0, o.monthly * 12 - o.annual);

// --- Day-pass carnet (Pass B) — provisional, confirm with Riva ------------------

/** Single day pass (incl. VAT). The carnet must stay dearer per day than the plans. */
export const DAY_PASS_PRICE = 21.6;

export interface CarnetBundle {
  passes: number;
  price: number; // £ incl. VAT
  bestValue?: boolean;
}

/** Two bundles only (CODE_BRIEF §5): 10 (10% off) and 30 (15% off). */
export const CARNET_BUNDLES: CarnetBundle[] = [
  { passes: 10, price: 194.4, bestValue: true },
  { passes: 30, price: 550.8 },
];

export const carnetPerPass = (b: CarnetBundle) => b.price / b.passes;
