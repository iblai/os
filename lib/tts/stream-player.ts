/**
 * @file stream-player.ts
 * @input Raw mono PCM (`Float32Array`) chunks, arriving one at a time from the
 *   Kokoro worker while later chunks are still being synthesised.
 * @output Gapless audio on the default output device, plus the transport state
 *   (`elapsed`, `paused`) the speak button needs.
 * @position Main-thread half of the on-device TTS pipeline. Owns the single
 *   `AudioContext`; knows nothing about Kokoro, markdown, or React.
 *
 * The whole design is one line of arithmetic:
 *
 *     startAt = max(cursor, ctx.currentTime);  cursor = startAt + duration
 *
 * Each chunk is scheduled on the AudioContext's own clock at the exact instant
 * the previous chunk ends, so the queue plays as one continuous track even
 * though chunk N+1 does not exist yet when chunk N starts. No `ended` callback
 * drives playback, so a late chunk cannot cause a stutter -- and no "wait for
 * the buffer to fill" heuristic is needed.
 *
 * The `max` is what makes a slow backend survivable. If synthesis falls behind
 * realtime (single-threaded WASM on a long message), `cursor` is already in the
 * past when the chunk lands and it starts immediately: one audible seam instead
 * of a desync that grows for the rest of the utterance. Stalling playback to
 * "prevent" the gap would only trade a seam for a longer silence.
 */

/** Seconds of lead time on the first chunk, absorbing graph start-up jitter. */
const FIRST_CHUNK_LEAD_SECONDS = 0.05;

/**
 * How long to wait for a blocked context to come back before declaring the page
 * silent. `resume()` on a context the autoplay policy has blocked returns a
 * promise that simply never settles, so it can only be raced, never awaited.
 */
const RESUME_GRACE_MS = 200;

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Reads `state` through a function so the compiler cannot carry a narrowing
 * from before an `await` across it -- the whole point is that the value changes
 * underneath us while we wait.
 */
function isRunning(ctx: AudioContext): boolean {
  return ctx.state === 'running';
}

export class StreamPlayer {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];

  /** Context time at which the next chunk should start. */
  private cursor = 0;

  /** Context time the current utterance began; 0 before the first chunk. */
  private startedAt = 0;

  /** True once the producer has promised there are no more chunks coming. */
  private complete = false;

  /** Total seconds of audio handed to us for the current utterance. */
  queuedSeconds = 0;

  /**
   * Fired when the last scheduled chunk of a completed stream finishes playing.
   * This is the only reliable "speech ended" signal: individual chunk `ended`
   * events fire throughout playback, and `complete` only means generation is
   * done, not that the tail has been heard.
   */
  onDrained: (() => void) | null = null;

  /**
   * Prepares a fresh utterance and reports whether audio can actually be heard.
   *
   * MUST be called synchronously from within a user gesture: an `AudioContext`
   * constructed outside one starts `suspended` and stays silent forever. The
   * context is therefore constructed before the first `await` below, so calling
   * `await player.start()` from a click handler is still inside the gesture.
   *
   * Returns `false` when the context is still suspended after a resume attempt
   * -- which is exactly the autoplay case (`selectAutoplayLastAiMessage` speaks
   * without any gesture). The caller is expected to fall back to a voice that
   * does not need one rather than spend a minute of CPU on inaudible audio.
   */
  async start(): Promise<boolean> {
    this.stop();

    if (!this.ctx) {
      const Ctor = getAudioContextCtor();
      if (!Ctor) return false;
      this.ctx = new Ctor();
    }
    const ctx = this.ctx;

    if (isRunning(ctx)) return true;

    await Promise.race([
      Promise.resolve(ctx.resume()).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, RESUME_GRACE_MS)),
    ]);

    return isRunning(ctx);
  }

  /** Schedules one chunk of mono PCM to play the instant the previous ends. */
  enqueue(pcm: Float32Array, samplingRate: number): void {
    const ctx = this.ctx;
    if (!ctx || pcm.length === 0) return;

    const buffer = ctx.createBuffer(1, pcm.length, samplingRate);
    // The DOM typings pin `copyToChannel` to a non-shared backing buffer; PCM
    // that arrived over `postMessage` is typed as the wider `ArrayBufferLike`.
    buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);

    if (this.cursor === 0) {
      this.cursor = ctx.currentTime + FIRST_CHUNK_LEAD_SECONDS;
      this.startedAt = this.cursor;
    }
    const startAt = Math.max(this.cursor, ctx.currentTime);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.addEventListener('ended', () => {
      this.sources = this.sources.filter((s) => s !== source);
      // `stop()` clears `complete` first, so tearing down mid-stream cannot be
      // mistaken for the utterance having finished naturally.
      if (this.complete && this.sources.length === 0) this.onDrained?.();
    });
    source.start(startAt);

    this.sources.push(source);
    this.cursor = startAt + buffer.duration;
    this.queuedSeconds += buffer.duration;
  }

  /**
   * Declares that every chunk has been enqueued. Message order over
   * `postMessage` guarantees all of them are already scheduled by now, so if
   * nothing is still playing the utterance is over.
   */
  markComplete(): void {
    this.complete = true;
    if (this.sources.length === 0) this.onDrained?.();
  }

  /** Seconds already heard, clamped to what has actually been queued. */
  get elapsed(): number {
    if (!this.ctx || !this.startedAt) return 0;
    return Math.min(
      Math.max(this.ctx.currentTime - this.startedAt, 0),
      this.queuedSeconds,
    );
  }

  get paused(): boolean {
    return this.ctx?.state === 'suspended';
  }

  /**
   * Suspending freezes `currentTime` itself, so every already-scheduled start
   * time stays correct across the pause -- nothing needs rescheduling, and
   * chunks that arrive while paused schedule against the frozen clock too.
   */
  pause(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  /** Cancels everything scheduled and rewinds the cursor. Keeps the context. */
  stop(): void {
    this.complete = false;
    const sources = this.sources;
    this.sources = [];
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        // A source that already played out throws on stop(); nothing to do.
      }
    }
    this.cursor = 0;
    this.startedAt = 0;
    this.queuedSeconds = 0;
    // Leave a paused context ready for the next utterance.
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }
}
