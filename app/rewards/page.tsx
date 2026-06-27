import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { RewardsClient } from '@/components/site/RewardsClient';

export const metadata: Metadata = {
  title: 'Quarter Rewards',
  description: 'Your Quarter Rewards — points, local rewards and how you earn.',
  robots: { index: false, follow: false },
};

export default function RewardsPage() {
  return (
    <Section tone="page">
      <RewardsClient />
    </Section>
  );
}
