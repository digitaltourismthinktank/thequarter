'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMyPost, setPostVisibility, type PostItem } from '@/lib/booking';
import { MemberShell } from './MemberShell';
import styles from './PostHistoryClient.module.css';

const PAGE = 12;

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A member's full post & parcels history: everything that's ever arrived for them, retrievable any
 * time. Active items sit up top; cleared ones fold into "Archived" so scans stay reachable; anything
 * removed is hidden from them (but kept on file for staff). Paginated so a long history stays tidy.
 */
export function PostHistoryClient() {
  const [items, setItems] = useState<PostItem[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(0);

  const refresh = useCallback(async () => {
    const r = await getMyPost();
    if (r.ok) setItems(r.data.items);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(id: string, action: 'archive' | 'unarchive' | 'remove', ok: string) {
    setBusyId(id);
    setErr(null);
    setNote(null);
    const r = await setPostVisibility(id, action);
    if (!r.ok || r.data?.error) setErr(r.data?.detail || 'That didn’t work — please try again.');
    else setNote(ok);
    await refresh();
    setBusyId(null);
  }

  // Removed items never show to the member. Active = on file, not archived; Archived = cleared.
  const onFile = (items ?? []).filter((i) => !i.removed);
  const active = onFile.filter((i) => !i.archived);
  const archived = onFile.filter((i) => i.archived);
  const list = showArchived ? archived : active;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const pageItems = useMemo(() => list.slice(page * PAGE, page * PAGE + PAGE), [list, page]);
  useEffect(() => {
    setPage(0);
  }, [showArchived]);

  return (
    <MemberShell>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Post &amp; Parcels</span>
        <h1 className={styles.title}>All my post</h1>
        <p className={styles.sub}>Everything that’s arrived for you — scans and photos stay here to view or download any time.</p>
      </header>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={!showArchived} className={`${styles.tab} ${!showArchived ? styles.tabOn : ''}`} onClick={() => setShowArchived(false)}>
          Active{active.length ? ` · ${active.length}` : ''}
        </button>
        <button type="button" role="tab" aria-selected={showArchived} className={`${styles.tab} ${showArchived ? styles.tabOn : ''}`} onClick={() => setShowArchived(true)}>
          Archived{archived.length ? ` · ${archived.length}` : ''}
        </button>
      </div>

      {note ? <p className={styles.note} role="status">{note}</p> : null}
      {err ? <p className={styles.err}>{err}</p> : null}

      {items === null ? (
        <p className={styles.meta}>Loading…</p>
      ) : list.length === 0 ? (
        <p className={styles.meta}>{showArchived ? 'Nothing archived yet.' : 'No post on file. We’ll let you know the moment something arrives.'}</p>
      ) : (
        <>
          <ul className={styles.list}>
            {pageItems.map((it) => (
              <li key={it.id} className={styles.item}>
                <span className={styles.icon} aria-hidden="true">
                  {it.type === 'Parcel' ? '📦' : '✉'}
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemMain}>
                    {it.type}
                    {it.sender ? ` · ${it.sender}` : ''}
                  </span>
                  <span className={styles.itemMeta}>
                    {it.arrived ? `Arrived ${fmtDate(it.arrived)}` : ''}
                    {it.status ? ` · ${it.status}` : ''}
                  </span>
                  {it.photoUrl || it.scanUrl ? (
                    <span className={styles.itemLinks}>
                      {it.scanUrl ? (
                        <a href={it.scanUrl} target="_blank" rel="noreferrer" className={styles.link}>
                          View / download scan →
                        </a>
                      ) : null}
                      {it.photoUrl ? (
                        <a href={it.photoUrl} target="_blank" rel="noreferrer" className={styles.link}>
                          Envelope photo →
                        </a>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span className={styles.actions}>
                  {it.archived ? (
                    <button type="button" className={styles.secondary} onClick={() => act(it.id, 'unarchive', 'Moved back to Active.')} disabled={busyId === it.id}>
                      Restore
                    </button>
                  ) : (
                    <button type="button" className={styles.secondary} onClick={() => act(it.id, 'archive', 'Archived.')} disabled={busyId === it.id}>
                      Archive
                    </button>
                  )}
                  <button type="button" className={styles.remove} onClick={() => act(it.id, 'remove', 'Removed from your history.')} disabled={busyId === it.id} title="Hide from your history (we keep our record)">
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <div className={styles.pager}>
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                ← Newer
              </button>
              <span>
                Page {page + 1} of {pages}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>
                Older →
              </button>
            </div>
          ) : null}
        </>
      )}
    </MemberShell>
  );
}
