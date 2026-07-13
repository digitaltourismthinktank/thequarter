'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember, memberPlanSlug } from './useMember';
import { PLANS, PLAN_STRIPE_PRICE, type PlanId } from '@/lib/plans';
import { ANNUAL_PLANS, annualSaving } from '@/lib/rewards';
import { getMemberToken, memberIsPaused, memberDaysRemaining, memberRenewalDate, memberHasPaymentIssue } from '@/lib/memberstack';
import { switchPlan, pausePlan, resumePlan, requestVatInvoice } from '@/lib/booking';
import { CarnetCard } from './CarnetCard';
import styles from './PlanClient.module.css';

/** The three switchable plans (Hybrid is annual-only and handled separately). */
const SWITCHABLE: PlanId[] = ['visitor', 'resident', 'citizen'];
const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
type Term = 'monthly' | 'annual';
type Pending = { kind: 'switch'; slug: PlanId; term: Term } | { kind: 'pause' } | { kind: 'resume' } | null;

export function PlanClient() {
  const { loading, member, refresh } = useMember();
  const currentSlug = memberPlanSlug(member) as PlanId | null;
  const paused = memberIsPaused(member);
  const payIssue = memberHasPaymentIssue(member);
  const days = memberDaysRemaining(member);
  const renewal = memberRenewalDate(member);

  const [term, setTerm] = useState<Term>('monthly');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [vatMsg, setVatMsg] = useState<string | null>(null);

  async function requestVat() {
    setVatMsg(null);
    const r = await requestVatInvoice();
    setVatMsg(r.ok ? 'Requested — we’ll email your VAT invoice shortly.' : 'Could not send the request — please try again.');
  }

  const currentName = useMemo(() => (currentSlug ? PLANS.find((p) => p.id === currentSlug)?.name ?? null : null), [currentSlug]);

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

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      let ok = false;
      if (pending.kind === 'switch') {
        const priceId = PLAN_STRIPE_PRICE[pending.slug]?.[pending.term];
        if (!priceId) {
          setErr('That option isn’t available yet — please ask us.');
          setBusy(false);
          return;
        }
        const r = await switchPlan(priceId);
        ok = r.ok;
        if (ok) setDone('Done — your new plan starts at your next renewal.');
      } else if (pending.kind === 'pause') {
        const r = await pausePlan();
        ok = r.ok;
        if (ok) setDone('Your membership is pausing — billing stops and your days are frozen.');
      } else {
        const r = await resumePlan();
        ok = r.ok;
        if (ok) setDone('Welcome back — your membership is active again from today.');
      }
      if (!ok) setErr('Something went wrong — please try again, or manage it in the billing portal.');
      else {
        // The Stripe webhook updates Memberstack a few seconds later — poll so this
        // page reflects the new plan/pause state without a manual reload.
        let n = 0;
        const iv = setInterval(async () => {
          await refresh();
          if ((n += 1) >= 6) clearInterval(iv);
        }, 3000);
      }
    } catch {
      setErr('Something went wrong — please try again.');
    }
    setPending(null);
    setBusy(false);
  }

  const pendingLabel = useMemo(() => {
    if (!pending) return '';
    if (pending.kind === 'pause') return 'Pause your membership? Your current month runs out as normal, then billing stops and your remaining days freeze until you resume.';
    if (pending.kind === 'resume') return 'Resume your membership? A fresh billing cycle starts today, and your frozen days carry over.';
    const name = PLANS.find((p) => p.id === pending.slug)?.name ?? pending.slug;
    return `Switch to ${name}, billed ${pending.term === 'annual' ? 'annually' : 'monthly'}? It takes effect at your next renewal — no mid-cycle charge.`;
  }, [pending]);

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
        <p className={styles.sub}>Your current membership, and everything you can change — all from here.</p>
      </header>

      {/* Current plan — always first. */}
      <section className={styles.current}>
        <div className={styles.currentMain}>
          <span className={styles.currentOver}>Current membership</span>
          <span className={styles.currentName}>
            {currentName ?? 'No active plan'}
            {paused ? <span className={styles.pausedTag}>Paused</span> : null}
          </span>
          <div className={styles.currentMeta}>
            {days ? <span>{days === 'Unlimited' ? 'Unlimited days' : `${days} days remaining`}</span> : null}
            {renewal ? <span>{paused ? 'Frozen' : `Renews ${renewal}`}</span> : null}
          </div>
        </div>
        <div className={styles.currentActions}>
          {paused ? (
            <Button variant="primary" size="sm" onClick={() => setPending({ kind: 'resume' })} disabled={busy}>
              Resume membership
            </Button>
          ) : currentSlug ? (
            <Button variant="secondary" size="sm" onClick={() => setPending({ kind: 'pause' })} disabled={busy}>
              Pause membership
            </Button>
          ) : null}
          <button type="button" className={styles.linkBtn} onClick={manageBilling} disabled={busy}>
            Manage card &amp; invoices
          </button>
          <button type="button" className={styles.linkBtn} onClick={requestVat}>
            Request a VAT invoice
          </button>
        </div>
      </section>

      {vatMsg ? <p className={styles.done}>{vatMsg}</p> : null}

      {done ? <p className={styles.done}>{done}</p> : null}
      {err ? <p className={styles.err}>{err}</p> : null}

      {/* Confirm strip for any pending change. */}
      {pending ? (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirm change">
          <p className={styles.confirmText}>{pendingLabel}</p>
          <div className={styles.confirmActions}>
            <Button variant="primary" size="sm" onClick={confirmPending} disabled={busy}>
              {busy ? 'One moment…' : 'Confirm'}
            </Button>
            <button type="button" className={styles.linkBtn} onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Change plan. */}
      <section className={styles.card}>
        <div className={styles.switchHead}>
          <h2 className={styles.h2}>Change plan</h2>
          <div className={styles.toggle} role="tablist" aria-label="Billing term">
            <button className={`${styles.seg} ${term === 'monthly' ? styles.segOn : ''}`} onClick={() => setTerm('monthly')} role="tab" aria-selected={term === 'monthly'}>
              Monthly
            </button>
            <button className={`${styles.seg} ${term === 'annual' ? styles.segOn : ''}`} onClick={() => setTerm('annual')} role="tab" aria-selected={term === 'annual'}>
              Annual
            </button>
          </div>
        </div>

        {payIssue ? (
          <p className={styles.done} style={{ color: 'var(--ink-900)' }}>
            There&rsquo;s a problem with your card — please “Manage card &amp; invoices” to update it before changing plan.
          </p>
        ) : null}

        <div className={styles.options}>
          {SWITCHABLE.map((slug) => {
            const plan = PLANS.find((p) => p.id === slug);
            const opt = ANNUAL_PLANS[slug as keyof typeof ANNUAL_PLANS];
            if (!plan || !opt) return null;
            const isCurrent = slug === currentSlug;
            const price = term === 'monthly' ? opt.monthly : opt.annual;
            const saving = term === 'annual' ? annualSaving(opt) : 0;
            return (
              <div key={slug} className={`${styles.option} ${isCurrent ? styles.optionCurrent : ''}`}>
                <div className={styles.optionTop}>
                  <span className={styles.optionName}>{plan.name}</span>
                  {isCurrent ? <span className={styles.currentChip}>Current</span> : null}
                </div>
                <div className={styles.optionPrice}>
                  <strong>{gbp(price)}</strong>
                  <span>{term === 'monthly' ? '/mo' : '/yr'}</span>
                </div>
                <span className={styles.optionSub}>
                  {term === 'annual' && saving > 0 ? `Save ${gbp(saving)} a year` : plan.summary}
                </span>
                <Button
                  variant={isCurrent ? 'ghost' : 'secondary'}
                  size="sm"
                  onClick={() => setPending({ kind: 'switch', slug, term })}
                  disabled={busy || payIssue}
                >
                  {isCurrent ? 'Switch billing term' : `Switch to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className={styles.note}>
          Switches take effect at your next renewal, with no mid-cycle charge. Prefer to do it yourself? Use “Manage card &amp; invoices”.
        </p>
      </section>

      <CarnetCard />
    </div>
  );
}
