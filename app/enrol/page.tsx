import type { Metadata } from 'next';
import { AuthScreen } from '@/components/site/AuthScreen';
import { Icon } from '@/components/ds/Icon';

export const metadata: Metadata = {
  title: 'Create your Quarter account',
  description: 'Your membership is arranged with us — create your account and we’ll set your plan up. Nothing to pay now.',
  alternates: { canonical: '/enrol' },
};

/* The link the team shares with anyone whose membership is arranged off-site: a company
   joining a team room, or an individual we've set up by hand. Creates a plan-less
   Memberstack account exactly like /signup (no plan, no payment) — admin assigns the plan
   afterwards from the members pane. Company is optional, and captured so staff can group a
   team together. Lands on /dashboard. */
export default function EnrolPage() {
  return (
    <AuthScreen
      mode="signup"
      badge="New member"
      heading="Create your Quarter account"
      subtitle="Your membership is arranged with us — create your account and we’ll set your plan up. There’s nothing to pay now."
      collectCompany
      intro={
        <ul>
          <li>
            <Icon name="check" size={16} color="var(--gold-700)" style={{ marginTop: 2 }} />
            <span>No plan to choose and no payment today — we’ll set your plan up for you.</span>
          </li>
          <li>
            <Icon name="check" size={16} color="var(--gold-700)" style={{ marginTop: 2 }} />
            <span>Joining a team? Add your company so we can keep you together — otherwise leave it blank.</span>
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
