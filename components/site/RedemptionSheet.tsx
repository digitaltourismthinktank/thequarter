'use client';

import { useEffect, useState } from 'react';
import { Icon, type IconName } from '@/components/ds/Icon';
import { Qr } from '@/components/ds/Qr';
import styles from './RedemptionSheet.module.css';

/** Canonical verification host for the QR (CODE_BRIEF §3 — thequarter.work). */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work';

export interface RedemptionInfo {
  kind: 'perk' | 'reward';
  title: string;
  partner: string;
  icon: IconName;
  pos?: string;
  auth?: string;
  token: string;
}

/**
 * What the member shows in-store: a bottom sheet with the offer, their live member
 * identity, a real QR pointing at /v/[token], and the staff till instruction.
 * Reused for both perk redemptions and reward vouchers.
 */
export function RedemptionSheet({
  info,
  memberName,
  memberPlan,
  onClose,
}: {
  info: RedemptionInfo | null;
  memberName: string;
  memberPlan: string | null;
  onClose: () => void;
}) {
  const [clock, setClock] = useState('');
  useEffect(() => {
    if (!info) return;
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [info]);

  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info, onClose]);

  if (!info) return null;
  const verifyUrl = `${SITE}/v/${info.token}`;
  const previewUrl = typeof window !== 'undefined' ? `${window.location.origin}/v/${info.token}/` : verifyUrl;
  const initials =
    memberName
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'Q';

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Show this to staff">
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span>The Quarter · {info.kind === 'reward' ? 'Reward' : 'Perk'}</span>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className={styles.offer}>
          <span className={styles.offerChip}>
            <Icon name={info.icon} size={26} color="var(--gold-700)" />
          </span>
          <div>
            <span className={styles.partner}>{info.partner}</span>
            <h3 className={styles.title}>{info.title}</h3>
          </div>
        </div>

        <div className={styles.identity}>
          <span className={styles.avatar}>{initials}</span>
          <div className={styles.idText}>
            <strong>{memberName}</strong>
            <span>{memberPlan ? `${memberPlan} · Active Quarter member` : 'Active Quarter member'}</span>
          </div>
          <span className={styles.live} aria-hidden="true">
            <span className={styles.sweep} />
            <span className={styles.dot} />
          </span>
        </div>

        <div className={styles.qrWrap}>
          <Qr value={verifyUrl} size={196} />
          <span className={styles.qrHint}>Staff: open your phone camera and point it here.</span>
          <span className={styles.qrClock}>Live · {clock}</span>
        </div>

        {info.pos ? (
          <div className={styles.staff}>
            <span className={styles.staffLabel}>For staff at the till</span>
            <p className={styles.staffPos}>{info.pos}</p>
            <p className={styles.auth}>
              {info.auth ? `Authorised by ${info.auth}. ` : ''}The Quarter is operated by SE1 Media Ltd.
            </p>
          </div>
        ) : null}

        <a className={styles.seeWhat} href={previewUrl} target="_blank" rel="noreferrer">
          See what staff sees when they scan ›
        </a>
      </div>
    </div>
  );
}
