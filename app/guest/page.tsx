import type { Metadata } from 'next';
import { GuestClient } from '@/components/site/GuestClient';

export const metadata: Metadata = {
  title: 'Guest sign-in — The Quarter',
  description: 'Sign in as a guest at The Quarter.',
  robots: { index: false, follow: false },
};

/** Lobby kiosk surface — guest sign-in + fire-safety roll-call. */
export default function GuestPage() {
  return <GuestClient />;
}
