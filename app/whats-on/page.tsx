import type { Metadata } from 'next';
import { EventsClient } from '@/components/site/EventsClient';

export const metadata: Metadata = {
  title: 'Events',
  description: 'What’s on at The Quarter.',
  robots: { index: false, follow: false },
};

/** The member Events tab — its own route so there's no marketing-page flash. */
export default function WhatsOnPage() {
  return <EventsClient />;
}
