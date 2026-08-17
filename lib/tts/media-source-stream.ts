/**
 * @file media-source-stream.ts
 * @input A `ReadableStream` of encoded audio bytes (MP3/WAV/…) from the TTS
 *   endpoint, plus the `<audio>` element that should play it.
 * @output An object URL wired to a `MediaSource`, and a promise that settles as
 *   soon as the *first* byte range is playable.
 * @position Pure transport, shared by every server-side voice provider. Knows
 *   nothing about React, mentors, or which vendor produced the audio.
 *
 * The point of streaming rather than `await response.blob()` is time-to-first-
 * sound: a long reply can take seconds to synthesise server-side, and buffering
 * the whole file first would make the listener wait for all of it. Appending
 * into a `SourceBuffer` as the bytes land means playback starts on the first
 * chunk while the rest is still in flight.
 */

/** What the endpoint returns when it declines to name a type. */
export const DEFAULT_TTS_MIME = 'audio/mpeg';

/**
 * `audio/mp3` is a common but non-standard spelling that `MediaSource` rejects;
 * every other type is passed through with its codec parameters stripped.
 */
export function normalizeAudioMime(contentType: string | null): string {
  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!mime) return DEFAULT_TTS_MIME;
  return mime === 'audio/mp3' ? DEFAULT_TTS_MIME : mime;
}

export function canStreamWithMediaSource(mime: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaSource !== 'undefined' &&
    typeof window.MediaSource.isTypeSupported === 'function' &&
    window.MediaSource.isTypeSupported(mime)
  );
}

/**
 * Attaches `body` to `audio` through a `MediaSource`.
 *
 * `ready` resolves on the first appended range rather than at end-of-stream --
 * that is the moment playback can begin. It rejects if the stream produced no
 * audio at all, so a silent failure surfaces as a fallback rather than a button
 * stuck in its loading state.
 */
export function attachMediaSourceStream(
  audio: HTMLAudioElement,
  body: ReadableStream<Uint8Array>,
  mime: string,
  signal: AbortSignal,
): { objectUrl: string; ready: Promise<void> } {
  const mediaSource = new window.MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  audio.src = objectUrl;

  const ready = new Promise<void>((resolve, reject) => {
    const onSourceOpen = () => {
      mediaSource.removeEventListener('sourceopen', onSourceOpen);

      let sourceBuffer: SourceBuffer;
      try {
        sourceBuffer = mediaSource.addSourceBuffer(mime);
      } catch (err) {
        reject(err);
        return;
      }

      const appendChunk = (chunk: Uint8Array) =>
        new Promise<void>((res, rej) => {
          const onUpdateEnd = () => {
            sourceBuffer.removeEventListener('updateend', onUpdateEnd);
            sourceBuffer.removeEventListener('error', onError);
            res();
          };
          const onError = () => {
            sourceBuffer.removeEventListener('updateend', onUpdateEnd);
            sourceBuffer.removeEventListener('error', onError);
            rej(new Error('TTS source buffer append failed'));
          };
          sourceBuffer.addEventListener('updateend', onUpdateEnd);
          sourceBuffer.addEventListener('error', onError);
          sourceBuffer.appendBuffer(chunk as BufferSource);
        });

      const pump = async () => {
        const reader = body.getReader();
        let appendedAny = false;
        try {
          while (true) {
            const result = await reader.read();
            if (result.done) break;
            if (result.value.byteLength > 0) {
              await appendChunk(result.value);
              appendedAny = true;
              resolve();
            }
          }
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
          if (!appendedAny) {
            reject(new Error('TTS stream produced no audio'));
          }
        } catch (err) {
          reject(err);
          if (!signal.aborted && mediaSource.readyState === 'open') {
            try {
              mediaSource.endOfStream();
            } catch {}
          }
        }
      };

      void pump();
    };

    mediaSource.addEventListener('sourceopen', onSourceOpen);
  });

  return { objectUrl, ready };
}
