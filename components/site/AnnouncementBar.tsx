'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ds/Icon';
import styles from './AnnouncementBar.module.css';

/* The Quarter — dismissible announcement bar. Remembers dismissal in
   localStorage (bump STORAGE_KEY to re-show after changing the message). */

const STORAGE_KEY = 'tq-announcement-dismissed-v1';

export interface AnnouncementBarProps {
  message: string;
  href?: string;
  linkLabel?: string;
}

export function AnnouncementBar({ message, href, linkLabel }: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1') {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Site announcement">
      <p className={styles.text}>
        {message}
        {href && linkLabel ? (
          <>
            {' '}
            <Link href={href} className={styles.link}>
              {linkLabel} <Icon name="arrow-right" size={14} />
            </Link>
          </>
        ) : null}
      </p>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss announcement"
        onClick={() => {
          window.localStorage.setItem(STORAGE_KEY, '1');
          setDismissed(true);
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
