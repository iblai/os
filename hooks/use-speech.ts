'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { Message } from '@iblai/iblai-js/web-utils';

import { config } from '@/lib/config';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { useUsername } from '@/providers/use-user';
import { useMentorSettings } from './use-mentors/use-mentor-settings';

// The TTS endpoint streams audio, so playback can begin as soon as the first
// bytes arrive instead of waiting for the whole file. `audio/mp3` is a common
// (non-standard) alias the browser's MediaSource only recognises as
// `audio/mpeg`, so we normalise it to keep the streaming path available.
const DEFAULT_TTS_MIME = 'audio/mpeg';

function normalizeAudioMime(contentType: string | null): string {
  const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (!mime) return DEFAULT_TTS_MIME;
  return mime === 'audio/mp3' ? DEFAULT_TTS_MIME : mime;
}

function canStreamWithMediaSource(mime: string): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaSource !== 'undefined' &&
    typeof window.MediaSource.isTypeSupported === 'function' &&
    window.MediaSource.isTypeSupported(mime)
  );
}

// Pipes a fetch response body into a MediaSource so the audio element can play
// the stream progressively. Resolves once the first chunk has been buffered
// (enough to start playback); the remaining chunks keep streaming in the
// background. The returned object URL must be revoked once playback is done.
function attachMediaSourceStream(
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
          // A fetch body is never SharedArrayBuffer-backed, so this view is a
          // valid BufferSource even though the generic type allows otherwise.
          sourceBuffer.appendBuffer(chunk as BufferSource);
        });

      const pump = async () => {
        const reader = body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value && value.byteLength > 0) {
              await appendChunk(value);
              // First playable chunk is buffered — let the caller start
              // playback while the rest continues to stream. `resolve` is a
              // no-op on subsequent chunks.
              resolve();
            }
          }
          if (mediaSource.readyState === 'open') {
            mediaSource.endOfStream();
          }
        } catch (err) {
          // Once playback has started this reject is a no-op; the audio
          // element's error handler covers mid-stream failures.
          reject(err);
          if (!signal.aborted && mediaSource.readyState === 'open') {
            try {
              mediaSource.endOfStream();
            } catch {
              // The source may already be torn down; nothing to recover.
            }
          }
        }
      };

      void pump();
    };

    mediaSource.addEventListener('sourceopen', onSourceOpen);
  });

  return { objectUrl, ready };
}

// Loads the TTS audio for a message into `audio`, streaming progressively when
// the browser supports it and falling back to a buffered object URL otherwise.
// Resolves `true` once the audio has a playable source, or `false` when the
// response was not audio (the caller should fall back to browser speech).
async function loadTtsAudio(
  audio: HTMLAudioElement,
  org: string,
  userId: string,
  chatMessageId: string,
  signal: AbortSignal,
): Promise<boolean> {
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem(LOCAL_STORAGE_KEYS.DM_TOKEN_KEY)
      : null;
  const url = `${config.dmUrl()}/api/ai-mentor/orgs/${org}/users/${userId}/chat-messages/${chatMessageId}/tts`;
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-cache',
    headers: token ? { Authorization: `Token ${token}` } : undefined,
    signal,
  });
  if (!response.ok) {
    throw new Error(`TTS request failed with status ${response.status}`);
  }

  const contentType = response.headers?.get?.('Content-Type') ?? null;
  // An explicit non-audio payload (e.g. a JSON error) means there is nothing to
  // play — let the caller fall back to browser speech synthesis.
  if (contentType && !contentType.toLowerCase().startsWith('audio/')) {
    return false;
  }
  const mime = normalizeAudioMime(contentType);

  if (response.body && canStreamWithMediaSource(mime)) {
    const { objectUrl, ready } = attachMediaSourceStream(
      audio,
      response.body,
      mime,
      signal,
    );
    activeObjectUrl = objectUrl;
    await ready;
    return true;
  }

  // No streaming support — buffer the whole response, then play it.
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  activeObjectUrl = objectUrl;
  audio.src = objectUrl;
  return true;
}

