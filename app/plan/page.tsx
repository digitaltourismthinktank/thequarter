import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { PlanClient } from '@/components/site/PlanClient';

export const metadata: Metadata = {
  title: 'Plan & billing',
  description: 'View your plan and switch between monthly and annual billing.',
  robots: { index: false, follow: false },
};

export default function PlanPage() {
  return (
    <Section tone="page">
      <PlanClient />
    </Section>
  );
}
