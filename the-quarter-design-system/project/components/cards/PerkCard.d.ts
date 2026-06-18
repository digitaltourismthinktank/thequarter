import * as React from 'react';

export interface PerkCardProps {
  /** Partner / business name. */
  partner: string;
  /** The offer, e.g. "20% off brunch, Monday to Friday". */
  perk: string;
  /** Category tag, e.g. "Food & drink". */
  category?: string;
  /** Validity note, e.g. "Ends 30 Jun". */
  expires?: string;
  /** Show the redeemed (used) state. @default false */
  redeemed?: boolean;
  onRedeem?: () => void;
  /** Partner logo URL; falls back to an initial. */
  logoSrc?: string;
  style?: React.CSSProperties;
}

/** Partner perk in the member rewards catalogue — redeem / redeemed states. */
export function PerkCard(props: PerkCardProps): JSX.Element;
