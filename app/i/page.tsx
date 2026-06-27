import type { Metadata } from 'next';
import { InviteClient } from '@/components/site/InviteClient';

export const metadata: Metadata = {
  title: 'You’re invited — The Quarter',
  description: 'A friend invited you to The Quarter.',
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return <InviteClient />;
}
