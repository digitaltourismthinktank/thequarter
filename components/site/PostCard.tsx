'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMyPost, choosePost, requestEnvelopePhoto, type PostItem } from '@/lib/booking';
import { SITE } from '@/lib/site';
import { CardUpdate } from './CardUpdate';
import { cn } from '@/lib/cn';
import styles from './PostCard.module.css';

/** The Canterbury business address the Hybrid plan confers — copyable for Companies House / HMRC.
 *  Hybrid also includes a co-working day a month; surface that allowance here so it's never a
 *  benefit the member forgot they had. `daysLeft`/`renewal` come from the dashboard's live balance. */
export function RegisteredAddressCard({
  company,
  className,
  daysLeft,
  renewal,
}: {
  company?: string | null;
  className?: string;
  daysLeft?: number | null;
  renewal?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const lines = [company || null, 'The Quarter', ...SITE.address.split(', ')].filter(Boolean) as string[];
  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked — the address is on screen to copy by hand */
    }
  }
  const hasDays = typeof daysLeft === 'number';
  return (
    <div className={cn(styles.hero, className)}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Your registered address</span>
      </div>
      <p className={styles.addrBlock}>
        {lines.map((l, i) => (
          <span key={i}>
            {i === 0 && company ? <strong>{l}</strong> : l}
            {i < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
      <div className={styles.btnRow}>
        <button type="button" className={cn(styles.btn, styles.btnSec)} onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy address'}
        </button>
      </div>
      <p className={styles.help}>Use this as your official business and mailing address — the one to give Companies House, HMRC and your bank.</p>

      {/* The co-working day that comes with Hybrid — one a month. When there's a day to use, this
          books it; once it's used the tap should offer MORE days (the Plan page), not send them
          back to a booking screen they can't complete. */}
      {(() => {
        const dayToUse = hasDays && daysLeft != null && daysLeft > 0;
        return (
          <a className={styles.allowance} href={dayToUse ? '/book' : '/plan/#passes'}>
            <span className={styles.allowanceIcon} aria-hidden="true">
              ☕
            </span>
            <span className={styles.allowanceText}>
              <strong>{dayToUse ? `${daysLeft} co-working ${daysLeft === 1 ? 'day' : 'days'} to use` : hasDays ? 'This month’s co-working day is used' : 'A co-working day a month'}</strong>
              <span className={styles.allowanceSub}>
                Included with Hybrid — a day a month to work in{renewal ? ` · resets ${renewal}` : ''}.{' '}
                {dayToUse ? 'Tap to book yours.' : 'Need more days? Add a day pass or change plan.'}
              </span>
            </span>
            <span className={styles.allowanceArrow} aria-hidden="true">
              →
            </span>
          </a>
        );
      })()}
    </div>
  );
}

/** Format a YYYY-MM-DD as "29 Jun" (calendar date, UTC). */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function arrivedLabel(iso: string | null): string {
  if (!iso) return '';
  const today = new Date().toISOString().slice(0, 10);
  return iso === today ? 'arrived today' : `arrived ${fmtDate(iso)}`;
}

const STATUS_TEXT: Record<string, string> = {
  'To scan': 'We’re scanning it',
  Scanned: 'Scanned — read it below · original in your pigeon hole to collect any time',
  'To forward': 'Getting it ready to post',
  Posted: 'On its way to you',
  'To collect': 'You can collect it from your pigeon hole any time',
  Collected: 'Collected',
};

/**
 * Members' post. The same card is used two ways: `hero` (a headline card, for Hybrid Office who
 * bought the address) and `strip` (a compact rail entry for everyone else). It's driven entirely
 * by the member's own post records — no post on file and the strip renders nothing.
 */
export function PostCard({ variant = 'hero', className }: { variant?: 'hero' | 'strip' | 'card'; className?: string }) {
  const [items, setItems] = useState<PostItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanFor, setScanFor] = useState<string | null>(null); // item awaiting explicit open-permission
  const [needAddr, setNeedAddr] = useState(false); // forward blocked: no forwarding address on profile
  const [cardFor, setCardFor] = useState<string | null>(null); // forward blocked: add a card inline first
  const [expanded, setExpanded] = useState(false); // strip → reveal the actions

  const refresh = useCallback(async () => {
    const r = await getMyPost();
    if (r.ok) setItems(r.data.items);
  }, []);
  useEffect(() => {
    refresh();
    // Post is logged by staff while the member's dashboard may already be open — re-fetch when the
    // tab regains focus / becomes visible (and the push lands them back here) so newly-arrived post
    // shows without a manual reload.
    const onWake = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [refresh]);

  const waiting = (items ?? []).filter((i) => i.status === 'Waiting');
  const inProgress = (items ?? []).filter((i) => i.status !== 'Waiting' && i.status !== 'Collected');
  const active = waiting.length + inProgress.length;

  async function act(fn: () => Promise<{ ok: boolean; data?: { error?: string; detail?: string } }>, ok: string) {
    setErr(null);
    setNote(null);
    const r = await fn();
    if (!r.ok || r.data?.error) setErr(postError(r.data?.error));
    else setNote(ok);
    await refresh();
  }

  async function doScan(id: string) {
    setBusyId(id);
    await act(() => choosePost(id, 'scan', { permission: true }), 'Thanks — we’ll scan it and email you. The original stays in your pigeon hole to collect any time.');
    setScanFor(null);
    setBusyId(null);
  }
  async function doForward(id: string) {
    setBusyId(id);
    setErr(null);
    setNeedAddr(false);
    const r = await choosePost(id, 'forward');
    if (r.ok && !r.data?.error) {
      setNote('Sorted — £7.50 charged, and we’ll post it 1st class to your forwarding address.');
      await refresh();
    } else if (r.data?.error === 'no-forward-address') {
      setNeedAddr(true); // must add a forwarding address on their profile first
    } else if (r.data?.error === 'no-card') {
      setCardFor(id); // no saved card → collect one inline, then retry
    } else {
      setErr(postError(r.data?.error));
    }
    setBusyId(null);
  }
  // After a card is added inline, retry the forward — now the saved-card charge path runs.
  async function cardAddedThenForward(id: string) {
    setCardFor(null);
    await doForward(id);
  }
  async function doCollect(id: string) {
    setBusyId(id);
    await act(() => choosePost(id, 'collect'), 'We’ll hold it at the lodge — pick it up next time you’re in.');
    setBusyId(null);
  }
  async function doPhoto(id: string) {
    setBusyId(id);
    await act(() => requestEnvelopePhoto(id), 'We’ll snap the envelope and pop it here.');
    setBusyId(null);
  }

  // The strip only exists to say "you've got post" — nothing active, nothing to show.
  if (variant === 'strip') {
    if (items === null || active === 0) return null;
    if (!expanded) {
      return (
        <button type="button" className={cn(styles.strip, className)} onClick={() => setExpanded(true)}>
          <span className={styles.stripIcon} aria-hidden="true">
            ✉
          </span>
          <span className={styles.stripText}>
            You’ve got post{active > 1 ? ` · ${active} items` : ''}
          </span>
          <span className={styles.stripArrow} aria-hidden="true">
            →
          </span>
        </button>
      );
    }
  }

  // The 'card' variant (non-Hybrid, under the stat tiles) mirrors the hero but only appears when
  // there's actually post — no permanent "nothing waiting" block on the dashboard.
  if (variant === 'card' && (items === null || active === 0)) return null;

  const showCalm = variant === 'hero' && active === 0;

  return (
    <div className={cn(variant === 'strip' ? styles.stripCard : styles.hero, waiting.length > 0 && variant !== 'strip' && styles.heroActive, className)}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Post &amp; Parcels</span>
        <span className={styles.pin} aria-hidden="true">
          📮
        </span>
      </div>

      {showCalm ? (
        <>
          <h2 className={styles.title}>No post waiting</h2>
          <p className={styles.sub}>Nothing’s arrived for you. We’ll let you know the moment it does — by push and email.</p>
        </>
      ) : (
        <>
          {waiting.length > 0 ? (
            <>
              <h2 className={styles.title}>You’ve got post</h2>
              <p className={styles.sub}>
                {waiting.length === 1 ? '1 item at the lodge' : `${waiting.length} items waiting`}
                {waiting[0]?.arrived ? ` · newest ${arrivedLabel(waiting[0].arrived)}` : ''}.
              </p>
            </>
          ) : (
            <h2 className={styles.title}>Post in progress</h2>
          )}

          {/* Waiting items — each gets the choose actions. */}
          {waiting.map((it) => (
            <div key={it.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemIcon} aria-hidden="true">
                  {it.type === 'Parcel' ? '📦' : '✉'}
                </span>
                <span className={styles.itemText}>
                  {it.type}
                  {it.sender ? ` · ${it.sender}` : ''}
                  <small>{arrivedLabel(it.arrived)}</small>
                </span>
                <span className={styles.tags}>
                  {it.tags.map((t) => (
                    <span key={t} className={cn(styles.tag, /official/i.test(t) && styles.tagOfficial)}>
                      {t}
                    </span>
                  ))}
                </span>
              </div>

              {it.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.envelope} src={it.photoUrl} alt="Envelope" />
              ) : null}

              {scanFor === it.id ? (
                <div className={styles.confirm}>
                  <p className={styles.confirmText}>
                    Scanning means we <strong>open your envelope</strong> — by confirming you give your consent. We’ll email you the scan and{' '}
                    <strong>keep the original</strong> for you to collect.
                  </p>
                  <div className={styles.btnRow}>
                    <button type="button" className={styles.btn} onClick={() => doScan(it.id)} disabled={busyId === it.id}>
                      Yes, scan it
                    </button>
                    <button type="button" className={cn(styles.btn, styles.btnGhost)} onClick={() => setScanFor(null)} disabled={busyId === it.id}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : cardFor === it.id ? (
                <div className={styles.confirm}>
                  <p className={styles.confirmText}>Add a card to forward by post — £7.50, 1st class. We’ll save it for next time.</p>
                  <CardUpdate triggerLabel="Add a card" onDone={() => cardAddedThenForward(it.id)} />
                  <button type="button" className={cn(styles.btn, styles.btnGhost)} onClick={() => setCardFor(null)} disabled={busyId === it.id}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className={styles.btnRow}>
                  <button type="button" className={styles.btn} onClick={() => setScanFor(it.id)} disabled={busyId === it.id}>
                    Scan &amp; email · Free
                  </button>
                  <button type="button" className={cn(styles.btn, styles.btnSec)} onClick={() => doForward(it.id)} disabled={busyId === it.id}>
                    Forward · £7.50
                  </button>
                  <button type="button" className={cn(styles.btn, styles.btnSec)} onClick={() => doCollect(it.id)} disabled={busyId === it.id}>
                    I’ll collect it
                  </button>
                  {!it.photoUrl && !it.photoRequested ? (
                    <button type="button" className={cn(styles.btn, styles.btnGhost)} onClick={() => doPhoto(it.id)} disabled={busyId === it.id}>
                      Request photo of the envelope
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {/* In-progress items — status only. */}
          {inProgress.map((it) => (
            <div key={it.id} className={cn(styles.item, styles.itemQuiet)}>
              <div className={styles.itemHead}>
                <span className={styles.itemIcon} aria-hidden="true">
                  {it.type === 'Parcel' ? '📦' : '✉'}
                </span>
                <span className={styles.itemText}>
                  {it.type}
                  {it.sender ? ` · ${it.sender}` : ''}
                  <small>{STATUS_TEXT[it.status] || it.status}</small>
                </span>
                <span className={cn(styles.statusPill, it.status === 'To collect' && styles.pillGo, it.status === 'Posted' && styles.pillOk)}>{it.status}</span>
              </div>
              {/* An envelope photo shows inline; a scan (often a PDF) is a view/download link. */}
              {it.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.envelope} src={it.photoUrl} alt="Envelope" />
              ) : null}
              {it.scanUrl ? (
                <div className={styles.viewLinks}>
                  <a className={styles.readScan} href={it.scanUrl} target="_blank" rel="noreferrer">
                    View / download the scan →
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}

      {needAddr ? (
        <p className={styles.err}>
          Add a forwarding address on your{' '}
          <a href="/account" className={styles.readScan}>
            profile
          </a>
          , then tap Forward again.
        </p>
      ) : null}
      {note ? (
        <p className={styles.note} role="status">
          {note}
        </p>
      ) : null}
      {err ? <p className={styles.err}>{err}</p> : null}
    </div>
  );
}

function postError(code?: string): string {
  switch (code) {
    case 'no-card':
      return 'Add a payment card on your Plan page first, then you can forward by post.';
    case 'card-declined':
      return 'That card was declined — check your card on the Plan page and try again.';
    case 'no-forward-address':
      return 'Add a forwarding address first.';
    case 'need-permission':
      return 'We need your OK to open the envelope before scanning.';
    case 'not-found':
      return 'That item isn’t there anymore — pull to refresh.';
    default:
      return 'Something went wrong — please try again.';
  }
}
