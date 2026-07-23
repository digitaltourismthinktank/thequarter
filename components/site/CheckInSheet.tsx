'use client';

import { useEffect, useState } from 'react';
import { getCheckinToday, type CheckinStatus } from '@/lib/booking';
import { DaySheet, type DaySheetDay } from './DaySheet';

/**
 * The check-in sheet behind the tab bar's centre button. A sheet rather than a page so a
 * member can check in from wherever they are without losing their place — checking in is
 * the one thing they do every day.
 *
 * It reads today's state and then hands over to DaySheet, which owns every question we ask about a
 * single day. This used to be a second, parallel implementation with its own full/half pills, its
 * own change buttons and its own wording, and the two drifted: only one of them ever told you what
 * a day cost. One sheet, asked the same way, wherever you came from.
 */
export function CheckInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const r = await getCheckinToday();
    if (r.ok) setStatus(r.data);
    setLoaded(true);
  }

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setStatus(null);
    load();
  }, [open]);

  if (!open) return null;

  const today = status?.date ?? new Date().toISOString().slice(0, 10);
  // Today's row, if there is one: a booking made earlier, or the check-in itself. Its presence is
  // what turns the sheet from "check in" into "here's your day — change it or cancel it".
  const mine = (status?.planned ?? []).find((p) => p.date === today);
  const existing: DaySheetDay | null = mine
    ? { ...mine, in: mine.in || !!status?.checkedIn }
    : status?.checkedIn
      ? { id: '', date: today, length: status.length === 'Half' ? 'Half' : 'Full', period: status.period ?? null, in: true }
      : null;

  // Wait for the read before deciding which question to ask — opening in "check in?" mode and then
  // flipping to "you're already in" would be a worse lie than a half-second of nothing.
  if (!loaded) return null;

  return <DaySheet open date={today} existing={existing} checkinNow={!existing} onClose={onClose} onChanged={load} />;
}
