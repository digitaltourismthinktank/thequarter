import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { JoinClient } from '@/components/site/JoinClient';

export const metadata: Metadata = {
  title: 'Join The Quarter',
  description: 'Join The Quarter — pay securely and set up your membership, all in one place.',
  robots: { index: false, follow: false },
};

/* Static export: pre-render the four subscription plans. Day Pass + carnet have their
   own one-off checkout; these are the recurring memberships. */
export function generateStaticParams() {
  return [{ plan: 'visitor' }, { plan: 'resident' }, { plan: 'citizen' }, { plan: 'hybrid-office' }];
}

export default function JoinPage({ params }: { params: { plan: string } }) {
  return (
    <Section tone="page">
      <JoinClient plan={params.plan} />
    </Section>
  );
}
