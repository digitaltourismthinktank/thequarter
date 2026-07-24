import type { Metadata } from 'next';
import { PostHistoryClient } from '@/components/site/PostHistoryClient';

export const metadata: Metadata = {
  title: 'All my post · The Quarter',
  description: 'Your post & parcels history at The Quarter.',
  robots: { index: false, follow: false },
};

export default function PostPage() {
  return <PostHistoryClient />;
}
