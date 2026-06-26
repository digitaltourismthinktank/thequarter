import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { BookingClient } from '@/components/site/BookingClient';

export const metadata: Metadata = {
  title: 'Book a room or pod',
  description: 'Book a meeting room or phone pod at The Quarter.',
  robots: { index: false, follow: false },
};

/* PHASE-3: member booking for meeting rooms + phone pods (Memberstack-gated). */
export default function BookPage() {
  return (
    <Section tone="page">
      <BookingClient />
    </Section>
  );
}
