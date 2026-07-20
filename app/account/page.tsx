import type { Metadata } from 'next';
import { AccountClient } from '@/components/site/AccountClient';

export const metadata: Metadata = {
  title: 'Your account · The Quarter',
  description: 'Your Quarter Character, your details and your settings.',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountClient />;
}
