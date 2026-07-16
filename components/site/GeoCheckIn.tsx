'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { getCheckinToday, checkInToday, type CheckinStatus } from '@/lib/booking';
import { PREVIEW } from '@/lib/devMock';
import styles from './GeoCheckIn.module.css';

/**
 * On-site dashboard mode. When a signed-in member is physically at The Quarter, the
 * dashboard blossoms into a warm ink/gold "You're here" hero — one-tap check-in if
 * they haven't yet, or a welcome-back with door code + today's atmosphere if they have.
 *
 * Privacy / UX contract:
 *  - Never forces a geolocation prompt on load. If the Permissions API reports the
 *    member already granted location, we read it silently; otherwise we show a small,
 *    dismissible "use my location" opt-in and only call the browser on an explicit tap.
 *  - A single getCurrentPosition — no continuous, battery-draining watch.
 *  - Denied / unavailable / not-near → renders nothing at all (zero nagging).
 *  - SSR-safe: every navigator touch lives inside an effect or a click handler.
 */

// The Quarter — 27–28 Burgate, Canterbury CT1 2HA (LocalBusiness schema coords).
// Generous radius to absorb GPS drift indoors / near the venue.
const QUARTER = { lat: 51.2798, lng: 1.0817 };
const RADIUS_M = 180;
const DISMISS_KEY = 'q-geo-offer-dismissed';

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** A short, warm message if a check-in tap fails (mirrors CheckInCard's tone). */
function friendly(code?: string): string {
  switch (code) {
    case 'closed-weekend':
    case 'closed-day':
      return 'The Quarter is closed today.';
    case 'no-token':
    case 'invalid-token':
    case 'verify-failed':
    case 'no-member':
      return 'Please sign in again to check in.';
    case 'network':
    case 'server':
      return 'Couldn’t reach check-in just now — please try again.';
    default:
      return 'Something went wrong — please try again.';
  }
}

type Phase = 'hidden' | 'offer' | 'onsite';

export interface GeoCheckInProps {
  /** The member's door code — surfaced on arrival once checked in (already fetched upstream). */
  doorCode?: string | null;
  /** Today's expected atmosphere — surfaced on arrival once checked in (already computed upstream). */
  busyBand?: { label: string; line: string } | null;
}

export function GeoCheckIn({ doorCode, busyBand }: GeoCheckInProps) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [locating, setLocating] = useState(false);
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null);
  const [justChecked, setJustChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  // A single position read. On success: near → reveal the hero (after reading today's
  // check-in status); not-near / error → stay hidden (never nag).
  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive.current) return;
        const d = distanceM(pos.coords.latitude, pos.coords.longitude, QUARTER.lat, QUARTER.lng);
        if (d > RADIUS_M) {
          setLocating(false);
          setPhase('hidden');
          return;
        }
        (async () => {
          const r = await getCheckinToday();
          if (!alive.current) return;
          if (r.ok) setCheckin(r.data);
          setLocating(false);
          setPhase('onsite');
        })();
      },
      () => {
        if (!alive.current) return;
        setLocating(false);
        setPhase('hidden'); // denied / unavailable — silent
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    alive.current = true;

    // Local preview: skip geolocation entirely and render the hero so it's designable.
    if (PREVIEW) {
      (async () => {
        const r = await getCheckinToday();
        if (!alive.current) return;
        if (r.ok) setCheckin(r.data);
        setPhase('onsite');
      })();
      return () => {
        alive.current = false;
      };
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    // Respect a prior dismissal of the opt-in strip — truly zero nagging.
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage blocked — treat as not dismissed */
    }

    const perms = navigator.permissions;
    if (perms && typeof perms.query === 'function') {
      perms
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (!alive.current) return;
          if (status.state === 'granted') locate();
          else if (status.state === 'prompt' && !dismissed) setPhase('offer');
          // 'denied' → stay hidden.
          status.onchange = () => {
            if (alive.current && status.state === 'granted') locate();
          };
        })
        .catch(() => {
          // Permissions API unavailable/failed — don't auto-prompt; offer explicit opt-in.
          if (alive.current && !dismissed) setPhase('offer');
        });
    } else if (!dismissed) {
      // No Permissions API — never auto-prompt; require the explicit tap.
      setPhase('offer');
    }

    return () => {
      alive.current = false;
    };
  }, [locate]);

  function dismissOffer() {
    setPhase('hidden');
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  async function doCheckIn() {
    setBusy(true);
    setError(null);
    const r = await checkInToday('Full');
    if (!alive.current) return;
    setBusy(false);
    if (r.ok) setJustChecked(true);
    else setError(friendly(r.data?.error));
  }

  if (phase === 'hidden') return null;

  if (phase === 'offer') {
    return (
      <div className={styles.offer}>
        <Icon name="map-pin" size={18} color="var(--gold-700)" />
        <span className={styles.offerText}>At The Quarter today?</span>
        <button type="button" className={styles.offerBtn} onClick={locate} disabled={locating}>
          {locating ? 'Checking…' : 'Use my location'}
        </button>
        <button type="button" className={styles.offerDismiss} onClick={dismissOffer} aria-label="Dismiss">
          <Icon name="x" size={16} />
        </button>
      </div>
    );
  }

  // phase === 'onsite'
  const checkedIn = justChecked || (checkin?.checkedIn ?? false);

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>
        <span className={styles.live} aria-hidden="true" />
        On-site now
      </span>

      <div className={styles.head}>
        <span className={styles.pin} aria-hidden="true">
          <Icon name="map-pin" size={22} color="var(--gold-300)" />
        </span>
        <div className={styles.headText}>
          {checkedIn ? (
            <>
              <strong className={styles.title}>Welcome back — you’re checked in</strong>
              <span className={styles.meta}>Enjoy your day at The Quarter.</span>
            </>
          ) : (
            <>
              <strong className={styles.title}>You’re here at The Quarter</strong>
              <span className={styles.meta}>Check in for today in one tap.</span>
            </>
          )}
        </div>
      </div>

      {checkedIn ? (
        <>
          {(doorCode || busyBand) && (
            <div className={styles.pills}>
              {doorCode ? (
                <span className={styles.pill}>
                  <Icon name="door-open" size={16} color="var(--gold-300)" />
                  <span className={styles.pillLabel}>Door</span>
                  <span className={styles.doorCode}>{doorCode}</span>
                </span>
              ) : null}
              {busyBand ? (
                <span className={styles.pill}>
                  <Icon name="users" size={16} color="var(--gold-300)" />
                  <span className={styles.pillLabel}>{busyBand.label}</span>
                  today
                </span>
              ) : null}
            </div>
          )}
          {justChecked ? (
            <span className={styles.confirm}>
              <Icon name="check" size={18} color="var(--gold-300)" />
              Checked in ✓ — enjoy your day.
            </span>
          ) : null}
        </>
      ) : (
        <div className={styles.actions}>
          <Button variant="accent" size="md" onClick={doCheckIn} disabled={busy} iconAfter="arrow-right">
            {busy ? 'Checking in…' : 'Check in now'}
          </Button>
          {error ? <span className={styles.error}>{error}</span> : null}
        </div>
      )}
    </div>
  );
}
