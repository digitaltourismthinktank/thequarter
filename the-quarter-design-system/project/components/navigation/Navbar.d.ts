import * as React from 'react';

export interface NavLink { label: string; href: string; }

export interface NavbarProps {
  /** URL of the real wordmark PNG (pass the correct relative path per surface). */
  logoSrc?: string;
  links?: NavLink[];
  /** 'dark' = transparent over a hero image (light text); 'light' = solid cream bar. @default 'light' */
  variant?: 'light' | 'dark';
  /** href of the current page (highlights the matching link). */
  activeHref?: string;
  onNavigate?: (href: string) => void;
  ctaLabel?: string;
  onCta?: () => void;
  signInLabel?: string;
  onSignIn?: () => void;
  style?: React.CSSProperties;
}

/**
 * Marketing-site top navigation — pill links, member login + day-pass CTA.
 * @startingPoint section="Navigation" subtitle="Site header, light & dark" viewport="1200x90"
 */
export function Navbar(props: NavbarProps): JSX.Element;
