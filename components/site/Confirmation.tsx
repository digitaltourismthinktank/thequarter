import type { ReactNode } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon, type IconName } from '@/components/ds/Icon';
import s from './Confirmation.module.css';

/**
 * Shared post-purchase confirmation. One elegant, official look for every "done"
 * state (Day Pass, meeting room, day-pass carnet): a gold success mark, a tidy
 * summary card of exactly what was booked/bought, the amount paid, an
 * "we've emailed your confirmation to <email>" line, and an optional
 * "Create your account" CTA (which pre-fills the email on /signup — see signupHref).
 */

export type ConfirmationRow = {
  icon?: IconName;
  label: string;
  value: ReactNode;
};

export type ConfirmationAccount = {
  heading: string;
  body: ReactNode;
  cta: string;
  href: string;
};

export function Confirmation({
  eyebrow,
  title,
  intro,
  rows,
  amount,
  email,
  emailNote,
  account,
  footnote,
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  rows: ConfirmationRow[];
  amount?: string;
  /** When set, renders the "we've emailed your confirmation to <email>" line. */
  email?: string;
  /** Override the default emailed-to sentence (e.g. "receipt" for a carnet). */
  emailNote?: ReactNode;
  /** The create-account block; pass null to omit (e.g. an already-logged-in member). */
  account?: ConfirmationAccount | null;
  footnote?: ReactNode;
}) {
  return (
    <div className={s.wrap}>
      <span className={s.mark} aria-hidden="true">
        <Icon name="check" size={30} color="var(--pure-white)" />
      </span>

      {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
      <h3 className={s.title}>{title}</h3>
      {intro ? <p className={s.intro}>{intro}</p> : null}

      <div className={s.card}>
        <dl className={s.rows}>
          {rows.map((r, i) => (
            <div key={i} className={s.row}>
              <dt className={s.rowLabel}>
                {r.icon ? <Icon name={r.icon} size={15} color="var(--gold-700)" /> : null}
                {r.label}
              </dt>
              <dd className={s.rowValue}>{r.value}</dd>
            </div>
          ))}
        </dl>
        {amount ? (
          <div className={s.amount}>
            <span>Amount paid</span>
            <span className={s.amountValue}>{amount}</span>
          </div>
        ) : null}
      </div>

      {email ? (
        <p className={s.emailed}>
          <Icon name="mail" size={15} color="var(--text-muted)" />
          <span>{emailNote ?? <>We&rsquo;ve emailed your confirmation to <strong>{email}</strong>.</>}</span>
        </p>
      ) : null}

      {account ? (
        <div className={s.account}>
          <p className={s.accountHeading}>{account.heading}</p>
          <p className={s.accountBody}>{account.body}</p>
          <Button variant="accent" href={account.href} iconAfter="arrow-right" fullWidth>
            {account.cta}
          </Button>
        </div>
      ) : null}

      {footnote ? <p className={s.footnote}>{footnote}</p> : null}
    </div>
  );
}

/**
 * /signup with the buyer's details pre-filled (AuthScreen reads ?email=&first=&last=&phone=).
 * email is included when present; first/last/phone are appended only when non-empty. Always
 * returns a `/signup?…` (or bare `/signup`) so existing email-only callers keep working.
 */
export function signupHref(email?: string, opts?: { firstName?: string; lastName?: string; phone?: string }): string {
  const params: string[] = [];
  const e = (email || '').trim();
  if (e) params.push(`email=${encodeURIComponent(e)}`);
  const first = (opts?.firstName || '').trim();
  if (first) params.push(`first=${encodeURIComponent(first)}`);
  const last = (opts?.lastName || '').trim();
  if (last) params.push(`last=${encodeURIComponent(last)}`);
  const phone = (opts?.phone || '').trim();
  if (phone) params.push(`phone=${encodeURIComponent(phone)}`);
  return params.length ? `/signup?${params.join('&')}` : '/signup';
}
