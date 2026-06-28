import type { Metadata } from 'next';
import { MemberShell } from '@/components/site/MemberShell';
import { RewardsClient } from '@/components/site/RewardsClient';

export const metadata: Metadata = {
  title: 'Quarter Rewards',
  description: 'Your Quarter Rewards — points, local rewards and how you earn.',
  robots: { index: false, follow: false },
};

export default function RewardsPage() {
  return (
    <MemberShell>
      <RewardsClient />
    </MemberShell>
  );
}
