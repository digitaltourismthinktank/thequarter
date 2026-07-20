import type { Metadata } from 'next';
import { UnsubscribeClient } from '@/components/site/UnsubscribeClient';

export const metadata: Metadata = {
  title: 'Email preferences · The Quarter',
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return <UnsubscribeClient />;
}
