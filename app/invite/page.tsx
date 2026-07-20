import type { Metadata } from 'next';
import { EventInviteClient } from '@/components/site/EventInviteClient';

export const metadata: Metadata = {
  title: "You're invited · The Quarter",
  description: 'A member of The Quarter has invited you to join them.',
  // Not for search engines: the page is meaningless without a token, and an event guest
  // list is not something to index.
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return <EventInviteClient />;
}
