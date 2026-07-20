/**
 * Haptics and sound — the small physical cues that make a web app feel less like a page.
 *
 * HAPTICS: two mechanisms, because the platforms are not equal.
 *
 * Android (Chrome, Firefox, Samsung Internet) implements `navigator.vibrate`. Straightforward.
 *
 * iOS does not, and never has — not in Safari, not in an installed PWA. What it does have,
 * since iOS 17.4, is a system haptic played when a `<label>`-wrapped `<input type="checkbox"
 * switch>` is toggled. Clicking such a label programmatically produces that haptic. This is
 * an undocumented side-effect of a UI control, not an API: Apple could remove it in any
 * point release, and if they do this degrades to silence rather than breaking anything.
 * The switch is hidden from assistive tech and takes no space.
 *
 * Known limits of the iOS trick, so nobody is surprised: it only fires inside a real user
 * gesture, it plays ONE fixed system haptic — patterns and intensities are not available,
 * so `haptic([8,40,8])` feels the same as `haptic(8)` — and it needs the device's System
 * Haptics setting on.
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

/* The hidden iOS switch. Created once, on demand, and kept for the life of the page. */
let iosSwitch: HTMLInputElement | null = null;
let iosChecked = false;

function iosHapticElement(): HTMLInputElement | null {
  if (typeof document === 'undefined') return null;
  if (iosSwitch?.isConnected) return iosSwitch;

  const label = document.createElement('label');
  // Off-screen rather than display:none — a hidden control can't be clicked meaningfully.
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';

  const input = document.createElement('input');
  input.type = 'checkbox';
  // The `switch` attribute is the whole point: iOS 17.4+ plays a system haptic when a
  // control rendered as a switch toggles. Browsers that don't know it ignore it.
  input.setAttribute('switch', '');
  input.tabIndex = -1;

  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = input;
  return input;
}

/** True for iOS/iPadOS, including iPadOS pretending to be a Mac (touch + MacIntel). */
function isAppleTouch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * A short haptic tick. Uses navigator.vibrate where it exists, and the iOS switch trick
 * where it doesn't. Silent — never throwing — anywhere neither works.
 *
 * The `pattern` argument is honoured on Android only; iOS has exactly one haptic to give.
 */
export function haptic(pattern: number | number[] = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
      return;
    }
    if (!isAppleTouch()) return;
    const el = iosHapticElement();
    if (!el) return;
    // Toggle rather than always-check: a switch only plays the haptic when its state
    // actually changes, so re-checking an already-checked box would be silent.
    iosChecked = !iosChecked;
    el.checked = iosChecked;
    el.dispatchEvent(new Event('change', { bubbles: false }));
    el.click();
  } catch {
    /* a haptic is never worth an exception */
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
