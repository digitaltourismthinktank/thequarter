/**
 * Haptics and sound — the small physical cues that make a web app feel less like a page.
 *
 * HAPTICS, HONESTLY: `navigator.vibrate` works on Android (Chrome, Firefox, Samsung
 * Internet) and is NOT implemented in Safari on iOS, in the browser or in an installed PWA.
 * Apple has never shipped it. So on an iPhone every call here is a no-op — the code is safe
 * and does nothing. There is a known trick using an off-screen `<input type="checkbox"
 * switch>` (iOS 17.4+ plays a system haptic when a switch toggles), but it depends on an
 * undocumented side-effect of a UI control, needs a real element in the DOM to fake-click,
 * and Apple can take it away in a point release. Deliberately not used — see the note in
 * the account screen instead, which tells members the truth.
 *
 * SOUND: synthesised with the Web Audio API rather than shipped as audio files — a chime
 * is a few sine tones, and this way there is nothing to download, nothing to cache and no
 * request to make. Browsers refuse to start audio until the user has interacted with the
 * page, so the context is created lazily on first use and resumed on the first gesture.
 */

const MUTE_KEY = 'q-sound-off';

export function soundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundMuted(off: boolean): void {
  try {
    if (off) window.localStorage.setItem(MUTE_KEY, '1');
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    /* private mode — the preference just won't persist */
  }
}

/** A short vibration. No-op where unsupported, which includes every iPhone. */
export function haptic(pattern: number | number[] = 8): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

type Ctx = AudioContext & { __quarterUnlocked?: boolean };
let ctx: Ctx | null = null;

function audioContext(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor() as Ctx;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/**
 * Call once from a real user gesture (a tap) so the audio context is allowed to start.
 * Without this the first chime after page load is silently dropped by the browser.
 */
export function unlockSound(): void {
  const c = audioContext();
  if (!c || c.__quarterUnlocked) return;
  c.__quarterUnlocked = true;
  // A zero-gain blip: enough to satisfy the autoplay gate, inaudible.
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

/** One soft sine note with a gentle bell envelope — no click on attack, long-ish tail. */
function note(c: AudioContext, freq: number, startAt: number, dur: number, peak: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = c.currentTime + startAt;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.015); // fast but not instant = no click
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Chime = 'success' | 'attention' | 'arrive';

/* Intervals chosen to sit well together and not sound like an alert: a rising major third
   for something good, a rising fourth for "come and look", a soft fifth for an arrival.
   Kept quiet — this plays in a room with other people working in it. */
const CHIMES: Record<Chime, { freqs: number[]; gap: number; peak: number }> = {
  success: { freqs: [784, 988], gap: 0.09, peak: 0.1 }, // G5 → B5
  attention: { freqs: [659, 880], gap: 0.1, peak: 0.12 }, // E5 → A5
  arrive: { freqs: [587, 880], gap: 0.11, peak: 0.09 }, // D5 → A5
};

export function playChime(kind: Chime = 'success'): void {
  if (soundMuted()) return;
  const c = audioContext();
  if (!c) return;
  const { freqs, gap, peak } = CHIMES[kind];
  freqs.forEach((f, i) => note(c, f, i * gap, 0.5, peak));
}
