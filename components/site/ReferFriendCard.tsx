'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import { getReferrals, type ReferralFriend } from '@/lib/booking';
import { REFERRAL_BONUS } from '@/lib/rewards';
import styles from './ReferFriendCard.module.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://thequarter.work';

export function ReferFriendCard() {
  const [code, setCode] = useState('');
  const [friends, setFriends] = useState<ReferralFriend[]>([]);
  const [joined, setJoined] = useState(0);
  const [pending, setPending] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await getReferrals();
      if (r.ok) {
        setCode(r.data.code);
        setFriends(r.data.friends);
        setJoined(r.data.joined);
        setPending(r.data.pending);
      }
    })();
  }, []);

  const link = code ? `${SITE}/i/${code}` : '';
  const waText = encodeURIComponent(`I'm a member at The Quarter in Canterbury — thought you'd like it. Join here: ${link}`);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Refer a friend</span>
      <h3 className={styles.title}>Share the Quarter</h3>
      <p className={styles.body}>
        Get <strong>+{REFERRAL_BONUS} points</strong> when a friend joins on their first paid plan.
      </p>

      <div className={styles.inviteBlock}>
        <span className={styles.link}>{link || 'Loading your link…'}</span>
        <button className={styles.copyBtn} onClick={copy} aria-label="Copy invite link" disabled={!link}>
          <Icon name={copied ? 'check' : 'copy'} size={16} color="var(--gold-700)" />
        </button>
      </div>

      <a className={styles.wa} href={link ? `https://wa.me/?text=${waText}` : undefined} target="_blank" rel="noreferrer">
        <Icon name="share-2" size={16} color="#fff" /> Share on WhatsApp
      </a>

      <div className={styles.tracker}>
        <span className={styles.trackerLine}>
          {joined} joined · {pending} pending
        </span>
        {friends.length ? (
          <div className={styles.friends}>
            {friends.map((f, i) => (
              <div key={i} className={styles.friend}>
                <span className={styles.avatar}>{(f.name || 'F')[0].toUpperCase()}</span>
                <span className={styles.fName}>{f.name}</span>
                <span className={`${styles.pill} ${f.status === 'joined' ? styles.pillJoined : ''}`}>
                  {f.status === 'joined' ? 'Joined' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className={styles.empty}>No invites yet — share your link to get started.</span>
        )}
      </div>
    </div>
  );
}
