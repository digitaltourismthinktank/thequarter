import type { Metadata } from 'next';
import { AuthScreen } from '@/components/site/AuthScreen';
import { Icon } from '@/components/ds/Icon';

export const metadata: Metadata = {
  title: 'Join your team at The Quarter',
  description: 'Your company has a space at The Quarter — create your account and we’ll set up your plan.',
  alternates: { canonical: '/enrol' },
};

/* Dedicated team-enrolment page. Creates a plan-less Memberstack account exactly like
   /signup (no plan, no payment) — admin assigns the plan afterwards from the members
   pane. Captures the company so staff can group a team together. Lands on /dashboard. */
export default function EnrolPage() {
  return (
    <AuthScreen
      mode="signup"
      badge="Team enrolment"
      heading="Join your team at The Quarter"
      subtitle="Your company has a space at The Quarter — create your account and we’ll set up your plan. There’s nothing to pay now."
      collectCompany
      intro={
        <ul>
          <li>
            <Icon name="check" size={16} color="var(--gold-700)" style={{ marginTop: 2 }} />
            <span>No plan to choose and no payment today — we’ll set your plan up for you.</span>
          </li>
          <li>
            <Icon name="check" size={16} color="var(--gold-700)" style={{ marginTop: 2 }} />
            <span>Add your company so we can keep your team together.</span>
          </li>
          <li>
            <Icon name="check" size={16} color="var(--gold-700)" style={{ marginTop: 2 }} />
            <span>You’ll land straight on your dashboard, ready for us to activate your access.</span>
          </li>
        </ul>
      }
    />
  );
}
