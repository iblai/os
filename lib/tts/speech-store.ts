/**
 * @file speech-store.ts
 * @input `update()` calls from whichever voice provider is currently speaking.
 * @output A stable snapshot for `useSyncExternalStore`, so every mounted speak
 *   button re-renders together.
 * @position Module-scoped on purpose. `useSpeech` is mounted once per rendered
 *   assistant message, but only one utterance can play at a time, so the
 *   "who is speaking" state belongs to the tab rather than to any one hook
 *   instance -- otherwise pressing play on message B would leave message A's
 *   button still showing itself as active.
 */

export type SpeechSnapshot = {
  currentMessageId: string | null;
  isSpeaking: boolean;
  isLoading: boolean;
};

const IDLE: SpeechSnapshot = {
  currentMessageId: null,
  isSpeaking: false,
  isLoading: false,
};

let snapshot: SpeechSnapshot = IDLE;

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Identity-stable between updates, which is what `useSyncExternalStore`
 * requires to avoid an infinite re-render loop.
 */
export function getSnapshot(): SpeechSnapshot {
  return snapshot;
}

export function update(patch: Partial<SpeechSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

/** Back to nothing playing. */
export function setIdle(): void {
  update(IDLE);
}

/**
 * How many speak buttons are currently mounted. The last one to unmount is the
 * one that has to tear playback down; the others are just re-renders.
 */
export function listenerCount(): number {
  return listeners.size;
}
