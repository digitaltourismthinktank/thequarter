'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getCheckinToday, checkInToday } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import styles from './GeoCheckIn.module.css';

/**
 * On-open location check-in. When the member is physically at The Quarter (within a
 * short radius) and hasn't checked in today, offers a one-tap check-in. A stepping
 * stone to the future app's automatic check-in. Silent if permission is denied or
 * they're not nearby — never nags.
 */

// The Quarter — 27–28 Burgate, Canterbury CT1 2HA (approx). Generous radius for GPS drift indoors.
const QUARTER = { lat: 51.279, lng: 1.082 };
const RADIUS_M = 250;

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function GeoCheckIn() {
  const [near, setNear] = useState(false);
  const [checkedIn, setCheckedIn] = useState(true); // assume in until we know, so we don't flash
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (PREVIEW || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    let cancelled = false;
    (async () => {
      const r = await getCheckinToday();
      if (cancelled || !r.ok) return;
      if (r.data.checkedIn) return; // already in today
      setCheckedIn(false);
      // Only check location once we know they're not already in.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const d = distanceM(pos.coords.latitude, pos.coords.longitude, QUARTER.lat, QUARTER.lng);
          if (d <= RADIUS_M) setNear(true);
        },
        () => {
          /* permission denied / unavailable — stay silent */
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkIn() {
    setBusy(true);
    const r = await checkInToday('Full');
    setBusy(false);
    if (r.ok) setDone(true);
  }

  if (done) {
    return (
      <div className={styles.card} data-state="done">
        <Icon name="check" size={18} color="var(--gold-700)" />
        <span>Checked in — enjoy The Quarter.</span>
      </div>
    );
  }
  if (checkedIn || !near) return null;

  return (
    <div className={styles.card}>
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.text}>
        <strong>You’re at The Quarter</strong>
        <span>Check in for today in one tap.</span>
      </div>
      <Button variant="accent" size="sm" onClick={checkIn} disabled={busy}>
        {busy ? 'Checking in…' : 'Check in'}
      </Button>
    </div>
  );
}
