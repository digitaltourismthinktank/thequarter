import type { Metadata } from 'next';
import { MemberShell } from '@/components/site/MemberShell';
import { PlanClient } from '@/components/site/PlanClient';

export const metadata: Metadata = {
  title: 'Plan & billing',
  description: 'View your plan and switch between monthly and annual billing.',
  robots: { index: false, follow: false },
};

export default function PlanPage() {
  return (
    <MemberShell>
      <PlanClient />
    </MemberShell>
  );
}
