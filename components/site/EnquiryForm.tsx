'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { MEETING_ROOMS } from '@/lib/rooms';
import { cn } from '@/lib/cn';
import styles from './EnquiryForm.module.css';

/* The Quarter — enquiry / contact form.
   Submits to Netlify Forms (no backend). The <form> is pre-rendered into the
   static HTML so Netlify detects it at deploy; JS enhances it with an AJAX
   submit + inline success state, and it still works without JS as a normal POST.
   PHASE-2 SEAM: swap the submit handler for a live booking/CRM endpoint. */

export interface EnquiryFormProps {
  formName?: string;
  defaultRoom?: string;
  withRoom?: boolean;
  className?: string;
}

export function EnquiryForm({ formName = 'room-enquiry', defaultRoom = '', withRoom = true, className }: EnquiryFormProps) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set('form-name', formName);
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      setStatus('done');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className={cn(styles.success, className)}>
        <span className={styles.successIcon}>
          <Icon name="check" size={28} color="var(--gold-700)" strokeWidth={2.5} />
        </span>
        <h3 className={styles.successTitle}>Thank you — message received</h3>
        <p className={styles.successText}>
          We&rsquo;ll be in touch shortly to confirm the details. In the meantime, the kettle&rsquo;s on.
        </p>
      </div>
    );
  }

  return (
    <form
      name={formName}
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      onSubmit={handleSubmit}
      className={cn(styles.form, className)}
    >
      {/* Netlify needs form-name in the POST body; honeypot catches bots. */}
      <input type="hidden" name="form-name" value={formName} />
      <p className={styles.hp}>
        <label>
          Don&rsquo;t fill this out if you&rsquo;re human: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="enq-name">
            Your name
          </label>
          <input id="enq-name" className={styles.input} type="text" name="name" required placeholder="Maya Holloway" />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="enq-email">
            Email
          </label>
          <input id="enq-email" className={styles.input} type="email" name="email" required placeholder="you@company.com" />
        </div>
      </div>

      <div className={styles.row}>
        {withRoom ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="enq-room">
              Room
            </label>
            <select id="enq-room" className={styles.select} name="room" defaultValue={defaultRoom}>
              <option value="">Not sure yet</option>
              {MEETING_ROOMS.map((r) => (
                <option key={r.slug} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="enq-company">
              Company <span className={styles.optional}>(optional)</span>
            </label>
            <input id="enq-company" className={styles.input} type="text" name="company" placeholder="Studio Holloway" />
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="enq-preferred">
            Preferred date &amp; time
          </label>
          <input id="enq-preferred" className={styles.input} type="text" name="preferred" placeholder="e.g. Thu 25 Jun, afternoon" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="enq-message">
          Anything else?
        </label>
        <textarea
          id="enq-message"
          className={styles.textarea}
          name="message"
          rows={4}
          placeholder="Party size, catering, A/V needs — tell us what would make it perfect."
        />
      </div>

      {status === 'error' ? (
        <p className={styles.errorMsg}>Something went wrong sending that. Please try again, or email hello@thequarter.example.</p>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" variant="accent" iconAfter="arrow-right" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending…' : 'Send enquiry'}
        </Button>
        <span className={styles.assurance}>We reply within one working day.</span>
      </div>
    </form>
  );
}
