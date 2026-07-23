'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ds/Button';
import { useMember, memberPlanSlug } from './useMember';
import { PLANS, PLAN_STRIPE_PRICE, type PlanId } from '@/lib/plans';
import { ANNUAL_PLANS, annualSaving } from '@/lib/rewards';
import { memberIsPaused, memberDaysRemaining, memberRenewalDate, memberHasPaymentIssue } from '@/lib/memberstack';
import { switchPlan, pausePlan, resumePlan, requestVatInvoice, getInvoices, getMyCard, setInstantBook, requestDataDeletion, type Invoice } from '@/lib/booking';
import { CarnetCard } from './CarnetCard';
import { CardUpdate } from './CardUpdate';
import styles from './PlanClient.module.css';

/** The three switchable plans (Hybrid is annual-only and handled separately). */
const SWITCHABLE: PlanId[] = ['visitor', 'resident', 'citizen'];
const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
type Term = 'monthly' | 'annual';
type Pending = { kind: 'switch'; slug: PlanId; term: Term } | { kind: 'pause' } | { kind: 'resume' } | null;

/** Say what actually went wrong — a blanket "something went wrong" left members stuck. */
function planChangeError(code?: string): string {
  switch (code) {
    case 'no-subscription':
      return 'We couldn’t find a card subscription on your account — if we invoice you directly, just message us and we’ll pause it for you.';
    case 'no-email':
      return 'We couldn’t match your account to your billing record — please message us and we’ll sort it.';
    case 'not-configured':
      return 'Billing isn’t available just this moment — please try again shortly.';
    case 'invalid-token':
    case 'missing-token':
      return 'Please sign in again, then try once more.';
    case 'stripe':
      return 'Your bank or card provider wouldn’t complete that — you can also change it in the billing portal.';
    default:
      return 'Something went wrong — please try again, or manage it in the billing portal.';
  }
}

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [card, setCard] = useState<{ brand: string; last4: string; exp: string } | null>(null);
  const [instantOff, setInstantOff] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadCard = useCallback(() => {
    getMyCard().then((r) => {
      if (r.ok) {
        const cards = r.data.cards || [];
        const c = cards.find((x) => x.default) || cards[0] || null;
        setCard(c ? { brand: c.brand, last4: c.last4, exp: c.exp } : null);
        setInstantOff(!!r.data.instantBookOff);
      }
    });
  }, []);

  useEffect(() => {
    if (!member) return;
    getInvoices().then((r) => {
      if (r.ok) setInvoices(r.data.invoices);
    });
    loadCard();
  }, [member, loadCard]);

  async function toggleInstant() {
    setPayBusy(true);
    setPayMsg(null);
    const next = !instantOff;
    const r = await setInstantBook(next);
    setPayBusy(false);
    if (r.ok) {
      setInstantOff(next);
      setPayMsg(next ? 'Instant book is off — we won’t use your saved card.' : 'Instant book is on — pay in one tap next time.');
    } else setPayMsg('Couldn’t update that just now — please try again.');
  }

  async function doRequestDeletion() {
    setPayBusy(true);
    setPayMsg(null);
    const r = await requestDataDeletion();
    setPayBusy(false);
    setConfirmDelete(false);
    setPayMsg(r.ok ? 'Request received — our team will be in touch to complete your account and data deletion.' : 'Couldn’t send that just now — please try again.');
  }

  async function requestVat() {
    setVatMsg(null);
    const r = await requestVatInvoice();
    setVatMsg(
      r.ok
        ? 'Requested — our team will issue your VAT invoice within the next business day.'
        : 'Could not send the request — please try again.',
    );
  }

  const currentName = useMemo(() => (currentSlug ? PLANS.find((p) => p.id === currentSlug)?.name ?? null : null), [currentSlug]);

  async function confirmPending() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      let ok = false;
      let code: string | undefined;
      if (pending.kind === 'switch') {
        const priceId = PLAN_STRIPE_PRICE[pending.slug]?.[pending.term];
        if (!priceId) {
          setErr('That option isn’t available yet — please ask us.');
          setBusy(false);
          return;
        }
        const r = await switchPlan(priceId);
        ok = r.ok;
        code = (r.data as { error?: string } | undefined)?.error;
        if (ok) setDone('Done — your new plan starts at your next renewal.');
      } else if (pending.kind === 'pause') {
        const r = await pausePlan();
        ok = r.ok;
        code = (r.data as { error?: string } | undefined)?.error;
        if (ok) setDone('Your membership is pausing — billing stops and your days are frozen.');
      } else {
        const r = await resumePlan();
        ok = r.ok;
        code = (r.data as { error?: string } | undefined)?.error;
        if (ok) setDone('Welcome back — your membership is active again from today.');
      }
      if (!ok) setErr(planChangeError(code));
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
              Resume {currentName ? `${currentName} ` : ''}membership
            </Button>
          ) : currentSlug ? (
            <Button variant="secondary" size="sm" onClick={() => setPending({ kind: 'pause' })} disabled={busy}>
              Pause membership
            </Button>
          ) : null}
          <CardUpdate onDone={() => {
            refresh();
            loadCard();
          }} />
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
        <p className={styles.note}>Switches take effect at your next renewal, with no mid-cycle charge.</p>
      </section>

      {/* #passes — the anchor the out-of-days prompt sends people to, so "Buy a day pass" lands on
          the passes pane rather than the top of the plan page. */}
      <div id="passes" style={{ marginTop: 18, scrollMarginTop: '90px' }}>
        <CarnetCard />
      </div>

      <section className={styles.card}>
        <div className={styles.switchHead}>
          <h2 className={styles.h2}>Invoices</h2>
        </div>
        {invoices.length ? (
          <div className={styles.invList}>
            {invoices.map((inv) => (
              <div key={inv.id} className={styles.invRow}>
                <span className={styles.invDate}>
                  {inv.created ? new Date(inv.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </span>
                <span className={styles.invNum}>{inv.number || inv.id}</span>
                <span className={styles.invAmt}>£{inv.total.toFixed(2)}</span>
                <span className={styles.invStatus}>{inv.status === 'paid' ? 'Paid' : inv.status}</span>
                {inv.pdf ? (
                  <a className={styles.linkBtn} href={inv.pdf}>
                    Download
                  </a>
                ) : inv.url ? (
                  <a className={styles.linkBtn} href={inv.url}>
                    View
                  </a>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.note}>No invoices yet.</p>
        )}
        <p className={styles.note}>Our prices include VAT. Need a formal VAT invoice? Use &ldquo;Request a VAT invoice&rdquo; above.</p>
      </section>

      {/* Payment card, one-tap booking and data controls — full self-management. */}
      <section className={styles.card}>
        <div className={styles.switchHead}>
          <h2 className={styles.h2}>Payment &amp; privacy</h2>
        </div>

        <div className={styles.payRow}>
          <div>
            <strong className={styles.payLabel}>Card on file</strong>
            <span className={styles.payValue}>
              {card ? `${card.brand.charAt(0).toUpperCase() + card.brand.slice(1)} •••• ${card.last4}${card.exp && card.exp !== '/' ? ` · exp ${card.exp}` : ''}` : 'No card saved.'}
            </span>
          </div>
          <CardUpdate onDone={() => {
            refresh();
            loadCard();
          }} />
        </div>

        <div className={styles.payRow}>
          <div>
            <strong className={styles.payLabel}>Instant book (one-tap pay)</strong>
            <span className={styles.payValue}>
              {instantOff
                ? 'Off — we won’t use your saved card; you’ll enter it each time.'
                : 'On — pay for extra room time or a day pass in one tap, using the card above (you always confirm and see the card).'}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleInstant} disabled={payBusy}>
            {instantOff ? 'Turn on' : 'Turn off'}
          </Button>
        </div>

        <div className={styles.payRow}>
          <div>
            <strong className={styles.payLabel}>Delete account &amp; data</strong>
            <span className={styles.payValue}>
              Remove your card and erase your data with us. As your card may fund a live membership, our team completes this with you.
            </span>
          </div>
          {confirmDelete ? (
            <div className={styles.confirmActions}>
              <Button variant="secondary" size="sm" onClick={doRequestDeletion} disabled={payBusy}>
                {payBusy ? 'Sending…' : 'Confirm request'}
              </Button>
              <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(false)} disabled={payBusy}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={styles.linkBtn} onClick={() => setConfirmDelete(true)}>
              Request deletion
            </button>
          )}
        </div>

        {payMsg ? <p className={styles.done}>{payMsg}</p> : null}
      </section>
    </div>
  );
}
