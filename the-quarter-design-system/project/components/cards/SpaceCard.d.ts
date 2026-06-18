import * as React from 'react';
import { IconName } from '../core/Icon';

export interface SpaceMeta { icon?: IconName; label: string; }

export interface SpaceCardProps {
  name: string;
  blurb: string;
  /** Small icon+label facts (capacity, features). */
  meta?: SpaceMeta[];
  /** Photo URL; falls back to an art-directed placeholder. */
  imageSrc?: string;
  /** Caption shown on the placeholder describing the intended shot. */
  imageCaption?: string;
  /** Optional corner tag (e.g. "Open social space"). */
  tag?: string;
  href?: string;
  onOpen?: () => void;
  style?: React.CSSProperties;
}

/** Showcase card for a space — photo, name, blurb, facts, Explore link. */
export function SpaceCard(props: SpaceCardProps): JSX.Element;
