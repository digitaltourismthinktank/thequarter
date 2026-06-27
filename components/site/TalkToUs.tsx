'use client';

import { Icon } from '@/components/ds/Icon';
import styles from './TalkToUs.module.css';

/** Opens the Intercom messenger with a natural pre-filled opener (no mailto fallback —
 *  the launcher is hidden; these buttons are the way in). */
export function TalkToUs({
  prefill = 'I was on The Quarter site and wanted to ask about ',
  label = 'Talk to us',
  variant = 'ghost',
}: {
  prefill?: string;
  label?: string;
  variant?: 'ghost' | 'solid';
}) {
  function open() {
    const w = window as unknown as { Intercom?: (cmd: string, msg?: string) => void };
    w.Intercom?.('showNewMessage', prefill);
  }
  return (
    <button type="button" className={`${styles.btn} ${variant === 'solid' ? styles.solid : styles.ghost}`} onClick={open}>
      <Icon name="message-circle" size={16} />
      {label}
    </button>
  );
}
