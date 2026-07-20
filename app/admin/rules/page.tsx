import type { Metadata } from 'next';
import { RuleBookClient } from '@/components/site/RuleBookClient';

export const metadata: Metadata = {
  title: 'What happens automatically · The Quarter',
  robots: { index: false, follow: false },
};

export default function AdminRulesPage() {
  return <RuleBookClient />;
}
