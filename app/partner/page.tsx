import type { Metadata } from 'next';
import { PartnerClient } from '@/components/site/PartnerClient';

export const metadata: Metadata = {
  title: 'Your Quarter partner balance',
  description: 'A live view of your reward float and recent redemptions at The Quarter.',
  // Link-only, per-partner page — keep it out of search indexes.
  robots: { index: false, follow: false },
};

/**
 * /partner/<token> — a partner's NO-LOGIN, bookmarkable balance page. Static export
 * can't pre-render arbitrary tokens, so (exactly like /v/<token>) a single shell is
 * served for any /partner/* via a netlify.toml rewrite and reads the token from the
 * path client-side.
 */
export default function PartnerPage() {
  return <PartnerClient />;
}
