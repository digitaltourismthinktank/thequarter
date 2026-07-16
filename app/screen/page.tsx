import type { Metadata, Viewport } from 'next';
import { ScreenClient } from '@/components/site/ScreenClient';

export const metadata: Metadata = {
  title: 'The Quarter — Today',
  description: 'Live availability and what’s on at The Quarter.',
  robots: { index: false, follow: false },
  // Standalone / "Add to Home Screen": launches full-screen (no Safari chrome), edge-to-edge
  // status bar so the ink header sits under it. Scoped to the /screen route only.
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'The Quarter' },
};

// Fixed kiosk viewport — cover the safe areas (notch/home-indicator) so the display goes
// edge-to-edge in standalone, and pin the scale so pinch-zoom can't break fullscreen.
export const viewport: Viewport = {
  themeColor: '#1e1a15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

/* PHASE-3: portrait entrance/lobby display. Full-bleed kiosk (covers site chrome). */
export default function ScreenPage() {
  return <ScreenClient />;
}
