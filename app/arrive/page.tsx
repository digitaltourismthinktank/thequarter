import type { Metadata } from 'next';
import { ArriveClient } from '@/components/site/ArriveClient';

export const metadata: Metadata = {
  title: 'Check in',
  description: 'Check in to The Quarter.',
  robots: { index: false, follow: false },
};

/** The ultra-simple arrival screen: scan the entrance QR → check in → you're in. */
export default function ArrivePage() {
  return <ArriveClient />;
}
