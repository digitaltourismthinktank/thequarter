'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Input } from '@/components/ds/Input';
import { Button } from '@/components/ds/Button';
import { Badge } from '@/components/ds/Badge';
import { Icon } from '@/components/ds/Icon';
import { PHOTOS } from '@/lib/media';
import { getMemberstack, memberstackError } from '@/lib/memberstack';
import { isAdminEmail } from '@/lib/admin';
import styles from './AuthScreen.module.css';

/* The Quarter — member auth (login / sign up / password reset) via Memberstack.
   On-brand custom UI over the DOM SDK. On success, routes to /dashboard. */

type Status = 'idle' | 'submitting' | 'error' | 'sent';

export function AuthScreen({
  mode,
  badge,
  heading,
  subtitle,
  intro,
  collectCompany = false,
}: {
  mode: 'login' | 'signup';
  /** Override the gold eyebrow badge (e.g. the team-enrolment page). */
  badge?: string;
  /** Override the H1. */
  heading?: string;
  /** Override the subtitle line. */
  subtitle?: string;
  /** Optional branded intro node rendered between the subtitle and the form. */
  intro?: ReactNode;
  /** Signup only: also capture the member's company so admin can group their team. */
  collectCompany?: boolean;
}) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const [view, setView] = useState<'main' | 'forgot'>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  // Pre-fill the email from ?email= — the post-purchase "Create your account" CTAs
  // (Day Pass / room / carnet confirmations) link here with the buyer's email so their
  // guest booking or passes attach to the right account. Read client-side (like the
  // ?redirect param below) to stay compatible with the static export. Signup only.
  useEffect(() => {
    if (isLogin || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pre = params.get('email');
    if (pre && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pre)) setEmail(pre);
    const first = params.get('first');
    if (first && first.trim()) setFirstName(first);
    const last = params.get('last');
    if (last && last.trim()) setLastName(last);
    const prefPhone = params.get('phone');
    if (prefPhone && prefPhone.trim()) setPhone(prefPhone);
    // Team-enrolment links can pre-fill the company (e.g. /enrol?company=Acme).
    const prefCompany = params.get('company');
    if (prefCompany && prefCompany.trim()) setCompany(prefCompany);
  }, [isLogin]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    if (!isLogin && (!firstName.trim() || !lastName.trim())) {
      setStatus('error');
      setError('Please enter your first and last name.');
      return;
    }
    if (!isLogin && !phone.trim()) {
      setStatus('error');
      setError('Please add a phone number so we can reach you.');
      return;
    }
    if (!isLogin && !agree) {
      setStatus('error');
      setError('Please accept the Terms & Code of Conduct to continue.');
      return;
    }
    setStatus('submitting');
    setError('');
    const ms = await getMemberstack();
    if (!ms) {
      setStatus('error');
      setError('Could not reach the member service. Please try again.');
      return;
    }
    try {
      if (isLogin) {
        await ms.loginMemberEmailPassword({ email, password });
      } else {
        await ms.signupMemberEmailPassword({
          email,
          password,
          customFields: { 'first-name': firstName.trim() || undefined, 'last-name': lastName.trim() || undefined },
          metaData: {
            phone: phone.trim(),
            termsAcceptedAt: new Date().toISOString(),
            name: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
            // Soft team grouping — stored on metaData.company (read by admin + member-profile).
            ...(collectCompany && company.trim() ? { company: company.trim() } : {}),
          },
        });
      }
      // Client-side navigation keeps the just-authenticated Memberstack instance
      // in memory; a full page reload raced session restore and bounced to /login.
      // Staff land straight on the admin page (they can switch to the member view).
      // A ?redirect=/path (same-origin only) returns the member where they came from —
      // e.g. the arrival screen sends them back to finish checking in.
      const wanted = new URLSearchParams(window.location.search).get('redirect');
      const safe = wanted && wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : null;
      const dest = safe ?? (isAdminEmail(email) ? '/admin' : '/dashboard');
      router.push(dest);
    } catch (err) {
      setStatus('error');
      setError(memberstackError(err));
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setError('');
    const ms = await getMemberstack();
    if (!ms) {
      setStatus('error');
      setError('Could not reach the member service. Please try again.');
      return;
    }
    try {
      await ms.sendMemberResetPasswordEmail({ email });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(memberstackError(err));
    }
  }

  const reset = () => {
    setStatus('idle');
    setError('');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.panelInner}>
          {view === 'forgot' ? (
            <>
              <Badge tone="gold">Reset password</Badge>
              <h1 className={styles.title}>Forgotten your password?</h1>
              <p className={styles.subtitle}>Enter your email and we&rsquo;ll send you a reset link.</p>
              {status === 'sent' ? (
                <p className={styles.info}>
                  <Icon name="check" size={16} color="var(--gold-700)" /> Check your inbox for the reset link.
                </p>
              ) : (
                <form className={styles.fields} onSubmit={handleForgot}>
                  <Input
                    label="Email"
                    type="email"
                    icon="user"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  {status === 'error' ? <p className={styles.error}>{error}</p> : null}
                  <Button type="submit" variant="primary" fullWidth disabled={status === 'submitting'} iconAfter="arrow-right">
                    {status === 'submitting' ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>
              )}
              <p className={styles.alt}>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setView('main');
                    reset();
                  }}
                >
                  Back to sign in
                </button>
              </p>
            </>
          ) : (
            <>
              <Badge tone="gold">{badge ?? (isLogin ? 'Welcome back' : 'Join The Quarter')}</Badge>
              <h1 className={styles.title}>{heading ?? (isLogin ? 'Member login' : 'Create your account')}</h1>
              <p className={styles.subtitle}>
                {subtitle ??
                  (isLogin
                    ? 'Sign in to see your plan, book a room and redeem your perks.'
                    : 'Set up your member account to manage your plan, bookings and perks.')}
              </p>
              {intro ? <div className={styles.intro}>{intro}</div> : null}
              <form className={styles.fields} onSubmit={handleAuth}>
                {!isLogin ? (
                  <div className={styles.row}>
                    <Input
                      label="First name"
                      placeholder="Maya"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                    <Input
                      label="Last name"
                      placeholder="Holloway"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                ) : null}
                {!isLogin && collectCompany ? (
                  <Input
                    label="Company"
                    icon="building"
                    placeholder="Acme Studios"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    autoComplete="organization"
                  />
                ) : null}
                {!isLogin ? (
                  <Input
                    label="Phone"
                    type="tel"
                    icon="phone"
                    placeholder="07700 900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    required
                  />
                ) : null}
                <Input
                  label="Email"
                  type="email"
                  icon="user"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
                {isLogin ? (
                  <div className={styles.forgot}>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        setView('forgot');
                        reset();
                      }}
                    >
                      Forgotten password?
                    </button>
                  </div>
                ) : null}
                {!isLogin ? (
                  <label className={styles.agree}>
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span>
                      I agree to the{' '}
                      <a href="/terms" target="_blank" rel="noreferrer">
                        Terms of Membership
                      </a>{' '}
                      &amp;{' '}
                      <a href="/code-of-conduct" target="_blank" rel="noreferrer">
                        Code of Conduct
                      </a>
                      .
                    </span>
                  </label>
                ) : null}
                {status === 'error' ? <p className={styles.error}>{error}</p> : null}
                <Button type="submit" variant="primary" fullWidth disabled={status === 'submitting' || (!isLogin && !agree)} iconAfter="arrow-right">
                  {status === 'submitting'
                    ? isLogin
                      ? 'Signing in…'
                      : 'Creating…'
                    : isLogin
                      ? 'Sign in'
                      : 'Create account'}
                </Button>
              </form>
              <div className={styles.divider}>
                <span /> or <span />
              </div>
              <p className={styles.alt}>
                {isLogin ? (
                  <>
                    New here? <a href="/day-pass">Book a Day Pass</a> to get started.
                  </>
                ) : (
                  <>
                    Already a member? <a href="/login">Sign in</a>.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      <div className={styles.media}>
        <Image src={PHOTOS.mainSpaceWide.src} alt={PHOTOS.mainSpaceWide.alt} fill sizes="(max-width: 860px) 0px, 50vw" className={styles.mediaImg} />
      </div>
    </div>
  );
}
