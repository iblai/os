import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isAppInBackground,
  playAttentionChime,
  resetAttentionChimeForTests,
} from '../attention-chime';

/** A stand-in AudioContext that records the tones it was asked to play. */
function installFakeAudio() {
  const tones: number[] = [];
  class FakeContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    suspend = vi.fn(async () => {});
    createOscillator() {
      const node = {
        type: '',
        frequency: { value: 0 },
        connect: (next: unknown) => next,
        start: vi.fn(() => tones.push(node.frequency.value)),
        stop: vi.fn(),
      };
      return node;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: (next: unknown) => next,
      };
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  return tones;
}

describe('playAttentionChime', () => {
  let originalAudio: unknown;
  beforeEach(() => {
    originalAudio = (window as unknown as { AudioContext?: unknown })
      .AudioContext;
    resetAttentionChimeForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    (window as unknown as { AudioContext?: unknown }).AudioContext =
      originalAudio;
    vi.useRealTimers();
  });

  it('plays one two-tone chime and stays quiet for the rest of a burst', () => {
    const tones = installFakeAudio();

    playAttentionChime();
    playAttentionChime();
    expect(tones).toEqual([880, 1318.5]);

    vi.advanceTimersByTime(1600);
    playAttentionChime();
    expect(tones).toHaveLength(4);
  });

  it('counts the app as in the background once its window blurred, and in front again on focus', () => {
    expect(isAppInBackground()).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(isAppInBackground()).toBe(true);
    window.dispatchEvent(new Event('focus'));
    expect(isAppInBackground()).toBe(false);
  });

  // A Tauri webview reports no document focus whenever focus sits outside the
  // document (native chrome, iOS WKWebView) with the window still frontmost;
  // chiming there dings at someone reading the card.
  it('stays in front when only the document lost focus', () => {
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    expect(isAppInBackground()).toBe(false);
    hasFocus.mockRestore();
  });

  it('counts a hidden page as the background', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    expect(isAppInBackground()).toBe(true);
    hidden.mockRestore();
  });

  it('does nothing where the browser has no audio', () => {
    (window as unknown as { AudioContext?: unknown }).AudioContext = undefined;
    expect(() => playAttentionChime()).not.toThrow();
  });
});
