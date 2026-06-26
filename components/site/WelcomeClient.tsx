'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { getMemberstack, memberstackError } from '@/lib/memberstack';
import { PLANS, PLAN_MEMBERSTACK_ID, PLAN_DAY_ALLOWANCE, type PlanId } from '@/lib/plans';
import { getWelcomeSession } from '@/lib/booking';
import styles from './WelcomeClient.module.css';

/**
 * Post-payment onboarding. Pre-fills the email the member paid with (from the
 * Stripe Checkout Session) so their Memberstack email matches Stripe, creates the
 * account, tags the plan, and seeds the starting day allowance.
 */
export function WelcomeClient({ plan }: { plan: string }) {
  const router = useRouter();
  const slug = plan as PlanId;
  const planDef = PLANS.find((p) => p.id === slug);
  const plnId = PLAN_MEMBERSTACK_ID[slug];
  const allowance = PLAN_DAY_ALLOWANCE[slug];

  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get('session_id');
    if (!sid) return;
    let active = true;
    (async () => {
      const r = await getWelcomeSession(sid);
      if (active && r.ok && r.data.email) {
        setEmail(r.data.email);
        setEmailLocked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (!email || !password) {
      setError('Please enter your email and a password.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ms = await getMemberstack();
      if (!ms) {
        setError('Sign-up is unavailable right now — please try again shortly.');
        setBusy(false);
        return;
      }
      const customFields: Record<string, string> = {};
      if (firstName) customFields['first-name'] = firstName;
      if (lastName) customFields['last-name'] = lastName;
      if (allowance !== undefined) customFields['days-remaining'] = allowance === null ? 'Unlimited' : String(allowance);
      await ms.signupMemberEmailPassword({ email, password, plans: plnId ? [{ planId: plnId }] : [], customFields });
      router.push('/dashboard');
    } catch (err) {
      setError(memberstackError(err));
      setBusy(false);
    }
  }

  if (!planDef) {
    return (
      <p className={styles.state}>
        We couldn&rsquo;t find that plan. <a href="/plans">See plans</a>.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.eyebrow}>Welcome to The Quarter</span>
      <h1 className={styles.title}>You&rsquo;re in — let&rsquo;s set up your account</h1>
      <p className={styles.sub}>
        You&rsquo;ve joined the <strong>{planDef.name}</strong> plan ({planDef.price} · {planDef.period}). Create your login to reach
        your dashboard, door code, days and booking.
      </p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={emailLocked} autoComplete="email" />
        </label>
        <p className={styles.hint}>
          {emailLocked ? 'This is the email you paid with — keep it so everything stays in sync.' : 'Use the same email you paid with.'}
        </p>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </label>
          <label className={styles.field}>
            <span>Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </label>
        </div>

        <label className={styles.field}>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}
        <Button variant="primary" onClick={submit} disabled={busy}>
          {busy ? 'Creating your account…' : 'Create my account'}
        </Button>
      </div>

      <p className={styles.alt}>
        Already have an account? <a href="/login">Log in</a>.
      </p>
    </div>
  );
}
