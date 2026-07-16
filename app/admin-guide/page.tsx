import type { Metadata } from 'next';
import { MemberShell } from '@/components/site/MemberShell';
import { AdminGuide } from '@/components/site/AdminGuide';

export const metadata: Metadata = {
  title: 'How Rewards & Partners work',
  description: 'The Quarter — staff guide to perks, rewards, points and partner payouts.',
  robots: { index: false, follow: false },
};

/* Staff guide — how the rewards, perks & partner economy works. Admin-gated exactly
 * like /admin (client-side isAdmin check inside AdminGuide, mirroring AdminClient). */
export default function AdminGuidePage() {
  return (
    <MemberShell wide>
      <AdminGuide />
    </MemberShell>
  );
}
