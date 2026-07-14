'use client';

import { Icon } from '@/components/ds/Icon';
import styles from './TalkToUs.module.css';

/** Opens the Crisp chat with a natural pre-filled opener (the default launcher is
 *  hidden; these buttons are the way in). */
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
    const w = window as unknown as { $crisp?: { push: (cmd: unknown[]) => void } };
    if (w.$crisp) {
      if (prefill) w.$crisp.push(['set', 'message:text', [prefill]]);
      w.$crisp.push(['do', 'chat:show']);
      w.$crisp.push(['do', 'chat:open']);
    }
  }
  return (
    <button type="button" className={`${styles.btn} ${variant === 'solid' ? styles.solid : styles.ghost}`} onClick={open}>
      <Icon name="message-circle" size={16} />
      {label}
    </button>
  );
}
