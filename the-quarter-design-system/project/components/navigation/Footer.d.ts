import * as React from 'react';

export interface FooterColumn {
  title: string;
  links: Array<{ label: string; href?: string }>;
}

export interface FooterProps {
  logoSrc?: string;
  columns?: FooterColumn[];
  /** Copyright / legal line. */
  note?: string;
  /** Street address shown under the blurb. */
  address?: string;
  style?: React.CSSProperties;
}

/** Site-wide footer — warm dark ground, gold section labels. */
export function Footer(props: FooterProps): JSX.Element;
