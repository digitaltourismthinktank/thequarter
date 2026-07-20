'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import {
  commsIndex, commsPreview, commsTest, commsSend, commsDismiss, commsPush,
  type CommsIndex, type CommsTodoThank, type CommsTodoMember,
} from '@/lib/booking';
import styles from './CommsPane.module.css';

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

/**
 * Admin → Comms. Three things, in the order they matter.
 *
 * 1. TO DO — the queue. A day-pass visitor to thank, a new member who hasn't had the
 *    welcome. This is the whole point of the feature: it turns "we should really keep in
 *    touch" into a list that empties. Every row is cleared by acting OR by explicitly
 *    letting it go, so nothing lingers as a vague guilt.
 * 2. SEND TO A GROUP — the deliberate, occasional, slightly dangerous one.
 * 3. RIGHT NOW — push to whoever is in the building.
 *
 * The safety rules are the interesting part of the design. Sending is irreversible, so a
 * group send cannot happen in one click: you name the audience, you see the real count
 * from the server, and you confirm. The count is never computed in the browser — a stale
 * tab must not be able to mail the wrong list.
 */
export function CommsPane() {
  const [data, setData] = useState<CommsIndex | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Group send
  const [templateId, setTemplateId] = useState('');
  const [audience, setAudience] = useState('members-active');
  const [eventId, setEventId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<{ count: number; sample: string[]; skipped: number } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  // Push
  const [pushTitle, setPushTitle] = useState('In the Pantry today');
  const [pushMsg, setPushMsg] = useState('');

  const load = useCallback(async () => {
    const r = await commsIndex();
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const tpl = data?.templates.find((t) => t.id === templateId) || null;
  const needsEvent = tpl?.audience === 'event' || audience === 'event-rsvps' || audience === 'members-not-rsvpd';

  async function thank(v: CommsTodoThank, withReview: boolean) {
    setBusy(v.id);
    const r = await commsSend({
      templateId: withReview ? 'thanks-review' : 'thanks-only',
      audience: 'explicit',
      emails: [v.email],
      name: v.name || undefined,
      visitDate: v.date,
      markVisitIds: [v.id],
    });
    setBusy(null);
    setNote(r.ok ? `Thanked ${v.name || v.email}.` : 'That didn’t send — try again.');
    load();
  }

  async function skipVisit(v: CommsTodoThank) {
    setBusy(v.id);
    await commsDismiss({ visitId: v.id });
    setBusy(null);
    load();
  }

  async function sendOnce(m: CommsTodoMember, id: string) {
    setBusy(m.id);
    const r = await commsSend({ templateId: id, audience: 'explicit', emails: [m.email] });
    setBusy(null);
    setNote(r.ok ? `Sent to ${m.name || m.email}.` : 'That didn’t send — try again.');
    load();
  }

  async function skipOnce(m: CommsTodoMember, id: string) {
    setBusy(m.id);
    await commsDismiss({ memberId: m.id, templateId: id });
    setBusy(null);
    load();
  }

  async function doPreview() {
    const r = await commsPreview({ templateId, eventId, subject, message });
    if (r.ok) setPreview({ subject: r.data.subject, html: r.data.html });
  }

  async function doTest() {
    setBusy('test');
    const r = await commsTest({ templateId, eventId, subject, message });
    setBusy(null);
    setNote(r.ok ? `Test sent to ${r.data.sentTo}.` : 'Test didn’t send.');
  }

  /** Never sends. Asks the server who this would actually reach, then shows the confirm. */
  async function askWhoGetsIt() {
    setBusy('dry');
    const r = await commsSend({ templateId, audience, eventId, subject, message, dryRun: true });
    setBusy(null);
    if (!r.ok) { setNote('Could not work out the recipients.'); return; }
    setConfirm({ count: r.data.count ?? 0, sample: r.data.sample ?? [], skipped: r.data.skippedAlreadySent ?? 0 });
  }

  async function reallySend() {
    setBusy('send');
    const r = await commsSend({ templateId, audience, eventId, subject, message });
    setBusy(null);
    setConfirm(null);
    setNote(r.ok ? `Sent to ${r.data.sent} ${r.data.sent === 1 ? 'person' : 'people'}.` : `Sent ${r.data?.sent ?? 0}, ${r.data?.failed ?? 0} failed.`);
    load();
  }

  async function doPush(email?: string) {
    if (!pushMsg.trim()) { setNote('Write the message first.'); return; }
    setBusy('push');
    const r = await commsPush({ title: pushTitle, message: pushMsg, email });
    setBusy(null);
    setNote(r.ok ? `Pinged ${r.data.sent} ${r.data.sent === 1 ? 'person' : 'people'}.` : 'That didn’t go.');
    if (!email) setPushMsg('');
  }

  if (!data) return <p className={styles.muted}>Loading…</p>;

  const todoCount = data.todo.thank.length + data.todo.welcome.length + data.todo.rewards.length;

  return (
    <div>
      {note ? <div className={styles.note} role="status">{note}<button type="button" onClick={() => setNote(null)} aria-label="Dismiss">×</button></div> : null}

      {/* ------------------------------------------------------------------ to do -- */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>
          To do{todoCount ? ` · ${todoCount}` : ''}
        </span>
        {!todoCount ? (
          <p className={styles.muted}>Nothing waiting. Everyone who has been in has been thanked.</p>
        ) : null}

        {data.todo.thank.map((v) => (
          <div key={v.id} className={styles.row}>
            <div className={styles.rowText}>
              <strong>{v.name || v.email}</strong>
              <span>Day pass · {fmt(v.date)}</span>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.primary} onClick={() => thank(v, true)} disabled={busy === v.id}>
                Thank + ask for review
              </button>
              <button type="button" className={styles.ghost} onClick={() => thank(v, false)} disabled={busy === v.id}>
                Thank only
              </button>
              <button type="button" className={styles.x} onClick={() => skipVisit(v)} disabled={busy === v.id} aria-label="Leave it">×</button>
            </div>
          </div>
        ))}

        {data.todo.welcome.map((m) => (
          <div key={`w-${m.id}`} className={styles.row}>
            <div className={styles.rowText}>
              <strong>{m.name || m.email}</strong>
              <span>New member — no welcome sent</span>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.primary} onClick={() => sendOnce(m, 'welcome')} disabled={busy === m.id}>
                Send welcome
              </button>
              <button type="button" className={styles.x} onClick={() => skipOnce(m, 'welcome')} disabled={busy === m.id} aria-label="Leave it">×</button>
            </div>
          </div>
        ))}

        {data.todo.rewards.map((m) => (
          <div key={`r-${m.id}`} className={styles.row}>
            <div className={styles.rowText}>
              <strong>{m.name || m.email}</strong>
              <span>Settled in — could hear about Rewards</span>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.primary} onClick={() => sendOnce(m, 'rewards-intro')} disabled={busy === m.id}>
                Send rewards intro
              </button>
              <button type="button" className={styles.x} onClick={() => skipOnce(m, 'rewards-intro')} disabled={busy === m.id} aria-label="Leave it">×</button>
            </div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------- send to a group -- */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Send to a group</span>

        <div className={styles.templates}>
          {data.templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`${styles.tpl} ${templateId === t.id ? styles.tplOn : ''}`}
              onClick={() => setTemplateId(t.id)}
            >
              <strong>{t.name}</strong>
              <span>{t.blurb}</span>
              {t.once ? <em className={styles.badge}>once only</em> : null}
              {t.kind === 'marketing' ? <em className={styles.badgeQuiet}>has unsubscribe</em> : null}
            </button>
          ))}
        </div>

        {tpl ? (
          <>
            {tpl.id === 'custom' ? (
              <>
                <label className={styles.field}>
                  <span>Subject</span>
                  <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Message</span>
                  <textarea className={styles.textarea} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
                </label>
              </>
            ) : null}

            <label className={styles.field}>
              <span>Who gets it</span>
              <select className={styles.input} value={audience} onChange={(e) => setAudience(e.target.value)}>
                {data.audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}{a.count != null ? ` · ${a.count}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {needsEvent ? (
              <label className={styles.field}>
                <span>Which event</span>
                <select className={styles.input} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">Choose…</option>
                  {data.events.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className={styles.actions}>
              <button type="button" className={styles.ghost} onClick={doPreview}>See it</button>
              <button type="button" className={styles.ghost} onClick={doTest} disabled={busy === 'test'}>
                {busy === 'test' ? 'Sending…' : 'Send me a test'}
              </button>
              <button type="button" className={styles.primary} onClick={askWhoGetsIt} disabled={busy === 'dry' || (needsEvent && !eventId)}>
                {busy === 'dry' ? 'Checking…' : 'Send to a group…'}
              </button>
            </div>
            {data.optedOut ? (
              <p className={styles.muted}>{data.optedOut} {data.optedOut === 1 ? 'person has' : 'people have'} unsubscribed — they are left out of anything with an unsubscribe link.</p>
            ) : null}
          </>
        ) : (
          <p className={styles.muted}>Pick an email above.</p>
        )}
      </div>

      {/* ----------------------------------------------------------- right now ---- */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Right now · {data.checkedInToday.length} in today</span>
        <label className={styles.field}>
          <span>Heading</span>
          <input className={styles.input} value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Message</span>
          <input
            className={styles.input}
            placeholder="Fresh pastries just out — help yourselves. When they’re gone, they’re gone."
            value={pushMsg}
            onChange={(e) => setPushMsg(e.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => doPush()} disabled={busy === 'push' || !data.checkedInToday.length}>
            Tell everyone in today
          </button>
        </div>

        {data.checkedInToday.length ? (
          <>
            <p className={styles.muted}>Or just one person — for the lock-up reminder, or anything personal.</p>
            <div className={styles.chips}>
              {data.checkedInToday.map((m) => (
                <button key={m.email} type="button" className={styles.chip} onClick={() => doPush(m.email)} disabled={busy === 'push'}>
                  {m.name || m.email}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* --------------------------------------------------------------- modals --- */}
      {preview ? (
        <div className={styles.overlay} onClick={() => setPreview(null)} role="dialog" aria-modal="true">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <strong>{preview.subject}</strong>
              <button type="button" className={styles.x} onClick={() => setPreview(null)} aria-label="Close">×</button>
            </div>
            {/* srcDoc, not innerHTML: the email is a full document and must not inherit or
                pollute the admin's own styles. */}
            <iframe className={styles.frame} srcDoc={preview.html} title="Email preview" sandbox="" />
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className={styles.overlay} onClick={() => setConfirm(null)} role="dialog" aria-modal="true">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmBody}>
              <span className={styles.warnIcon}><Icon name="mail" size={22} color="var(--ink-900)" /></span>
              <h3 className={styles.confirmTitle}>
                Send to {confirm.count} {confirm.count === 1 ? 'person' : 'people'}?
              </h3>
              <p className={styles.muted}>
                This goes out immediately and cannot be recalled.
                {confirm.skipped ? ` ${confirm.skipped} already had this one and will be skipped.` : ''}
              </p>
              {confirm.sample.length ? (
                <p className={styles.sample}>
                  {confirm.sample.join(', ')}{confirm.count > confirm.sample.length ? ` and ${confirm.count - confirm.sample.length} more` : ''}
                </p>
              ) : null}
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={() => setConfirm(null)}>Not yet</button>
                <button type="button" className={styles.primary} onClick={reallySend} disabled={busy === 'send' || confirm.count === 0}>
                  {busy === 'send' ? 'Sending…' : `Yes, send to ${confirm.count}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
