import type { Metadata } from 'next';
import { Section } from '@/components/site/primitives';
import { WelcomeClient } from '@/components/site/WelcomeClient';

export const metadata: Metadata = {
  title: 'Welcome to The Quarter',
  description: 'Set up your member account.',
  robots: { index: false, follow: false },
};

/* Static export: pre-render the paid plans. Stripe Payment Links redirect here
   (e.g. /welcome/resident?session_id=…) once the client switches them at go-live. */
export function generateStaticParams() {
  return [{ plan: 'visitor' }, { plan: 'resident' }, { plan: 'citizen' }, { plan: 'hybrid-office' }];
}

export default function WelcomePage({ params }: { params: { plan: string } }) {
  return (
    <Section tone="page">
      <WelcomeClient plan={params.plan} />
    </Section>
  );
}
