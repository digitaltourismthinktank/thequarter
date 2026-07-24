'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ds/Icon';
import { cn } from '@/lib/cn';
import {
  listNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  clearNotification,
  clearAllNotifications,
  BALANCES_EVENT,
  type Notification,
  type NotifyScope,
} from '@/lib/booking';
import styles from './NotificationsBell.module.css';

/** Compact "2m / 3h / 5d / 24 Jul" relative time. */
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * The bell + inbox. One component serves both apps: `scope="member"` shows the caller's own
 * notifications, `scope="admin"` the shared staff feed. Every push the backend sends is mirrored
 * into this inbox, so nothing important is lost to a missed browser notification. Degrades to a
 * quiet, empty bell when the Notifications table isn't configured yet.
 */
export function NotificationsBell({ scope = 'member' }: { scope?: NotifyScope }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    const r = await listNotifications(scope);
    if (r.ok) {
      setItems(r.data.notifications || []);
      setUnread(r.data.unread || 0);
    }
  }, [scope]);

  // Initial + quiet 60s poll (keeps the unread dot honest without a socket), plus a refresh
  // whenever balances change — most of those flows also emit a notification.
  useEffect(() => {
    refresh();
    const iv = window.setInterval(refresh, 60_000);
    const onBal = () => refresh();
    window.addEventListener(BALANCES_EVENT, onBal);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener(BALANCES_EVENT, onBal);
    };
  }, [refresh]);

  // Refresh on open (catch anything that landed since the last poll).
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openRow = async (n: Notification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationsRead([n.id], scope).catch(() => {});
    }
    if (n.url) {
      setOpen(false);
      // In-app links route client-side; anything else (rare) gets a full nav.
      if (n.url.startsWith('/')) router.push(n.url);
      else window.location.assign(n.url);
    }
  };

  const readAll = async () => {
    if (busy) return;
    setBusy(true);
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    await markAllNotificationsRead(scope).catch(() => {});
    await refresh();
    setBusy(false);
  };

  const clearOne = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    const gone = items.find((x) => x.id === id);
    if (gone && !gone.read) setUnread((u) => Math.max(0, u - 1));
    await clearNotification(id, scope).catch(() => {});
  };

  const clearAll = async () => {
    if (busy) return;
    setBusy(true);
    setItems([]);
    setUnread(0);
    await clearAllNotifications(scope).catch(() => {});
    setBusy(false);
  };

  const has = items.length > 0;

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={cn(styles.bell, open && styles.bellOn)}
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
      >
        <Icon name="bell" size={18} />
        {unread > 0 ? (
          <span className={styles.dot} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {mounted && open
        ? createPortal(
            <div className={styles.layer}>
              <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Notifications">
                <div className={styles.head}>
                  <strong className={styles.title}>Notifications</strong>
                  <div className={styles.headActions}>
                    <button type="button" className={styles.action} onClick={readAll} disabled={!unread || busy}>
                      <Icon name="check" size={14} />
                      <span>Mark all read</span>
                    </button>
                    <button type="button" className={styles.action} onClick={clearAll} disabled={!has || busy}>
                      <Icon name="x" size={14} />
                      <span>Clear all</span>
                    </button>
                  </div>
                </div>

                <div className={styles.list}>
                  {has ? (
                    items.map((n) => {
                      const clickable = !!n.url;
                      return (
                        <div key={n.id} className={cn(styles.row, !n.read && styles.rowUnread)}>
                          <button
                            type="button"
                            className={cn(styles.rowMain, clickable && styles.rowClickable)}
                            onClick={() => openRow(n)}
                          >
                            {!n.read ? <span className={styles.unreadDot} aria-hidden="true" /> : <span className={styles.readSpacer} aria-hidden="true" />}
                            <span className={styles.rowText}>
                              <span className={styles.rowTitle}>{n.title}</span>
                              {n.body ? <span className={styles.rowBody}>{n.body}</span> : null}
                              <span className={styles.rowMeta}>
                                <span>{ago(n.at)}</span>
                                {clickable ? (
                                  <span className={styles.rowOpen}>
                                    Open <Icon name="chevron-right" size={12} />
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.rowClear}
                            onClick={() => clearOne(n.id)}
                            aria-label="Clear this notification"
                            title="Clear"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.empty}>
                      <span className={styles.emptyBell}>
                        <Icon name="bell" size={22} />
                      </span>
                      <p className={styles.emptyTitle}>You’re all caught up</p>
                      <p className={styles.emptyText}>New alerts about your bookings, days and post will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
