'use client';

import { Icon } from '@/components/ds/Icon';
import { UPDATES } from '@/lib/updates';
import styles from './WhatsNew.module.css';

/**
 * "What's new" for admins — a dumb, controlled modal listing recent updates (from lib/updates).
 * The admin page owns the open/seen logic: it opens this automatically the first time an admin
 * loads it after a new entry, and a "What's new" button re-opens it any time.
 */
export function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="What's new" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <Icon name="x" size={20} />
        </button>
        <span className={styles.eyebrow}>What’s new</span>
        <h2 className={styles.h2}>Recent updates to The Quarter</h2>
        <div className={styles.list}>
          {UPDATES.map((u) => (
            <section key={u.id} className={styles.entry}>
              <div className={styles.entryHead}>
                <h3 className={styles.entryTitle}>{u.title}</h3>
                <span className={styles.entryDate}>{new Date(`${u.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <ul className={styles.items}>
                {u.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <button type="button" className={styles.done} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
