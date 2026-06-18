import * as React from 'react';

export interface QuarterCardProps {
  /** Member's full name. */
  memberName: string;
  /** Plan tier shown as a gold outline pill. @default 'Citizen' */
  plan?: string;
  /** Short card number. @default '0042' */
  cardId?: string;
  /** @default 'Member since 2025' */
  sinceLabel?: string;
  /** Wordmark PNG (rendered white via invert). */
  logoSrc?: string;
  /** Show the QR motif. @default true */
  qr?: boolean;
  onAddToWallet?: () => void;
  style?: React.CSSProperties;
}

/**
 * The digital "Quarter Card" — Apple-Wallet-style membership card.
 * Ink ground, gold detail, credit-card aspect ratio. Dashboard hero.
 * @startingPoint section="Dashboard" subtitle="The digital Quarter Card" viewport="700x300"
 */
export function QuarterCard(props: QuarterCardProps): JSX.Element;
