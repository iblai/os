/**
 * A short two-tone chime for "Code is waiting on you", for a user who moved to
 * another window or app. Synthesised rather than an audio file, and throttled
 * so a burst of requests sounds once.
 */

const MIN_GAP_MS = 1500;
const TONES_HZ = [880, 1318.5];
const TONE_GAP_S = 0.16;
const TONE_LENGTH_S = 0.3;
// Laptop speakers barely carry a quiet sine: a triangle wave near half scale
// reads as a clear "ding-ding" at normal volume without clipping.
const PEAK_GAIN = 0.5;

let context: AudioContext | null = null;
let lastPlayedAt = Number.NEGATIVE_INFINITY;

export function playAttentionChime(): void {
  if (typeof window === 'undefined') return;
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Context) return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  try {
    context ??= new Context();
    const audio = context;
    void audio.resume?.().catch(() => {});
    const start = audio.currentTime;
    TONES_HZ.forEach((frequency, i) => {
      const at = start + i * TONE_GAP_S;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + TONE_LENGTH_S);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + TONE_LENGTH_S + 0.02);
    });
    // Let the audio output rest between chimes; `resume` wakes it next time.
    const lengthMs = (TONE_GAP_S * TONES_HZ.length + TONE_LENGTH_S) * 1000;
    setTimeout(() => void audio.suspend?.().catch(() => {}), lengthMs + 100);
  } catch {
    // A courtesy only: the card on screen is the prompt itself.
  }
}

/**
 * The user isn't looking at the app: another app is in front, or this window
 * is hidden or minimised. In front of it, the card on screen is the signal.
 */
export function isAppInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

/** Test support only: the throttle and the context outlive any one test. */
export function resetAttentionChimeForTests(): void {
  context = null;
  lastPlayedAt = Number.NEGATIVE_INFINITY;
}
