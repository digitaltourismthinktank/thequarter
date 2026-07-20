'use client';

import { useEffect, type ReactNode } from 'react';
import styles from './MemberCardSheet.module.css';

/**
 * The membership card, presented the way a wallet presents a pass: the screen dims, the
 * card rises and settles, and there is nothing else to look at.
 *
 * The card itself (components/ds/QuarterCard) already existed and was already good — it was
 * just `display: none` below 600px, so on a phone no member had ever seen it. This gives it
 * somewhere to be shown rather than drawing a second one.
 */
export function MemberCardSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Your membership card" onClick={onClose}>
      <div className={styles.stage} onClick={(e) => e.stopPropagation()}>
        <div className={styles.card}>{children}</div>
        <button type="button" className={styles.done} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
