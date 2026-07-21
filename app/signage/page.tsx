import type { Metadata } from 'next';
import { SignageClient } from '@/components/site/SignageClient';

export const metadata: Metadata = {
  title: 'Signage — The Quarter',
  description: 'Printable signage for The Quarter.',
  robots: { index: false, follow: false },
};

/** Staff-facing: a printable set of A4 signage + a counter card. */
export default function SignagePage() {
  return <SignageClient />;
}
