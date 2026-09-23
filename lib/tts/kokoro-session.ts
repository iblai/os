/**
 * @file kokoro-session.ts
 * @input Lifecycle calls from `useSpeech`'s on-device branch.
 * @output The tab's single Kokoro worker and audio graph, plus the one-entry
 *   cache of the last fully-synthesised utterance.
 * @position Owns everything about the on-device voice that must outlive a
 *   single React component.
 *
 * All of it is module-scoped deliberately. `useSpeech` is mounted once per
 * rendered assistant message, while the worker holds ~88 MB of loaded model
 * weights and an initialised ONNX session. Per-hook instances would re-download
 * and re-initialise per message bubble; sharing means it happens once per tab.
 */

import { StreamPlayer } from './stream-player';

let worker: Worker | null = null;
let player: StreamPlayer | null = null;

/** Incremented per utterance so replies from a superseded run are ignored. */
let requestId = 0;

/**
 * The last fully-synthesised utterance, kept as an object URL.
 *
 * This is what the worker's final WAV is *for*: it gives the on-device path the
 * same "one complete audio asset per message" the endpoint path has, and makes
 * pressing Read Aloud again on a message the user just heard instant rather
 * than a second full synthesis pass. One entry, because the point is repeating
 * the message in front of you, not building a library.
 */
let cache: { key: string; url: string } | null = null;

/**
 * Keyed on the voice as well as the message: the same message spoken by a
 * different voice is different audio, and keying on the id alone would replay
 * the previous voice after the mentor's voice is changed.
 */
function cacheKey(messageId: string, voice: string): string {
  return `${messageId}\u0000${voice}`;
}

/**
 * Lazily constructs the worker.
 *
 * `new URL(..., import.meta.url)` is the form both webpack (`next dev`,
 * `next build`) and Turbopack recognise as a worker entry point, which is what
 * gets `kokoro.worker.ts` compiled into its own chunk. It is deliberately
 * inside a function: at module scope it would run during SSR, where `Worker`
 * does not exist.
 */
export function getKokoroWorker(): Worker {
  worker ??= new Worker(new URL('./kokoro.worker.ts', import.meta.url), {
    type: 'module',
  });
  return worker;
}

export function getKokoroPlayer(): StreamPlayer {
  player ??= new StreamPlayer();
  return player;
}

export function nextKokoroRequestId(): number {
  requestId += 1;
  return requestId;
}

export function cacheKokoroAudio(
  messageId: string,
  voice: string,
  blob: Blob,
): void {
  if (cache) URL.revokeObjectURL(cache.url);
  cache = { key: cacheKey(messageId, voice), url: URL.createObjectURL(blob) };
}

/** The cached object URL for this message *in this voice*, or null on a miss. */
export function getCachedKokoroAudio(
  messageId: string,
  voice: string,
): string | null {
  return cache?.key === cacheKey(messageId, voice) ? cache.url : null;
}

/**
 * Detaches the current utterance from the worker and silences the graph.
 *
 * The worker is *not* terminated: doing so would throw away the loaded model
 * and make the next message pay the ~88 MB download again. The `cancel`
 * message is what actually stops work -- the generate loop checks its
 * generation counter between chunks and stands down.
 */
export function teardownKokoro(): void {
  if (worker) {
    worker.onmessage = null;
    worker.onerror = null;
    worker.postMessage({ type: 'cancel' });
  }
  if (player) {
    player.onDrained = null;
    player.stop();
  }
}
