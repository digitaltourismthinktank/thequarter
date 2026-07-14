'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import styles from './TopProgress.module.css';

/**
 * A slim top loading bar for route changes — reassurance while a slower tab or page
 * loads. Starts when an internal link is clicked, completes when the path changes.
 * App Router has no router events, so we hook link clicks + pathname.
 */
export function TopProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);

  // Start on an internal navigation click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href') || '';
      const external = a.target === '_blank' || /^(https?:|mailto:|tel:|#)/.test(href);
      if (!href.startsWith('/') || external || href === pathname) return;
      setDone(false);
      setActive(true);
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [pathname]);

  // Path changed → finish + fade out.
  useEffect(() => {
    if (!active) return;
    setDone(true);
    const t = setTimeout(() => {
      setActive(false);
      setDone(false);
    }, 360);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;
  return <div className={styles.bar} data-done={done ? 'true' : 'false'} aria-hidden="true" />;
}
