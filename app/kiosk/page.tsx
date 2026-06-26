import type { Metadata } from 'next';
import { KioskClient } from '@/components/site/KioskClient';

export const metadata: Metadata = {
  title: 'The Quarter — Room',
  description: 'Room availability and on-the-spot booking.',
  robots: { index: false, follow: false },
};

/* PHASE-3: per-room iPad kiosk. Configure each device with /kiosk?room=<spaceId>. */
export default function KioskPage() {
  return <KioskClient />;
}
