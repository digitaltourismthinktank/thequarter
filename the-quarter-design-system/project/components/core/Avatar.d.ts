import * as React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — initials are derived when no image is given. */
  name?: string;
  /** Optional photo URL. */
  src?: string;
  /** @default 'md' */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/** Member avatar — photo or gold initials in a soft circle. */
export function Avatar(props: AvatarProps): JSX.Element;
