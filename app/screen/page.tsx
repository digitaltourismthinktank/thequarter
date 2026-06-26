import type { Metadata } from 'next';
import { ScreenClient } from '@/components/site/ScreenClient';

export const metadata: Metadata = {
  title: 'The Quarter — Today',
  description: 'Live availability and what’s on at The Quarter.',
  robots: { index: false, follow: false },
};

/* PHASE-3: portrait entrance/lobby display. Full-bleed kiosk (covers site chrome). */
export default function ScreenPage() {
  return <ScreenClient />;
}
