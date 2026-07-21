'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/ds/Icon';
import {
  commsIndex, commsPreview, commsTest, commsSend, commsDismiss, commsDismissAllWelcome, commsPush,
  adminGetEvents, adminCreateEvent, adminDeleteEvent,
  type CommsIndex, type CommsTodoThank, type CommsTodoMember, type QuarterEvent,
} from '@/lib/booking';
import styles from './CommsPane.module.css';

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
/** A date-only day label from a YYYY-MM-DD or full-ISO string. */
const fmtDay = (iso: string) => fmt(iso.slice(0, 10));
/** "Mon 21 Jul" for a single day, or "… – …" for a range. */
const annWindow = (a: QuarterEvent) => {
  if (!a.start) return '—';
  const f = fmtDay(a.start);
  const t = a.end ? fmtDay(a.end) : f;
  return f === t ? f : `${f} – ${t}`;
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

  /* call() reports the HTTP status, and these handlers answer 200 with ok:false in the body
     when a send is rejected — so the transport succeeded and the send did not. Both have to
     be true before we tell someone their email went. */
  const sent = (r: { ok: boolean; data?: { ok?: boolean } }) => r.ok && r.data?.ok !== false;

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

  // One-tap To-Do sends go through this confirm first (with an optional "See it" preview).
  const [confirmSend, setConfirmSend] = useState<{ who: string; what: string; templateId: string; name?: string; visitDate?: string; run: () => Promise<void> } | null>(null);

  // Welcome-screen announcements — stored as unpublished Category='Announcement' events, so
  // they never leak onto the public what's-on or the .ics feed (both filter {Published}).
  const [anns, setAnns] = useState<QuarterEvent[]>([]);
  const [annText, setAnnText] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annFrom, setAnnFrom] = useState('');
  const [annTo, setAnnTo] = useState('');

  const load = useCallback(async () => {
    const r = await commsIndex();
    if (r.ok) setData(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadAnns = useCallback(async () => {
    const r = await adminGetEvents();
    if (r.ok) setAnns(r.data.events.filter((e) => e.category === 'Announcement'));
  }, []);
  useEffect(() => { loadAnns(); }, [loadAnns]);

  const tpl = data?.templates.find((t) => t.id === templateId) || null;
  const needsEvent = tpl?.audience === 'event' || audience === 'event-rsvps' || audience === 'members-not-rsvpd';

  // The To-Do sends are one-tap and irreversible, so they open a confirm first — with a
  // "See it" that renders the real email — rather than firing on the first click.
  async function actuallyThank(v: CommsTodoThank, withReview: boolean) {
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
    setNote(sent(r) ? `Thanked ${v.name || v.email}.` : 'That didn’t send — it stays on the list, so nothing is lost.');
    load();
  }
  function thank(v: CommsTodoThank, withReview: boolean) {
    setConfirmSend({
      who: v.name || v.email,
      what: withReview ? 'Thank-you + review request' : 'Thank-you',
      templateId: withReview ? 'thanks-review' : 'thanks-only',
      name: v.name || undefined,
      visitDate: v.date,
      run: () => actuallyThank(v, withReview),
    });
  }

  async function skipVisit(v: CommsTodoThank) {
    setBusy(v.id);
    await commsDismiss({ visitId: v.id });
    setBusy(null);
    load();
  }

  async function actuallySendOnce(m: CommsTodoMember, id: string) {
    setBusy(m.id);
    const r = await commsSend({ templateId: id, audience: 'explicit', emails: [m.email] });
    setBusy(null);
    setNote(sent(r) ? `Sent to ${m.name || m.email}.` : 'That didn’t send — try again.');
    load();
  }
  function sendOnce(m: CommsTodoMember, id: string) {
    setConfirmSend({
      who: m.name || m.email,
      what: id === 'welcome' ? 'Welcome email' : 'Rewards intro',
      templateId: id,
      name: m.name || undefined,
      run: () => actuallySendOnce(m, id),
    });
  }

  /** Preview the pending To-Do email in the existing preview modal. */
  async function seeConfirm() {
    if (!confirmSend) return;
    const r = await commsPreview({ templateId: confirmSend.templateId, name: confirmSend.name, visitDate: confirmSend.visitDate });
    if (r.ok) setPreview({ subject: r.data.subject, html: r.data.html });
  }

  /** Stamp the whole welcome back-catalogue as handled, so the To-Do only shows new members. */
  async function clearWelcomeBacklog() {
    setBusy('clearWelcome');
    const r = await commsDismissAllWelcome();
    setBusy(null);
    setNote(r.ok ? `Cleared ${r.data.cleared} from the welcome list.` : 'Could not clear those.');
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
    setNote(sent(r) ? `Test sent to ${r.data.sentTo}.` : 'Test didn’t send — check the Resend key.');
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
    setNote(sent(r) ? `Sent to ${r.data.sent} ${r.data.sent === 1 ? 'person' : 'people'}.` : `Sent ${r.data?.sent ?? 0}, ${r.data?.failed ?? 0} failed — nobody was marked as contacted.`);
    load();
  }

  async function doPush(email?: string) {
    if (!pushMsg.trim()) { setNote('Write the message first.'); return; }
    setBusy('push');
    const r = await commsPush({ title: pushTitle, message: pushMsg, email });
    setBusy(null);
    setNote(sent(r) ? `Pinged ${r.data.sent} ${r.data.sent === 1 ? 'person' : 'people'}.` : 'That didn’t go.');
    if (!email) setPushMsg('');
  }

  async function addAnnouncement() {
    if (!annText.trim() || !annFrom) { setNote('Add the message and a start date.'); return; }
    if (annTo && annTo < annFrom) { setNote('The end date can’t be before the start.'); return; }
    setBusy('ann');
    // published:false keeps it off every public event surface; the screen reads it by category.
    const r = await adminCreateEvent({
      title: annText.trim(),
      description: annBody.trim() || undefined,
      start: annFrom,
      end: annTo || annFrom,
      category: 'Announcement',
      published: false,
    });
    setBusy(null);
    if (r.ok) {
      setAnnText(''); setAnnBody(''); setAnnFrom(''); setAnnTo('');
      setNote('Announcement scheduled.');
      loadAnns();
    } else {
      setNote('Could not save that announcement.');
    }
  }

  async function removeAnnouncement(id: string) {
    setBusy(id);
    await adminDeleteEvent(id);
    setBusy(null);
    loadAnns();
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

        {data.todo.welcome.length > 1 ? (
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span>{data.todo.welcome.length} members have never had a welcome. If most aren’t new, clear the back-catalogue and keep only genuinely new ones from here.</span>
            </div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.ghost} onClick={clearWelcomeBacklog} disabled={busy === 'clearWelcome'}>
                {busy === 'clearWelcome' ? 'Clearing…' : 'Mark all as welcomed'}
              </button>
            </div>
          </div>
        ) : null}

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

      {/* -------------------------------------------- welcome-screen announcement -- */}
      <div className={styles.panel}>
        <span className={styles.panelTitle}>Welcome-screen announcement</span>
        <p className={styles.muted}>
          A note shown on the entrance display for a date range — a national day, a one-off change. It stays off the public what’s-on and the calendar feed.
        </p>

        <label className={styles.field}>
          <span>Message</span>
          <input className={styles.input} placeholder="Today we’re celebrating Belgian National Day 🇧🇪" value={annText} onChange={(e) => setAnnText(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Second line (optional)</span>
          <input className={styles.input} placeholder="Waffles in the Pantry from 11" value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
        </label>
        <div className={styles.annDates}>
          <label className={styles.field}>
            <span>From</span>
            <input className={styles.input} type="date" value={annFrom} onChange={(e) => setAnnFrom(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span>To (optional)</span>
            <input className={styles.input} type="date" value={annTo} onChange={(e) => setAnnTo(e.target.value)} />
          </label>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={addAnnouncement} disabled={busy === 'ann'}>
            {busy === 'ann' ? 'Scheduling…' : 'Schedule announcement'}
          </button>
        </div>

        {anns.length ? (
          <div className={styles.annList}>
            {anns.map((a) => (
              <div key={a.id} className={styles.row}>
                <div className={styles.rowText}>
                  <strong>{a.title}</strong>
                  <span>{annWindow(a)}{a.description ? ` · ${a.description}` : ''}</span>
                </div>
                <button type="button" className={styles.x} onClick={() => removeAnnouncement(a.id)} disabled={busy === a.id} aria-label="Remove announcement">×</button>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.muted}>No announcements scheduled.</p>
        )}
      </div>

      {/* --------------------------------------------------------------- modals --- */}
      {/* Rendered before the preview modal so "See it" stacks its preview on top of this. */}
      {confirmSend ? (
        <div className={styles.overlay} onClick={() => setConfirmSend(null)} role="dialog" aria-modal="true">
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmBody}>
              <span className={styles.warnIcon}><Icon name="mail" size={22} color="var(--ink-900)" /></span>
              <h3 className={styles.confirmTitle}>Send the {confirmSend.what.toLowerCase()} to {confirmSend.who}?</h3>
              <p className={styles.muted}>It goes out as soon as you confirm. Have a look first if you’d like.</p>
              <div className={styles.actions}>
                <button type="button" className={styles.ghost} onClick={seeConfirm}>See it</button>
                <button type="button" className={styles.ghost} onClick={() => setConfirmSend(null)}>Not yet</button>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={async () => {
                    const run = confirmSend.run;
                    setConfirmSend(null);
                    await run();
                  }}
                >
                  Send it
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
