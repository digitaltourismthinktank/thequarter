import * as React from 'react';

export type IconName =
  | 'arrow-right' | 'arrow-up-right' | 'arrow-left' | 'check' | 'plus' | 'minus' | 'x'
  | 'chevron-down' | 'chevron-right' | 'calendar' | 'clock' | 'users' | 'user' | 'wifi'
  | 'coffee' | 'leaf' | 'monitor' | 'map-pin' | 'star' | 'gift' | 'credit-card' | 'menu'
  | 'search' | 'bell' | 'settings' | 'sparkles' | 'door-open' | 'briefcase' | 'log-out'
  | 'utensils' | 'phone';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon name from the curated Lucide-style set. */
  name: IconName;
  /** Pixel size (width & height). @default 20 */
  size?: number;
  /** Stroke width. @default 1.75 */
  strokeWidth?: number;
  /** Stroke colour. @default currentColor */
  color?: string;
}

/** Line icon in The Quarter's calm, 1.75-stroke style. */
export function Icon(props: IconProps): JSX.Element;
