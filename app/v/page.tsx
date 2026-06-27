import type { Metadata } from 'next';
import { VerifyClient } from '@/components/site/VerifyClient';

export const metadata: Metadata = {
  title: 'Verify a Quarter member',
  description: 'Confirm a Quarter member and see how to honour their perk.',
  robots: { index: false, follow: false },
};

/**
 * /v/[token] — the link-only page a partner opens by scanning a member's QR.
 * Static export can't pre-render arbitrary tokens, so this single shell is served
 * for any /v/<token> (netlify.toml rewrite) and reads the token from the path.
 */
export default function VerifyPage() {
  return <VerifyClient />;
}