// Module-level store so every consumer of useSpeech (the per-message
// AIMessageSpeak buttons and the ChatMessages autoplay flow) shares one active
// playback. This is what lets the icon on a specific message bubble light up
// when autoplay reads that message from elsewhere in the tree.
type SpeechSnapshot = {
  currentMessageId: string | null;
  isSpeaking: boolean;
  isLoading: boolean;
};

let snapshot: SpeechSnapshot = {
  currentMessageId: null,
  isSpeaking: false,
  isLoading: false,
};

let activeAudio: HTMLAudioElement | null = null;
// Tracks the in-flight TTS stream so stopping playback can abort the fetch and
// stop pumping chunks, and the object URL backing playback so it can be revoked.
let activeStreamController: AbortController | null = null;
let activeObjectUrl: string | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function update(patch: Partial<SpeechSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function releaseObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function teardownPlayback() {
  if (activeStreamController) {
    activeStreamController.abort();
    activeStreamController = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  releaseObjectUrl();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function resetSpeech() {
  teardownPlayback();
  update({ currentMessageId: null, isSpeaking: false, isLoading: false });
}

type Props = {
  mentorId?: string;
  tenantKey?: string;
};

export function useSpeech({ mentorId, tenantKey }: Props = {}) {
  const { currentMessageId, isSpeaking, isLoading } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  const username = useUsername();
  const { data: mentorSettings } = useMentorSettings({ mentorId, tenantKey });
  const voiceProvider = mentorSettings?.voiceProvider;

  const isBrowserSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const useEndpoint = Boolean(
    voiceProvider && voiceProvider !== 'browser' && username && tenantKey,
  );
  const isSupported = useEndpoint || isBrowserSupported;

  useEffect(() => {
    return () => {
      // Only the last unmount needs to clean up; harmless when re-mounting.
      if (listeners.size === 0) {
        resetSpeech();
      }
    };
  }, []);

  const stop = useCallback(() => {
    resetSpeech();
  }, []);

  const speakViaBrowser = useCallback(
    (message: Message) => {
      if (!isBrowserSupported || !message.content) return;
      teardownPlayback();
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.onend = () =>
        update({ currentMessageId: null, isSpeaking: false });
      utterance.onerror = () =>
        update({ currentMessageId: null, isSpeaking: false });
      update({
        currentMessageId: message.id,
        isSpeaking: true,
        isLoading: false,
      });
      window.speechSynthesis.speak(utterance);
    },
    [isBrowserSupported],
  );

  const speakViaEndpoint = useCallback(
    async (message: Message) => {
      if (!username || !tenantKey) return;

      teardownPlayback();
      update({
        currentMessageId: message.id,
        isSpeaking: false,
        isLoading: true,
      });

      const controller = new AbortController();
      activeStreamController = controller;
      const audio = new Audio();
      activeAudio = audio;
      audio.onended = () => {
        activeAudio = null;
        releaseObjectUrl();
        update({ currentMessageId: null, isSpeaking: false });
      };
      audio.onerror = () => {
        activeAudio = null;
        releaseObjectUrl();
        update({ currentMessageId: null, isSpeaking: false });
      };

      try {
        const isAudio = await loadTtsAudio(
          audio,
          tenantKey,
          username,
          String(message.id),
          controller.signal,
        );
        if (!isAudio) {
          speakViaBrowser(message);
          return;
        }
        update({ isSpeaking: true, isLoading: false });
        await audio.play();
      } catch {
        // A deliberate stop aborts the stream; its teardown already reset state.
        if (controller.signal.aborted) return;
        resetSpeech();
      }
    },
    [username, tenantKey, speakViaBrowser],
  );

  const speak = useCallback(
    (message: Message) => {
      if (!message?.content) return;
      if (useEndpoint) {
        void speakViaEndpoint(message);
      } else {
        speakViaBrowser(message);
      }
    },
    [useEndpoint, speakViaEndpoint, speakViaBrowser],
  );

  const toggle = useCallback(
    (message: Message) => {
      const isThisActive =
        snapshot.currentMessageId === message.id &&
        (snapshot.isSpeaking || snapshot.isLoading);
      if (isThisActive) {
        stop();
        return;
      }
      speak(message);
    },
    [speak, stop],
  );

  return {
    currentMessageId,
    isSpeaking,
    isLoading,
    isSupported,
    speak,
    stop,
    toggle,
  };
}
