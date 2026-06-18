import * as React from 'react';

export interface PlanCardProps {
  /** Plan name, e.g. "Resident". */
  name: string;
  /** Price string incl. currency, e.g. "£138". */
  price: string;
  /** Period qualifier, e.g. "ten days" or "a month". */
  period?: string;
  summary?: string;
  features?: string[];
  /** Highlight as the hero plan (ink fill, gold accents). @default false */
  featured?: boolean;
  ctaLabel?: string;
  onChoose?: () => void;
  /** Corner ribbon, e.g. "Most popular". */
  badge?: string;
  style?: React.CSSProperties;
}

/**
 * Membership plan / pricing tile. `featured` inverts to ink with gold accents.
 * @startingPoint section="Cards" subtitle="Pricing tile, standard & featured" viewport="700x460"
 */
export function PlanCard(props: PlanCardProps): JSX.Element;
