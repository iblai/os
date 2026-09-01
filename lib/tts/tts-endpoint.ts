/**
 * @file tts-endpoint.ts
 * @input The id of a chat message, plus the org/user it belongs to.
 * @output The `<audio>` element wired up to play the server's rendering of that
 *   message, and -- via `onObjectUrl` -- the handle the caller must revoke.
 * @position The server-side voice providers (OpenAI, Google, and any future
 *   self-hosted engine). The request carries only the *message id*: the backend
 *   looks up the text itself and reads the mentor's configured provider and
 *   voice, so neither the message text nor the vendor choice crosses here.
 */

import { config } from '@/lib/config';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

import {
  attachMediaSourceStream,
  canStreamWithMediaSource,
  normalizeAudioMime,
} from './media-source-stream';

/**
 * `not-audio` is a normal outcome, not a failure: the endpoint answers with a
 * non-audio payload when it has nothing to speak, and the caller is expected to
 * fall back to the browser voice rather than surface an error.
 */
export type TtsAudioOutcome = 'audio' | 'not-audio';

export type TtsMessageRef = {
  org: string;
  userId: string;
  chatMessageId: string;
};

/**
 * Fetches the message's audio and attaches it to `audio`.
 *
 * `onObjectUrl` fires the instant a URL exists, *before* the stream is awaited,
 * because a stream that fails halfway still leaves a URL that has to be
 * revoked. Returning it instead would lose the handle on exactly that path.
 */
export async function loadTtsAudio(
  audio: HTMLAudioElement,
  { org, userId, chatMessageId }: TtsMessageRef,
  signal: AbortSignal,
  onObjectUrl: (objectUrl: string) => void,
): Promise<TtsAudioOutcome> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY)
      : null;
  // The trailing slash is required, not cosmetic. Without it the API answers
  // 301 to the slashed path, and the redirected request does not survive: it
  // hangs until the gateway gives up and returns 502 after ~60s, where the
  // slashed URL answers in 4-6s. Read Aloud simply failed, slowly.
  const url = `${config.dmUrl()}/api/ai-mentor/orgs/${org}/users/${userId}/chat-messages/${chatMessageId}/tts/`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-cache',
    headers: token ? { Authorization: `Token ${token}` } : undefined,
    signal,
  });
  if (!response.ok) {
    throw new Error(`TTS request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type');

  if (contentType && !contentType.toLowerCase().startsWith('audio/')) {
    return 'not-audio';
  }
  const mime = normalizeAudioMime(contentType);

  if (response.body && canStreamWithMediaSource(mime)) {
    const { objectUrl, ready } = attachMediaSourceStream(
      audio,
      response.body,
      mime,
      signal,
    );
    onObjectUrl(objectUrl);
    await ready;
    return 'audio';
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  onObjectUrl(objectUrl);
  audio.src = objectUrl;
  return 'audio';
}
