import type { Metadata } from 'next';
import { MemberShell } from '@/components/site/MemberShell';
import { DashboardClient } from '@/components/site/DashboardClient';

export const metadata: Metadata = {
  title: 'Member dashboard',
  description: 'Your Quarter member dashboard.',
  robots: { index: false, follow: false },
};

/* PHASE-2 SEAM, now live: a Memberstack-gated member area. */
export default function DashboardPage() {
  return (
    <MemberShell>
      <DashboardClient />
    </MemberShell>
  );
}
