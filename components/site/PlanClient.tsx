'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember, memberPlanSlug } from './useMember';
import { PLANS } from '@/lib/plans';
import { ANNUAL_PLANS, annualSaving } from '@/lib/rewards';
import { getMemberToken } from '@/lib/memberstack';
import { CarnetCard } from './CarnetCard';
import styles from './PlanClient.module.css';

const ANNUAL_SLUGS = Object.keys(ANNUAL_PLANS);
const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

export function PlanClient() {
  const { loading, member } = useMember();
  const currentSlug = memberPlanSlug(member);
  const [selected, setSelected] = useState<string>('citizen');
  const [term, setTerm] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (currentSlug && ANNUAL_SLUGS.includes(currentSlug)) setSelected(currentSlug);
  }, [currentSlug]);

  const opt = ANNUAL_PLANS[selected as keyof typeof ANNUAL_PLANS];
  const planName = useMemo(() => PLANS.find((p) => p.id === selected)?.name ?? selected, [selected]);
  const currentName = useMemo(() => (currentSlug ? PLANS.find((p) => p.id === currentSlug)?.name ?? null : null), [currentSlug]);
  const saving = opt ? annualSaving(opt) : 0;
  const monthsFree = opt && opt.monthly ? Math.round(saving / opt.monthly) : 0;

  async function manageBilling() {
    setBusy(true);
    setErr(null);
    try {
      const token = await getMemberToken();
      if (!token) {
        setErr('Please log in again to manage billing.');
        setBusy(false);
        return;
      }
      const res = await fetch('/.netlify/functions/billing-portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setErr('Could not open billing just now — please try again.');
    } catch {
      setErr('Could not open billing just now — please try again.');
    }
    setBusy(false);
  }

  if (loading) return <p className={styles.state}>Loading your plan…</p>;
  if (!member)
    return (
      <p className={styles.state}>
        Please <a href="/login">log in</a> to manage your plan.
      </p>
    );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Your plan</span>
        <h1 className={styles.h1}>Plan &amp; billing</h1>
        {currentName ? <p className={styles.sub}>You&rsquo;re on the {currentName} plan. Pay monthly, or save by paying for the year.</p> : null}
      </header>

      <div className={styles.card}>
        <div className={styles.planChips}>
          {ANNUAL_SLUGS.map((s) => (
            <button key={s} className={`${styles.planChip} ${selected === s ? styles.planChipActive : ''}`} onClick={() => setSelected(s)}>
              {PLANS.find((p) => p.id === s)?.name ?? s}
            </button>
          ))}
        </div>

        <div className={styles.toggle} role="tablist" aria-label="Billing term">
          <button className={`${styles.seg} ${term === 'monthly' ? styles.segOn : ''}`} onClick={() => setTerm('monthly')} role="tab" aria-selected={term === 'monthly'}>
            Monthly
          </button>
          <button className={`${styles.seg} ${term === 'annual' ? styles.segOn : ''}`} onClick={() => setTerm('annual')} role="tab" aria-selected={term === 'annual'}>
            Annual
          </button>
        </div>

        {opt ? (
          <>
            <div className={styles.priceBlock}>
              <span className={styles.price}>{term === 'monthly' ? gbp(opt.monthly) : gbp(opt.annual)}</span>
              <span className={styles.unit}>{term === 'monthly' ? 'a month' : 'a year'}</span>
            </div>
            <p className={styles.priceCaption}>
              {term === 'monthly'
                ? `${gbp(opt.monthly * 12)} a year at this rate.`
                : `Works out at about ${gbp(opt.annual / 12)} a month.`}
            </p>

            {term === 'annual' ? (
              <>
                <span className={styles.savePill}>Save {gbp(saving)} a year</span>
                <div className={styles.sweetener}>
                  <strong>That&rsquo;s about {monthsFree} months on us.</strong>
                  <span>Pay for the year up front, keep {planName} for less — and earn {Math.round(2 * opt.annual).toLocaleString('en-GB')} Quarter points on the spend.</span>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {err ? <p className={styles.err}>{err}</p> : null}
        <div className={styles.actions}>
          <Button variant="primary" onClick={manageBilling} disabled={busy}>
            {busy ? 'Opening…' : term === 'annual' ? 'Switch to annual' : 'Manage plan & billing'}
          </Button>
        </div>
        <p className={styles.note}>
          {term === 'annual'
            ? 'Annual billing is set up through your billing portal. If you don’t see an annual option yet, just ask us — we’ll switch you over.'
            : 'Change plan, update your card or cancel any time in the billing portal.'}
        </p>
      </div>

      <CarnetCard />
    </div>
  );
}
