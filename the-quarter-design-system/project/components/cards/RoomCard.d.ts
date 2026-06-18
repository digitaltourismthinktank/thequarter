import * as React from 'react';
import { IconName } from '../core/Icon';

export interface RoomFeature { icon?: IconName; label: string; }

export interface RoomCardProps {
  name: string;
  blurb?: string;
  /** Capacity label, e.g. "8–10". */
  capacity?: string;
  /** Feature chips (strings or {icon,label}). */
  features?: Array<string | RoomFeature>;
  /** Live status colour. @default 'available' */
  status?: 'available' | 'busy' | 'soon';
  /** Override the status text. */
  statusLabel?: string;
  /** @default 'Quoted on enquiry' */
  priceNote?: string;
  imageSrc?: string;
  imageCaption?: string;
  ctaLabel?: string;
  onReserve?: () => void;
  /** 'vertical' (grid) or 'horizontal' (list row). @default 'vertical' */
  layout?: 'vertical' | 'horizontal';
  style?: React.CSSProperties;
}

/** Meeting / flexi room card with live status pill, capacity and reserve CTA. */
export function RoomCard(props: RoomCardProps): JSX.Element;
