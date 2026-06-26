import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { AdminClient } from '@/components/site/AdminClient';

export const metadata: Metadata = {
  title: 'Admin',
  description: 'The Quarter — staff admin.',
  robots: { index: false, follow: false },
};

/* PHASE-3: staff admin (gated to @thinkdigital.travel, enforced server-side too). */
export default function AdminPage() {
  return (
    <Section tone="page">
      <AdminClient />
    </Section>
  );
}
