import type { Metadata } from 'next';
import { ReceptionClient } from '@/components/site/ReceptionClient';

export const metadata: Metadata = {
  title: 'Reception — The Quarter',
  description: 'Check in at The Quarter.',
  robots: { index: false, follow: false },
};

/** Shared lobby iPad: no-login check-in for members OR guests, by name. */
export default function ReceptionPage() {
  return <ReceptionClient />;
}
