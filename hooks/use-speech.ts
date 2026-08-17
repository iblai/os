'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { Message } from '@iblai/iblai-js/web-utils';

import { stripMarkdownForSpeech } from '@/lib/strip-markdown';
import {
  downgradeToWasm,
  isIosWebKit,
  probeWebGpu,
  resolveKokoroConfig,
} from '@/lib/tts/config';
import {
  cacheKokoroAudio,
  getCachedKokoroAudio,
  getKokoroPlayer,
  getKokoroWorker,
  nextKokoroRequestId,
  teardownKokoro,
} from '@/lib/tts/kokoro-session';
import type { KokoroResponse } from '@/lib/tts/kokoro.worker';
import {
  getSnapshot,
  listenerCount,
  setIdle,
  subscribe,
  update,
} from '@/lib/tts/speech-store';
import type { StreamPlayer } from '@/lib/tts/stream-player';
import { loadTtsAudio } from '@/lib/tts/tts-endpoint';
import { useUsername } from '@/providers/use-user';
import { useMentorSettings } from './use-mentors/use-mentor-settings';

/**
 * The mentor-settings value for the on-device voice. Mirrors the option the
 * voice tab offers in `@iblai/iblai-js` (labelled "ibl.ai").
 */
const IBLAI_VOICE_PROVIDER = 'iblai';

// The `<audio>`-based providers (endpoint and cached on-device replay) share
// these: only one utterance plays at a time, so there is exactly one element,
// one in-flight request and one object URL to revoke.
let activeAudio: HTMLAudioElement | null = null;
let activeStreamController: AbortController | null = null;
let activeObjectUrl: string | null = null;

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
  teardownKokoro();
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function resetSpeech() {
  teardownPlayback();
  setIdle();
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
  // `iblai` is the on-device provider: it synthesises in the browser, so unlike
  // every other non-browser provider it needs neither an identity nor a tenant.
  const useIblai = voiceProvider === IBLAI_VOICE_PROVIDER;
  // iOS is excluded outright: every iOS browser is WebKit, and loading the
  // model there trips WebKit's per-tab memory kill -- a crash-reload loop no
  // JS can catch. Those users get the system (Siri) voice instead.
  const isIblaiSupported =
    typeof window !== 'undefined' &&
    typeof window.Worker === 'function' &&
    !isIosWebKit();
  const useEndpoint = Boolean(
    voiceProvider &&
      voiceProvider !== 'browser' &&
      !useIblai &&
      username &&
      tenantKey,
  );
  const isSupported =
    useEndpoint || isBrowserSupported || (useIblai && isIblaiSupported);

  useEffect(() => {
    return () => {
      // Only the last unmount needs to clean up; harmless when re-mounting.
      if (listenerCount() === 0) {
        resetSpeech();
      }
    };
  }, []);

  const stop = useCallback(() => {
    resetSpeech();
  }, []);

  const speakViaBrowser = useCallback(
    (message: Message) => {
      // The endpoint path falls back to here when the server returns a
      // non-audio payload, and it arrives with `isLoading` already true, so
      // every bail-out below resets rather than returning bare -- otherwise the
      // button spins forever on a browser with no Web Speech API.
      if (!isBrowserSupported || !message.content) {
        resetSpeech();
        return;
      }
      // `message.content` is markdown. The Web Speech API has no notion of
      // markup, so handing it the raw string makes the voice read out the
      // syntax itself -- "hash hash", "star star". Strip to prose first.
      //
      // Only this path needs it: `speakViaEndpoint` sends a message id and the
      // backend derives its own text from it, so there is no text to strip
      // there. When the endpoint falls back to this function it goes through
      // the same stripping, because the fallback calls `speakViaBrowser`.
      const spoken = stripMarkdownForSpeech(message.content);
      // A message that is nothing but a code block or an image strips to
      // nothing. Speaking an empty utterance would leave the button stuck in
      // its "speaking" state waiting for an `onend` that some engines never
      // fire.
      if (!spoken) {
        resetSpeech();
        return;
      }
      teardownPlayback();
      const utterance = new SpeechSynthesisUtterance(spoken);
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
        const outcome = await loadTtsAudio(
          audio,
          {
            org: tenantKey,
            userId: username,
            chatMessageId: String(message.id),
          },
          controller.signal,
          (objectUrl) => {
            activeObjectUrl = objectUrl;
          },
        );
        if (outcome === 'not-audio') {
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

  /**
   * On-device synthesis: no network call, no audio leaves the browser.
   *
   * Flow: strip markdown -> open the audio graph -> hand the text to the worker
   * -> schedule each chunk of PCM the instant it comes back, while the worker
   * is already generating the next one. Time-to-first-sound therefore depends
   * on the length of the *first sentence*, not of the message.
   *
   * Every failure mode ends at `speakViaBrowser`, matching how the endpoint
   * path degrades: no WebGPU and a WASM backend too slow to matter, a blocked
   * model fetch, a worker that failed to boot, or an audio context the autoplay
   * policy will not let us start.
   */
  const speakViaIblai = useCallback(
    async (message: Message) => {
      // `speak` has already rejected an empty `content`, and
      // `stripMarkdownForSpeech` returns '' for anything that is not a string,
      // so no defensive default is needed here.
      const spoken = stripMarkdownForSpeech(message.content);
      if (!spoken) {
        resetSpeech();
        return;
      }

      teardownPlayback();
      update({
        currentMessageId: message.id,
        isSpeaking: false,
        isLoading: true,
      });

      const messageId = String(message.id);

      // Already synthesised this message once: replay the assembled WAV rather
      // than spending another pass on the CPU.
      const cachedUrl = getCachedKokoroAudio(messageId);
      if (cachedUrl) {
        const audio = new Audio();
        activeAudio = audio;
        const finish = () => {
          activeAudio = null;
          update({ currentMessageId: null, isSpeaking: false });
        };
        audio.onended = finish;
        audio.onerror = finish;
        audio.src = cachedUrl;
        update({ isSpeaking: true, isLoading: false });
        try {
          await audio.play();
        } catch {
          resetSpeech();
        }
        return;
      }

      let player: StreamPlayer;
      let worker: Worker;
      try {
        player = getKokoroPlayer();
        worker = getKokoroWorker();
      } catch {
        speakViaBrowser(message);
        return;
      }

      // `start()` constructs the AudioContext synchronously before it awaits
      // anything, so this is still inside the click that called us. It resolves
      // false when the context stays suspended -- which is precisely the
      // autoplay case (`selectAutoplayLastAiMessage` speaks with no gesture
      // behind it). Falling back is the deliberate choice: the alternative is
      // burning a minute of CPU producing audio that is silently discarded.
      const started = await player.start();
      if (!started) {
        speakViaBrowser(message);
        return;
      }

      const requestId = nextKokoroRequestId();

      player.onDrained = () => {
        update({ currentMessageId: null, isSpeaking: false });
      };

      worker.onerror = () => {
        speakViaBrowser(message);
      };

      worker.onmessage = (event: MessageEvent<KokoroResponse>) => {
        const data = event.data;
        // A reply from an utterance the user already moved on from.
        if (!data || data.requestId !== requestId) return;

        if (data.type === 'chunk') {
          player.enqueue(data.pcm, data.samplingRate);
          // First audible sound: the button stops spinning here, not when the
          // whole message has been generated.
          if (data.index === 0) {
            update({ isSpeaking: true, isLoading: false });
          }
          return;
        }

        if (data.type === 'complete') {
          cacheKokoroAudio(messageId, data.blob);
          // Not "playback finished" -- the tail is still queued. This is what
          // lets the player know the last chunk it holds really is the last.
          player.markComplete();
          return;
        }

        if (data.type === 'error') {
          speakViaBrowser(message);
        }
      };

      // The presence of `navigator.gpu` is not proof an adapter will be
      // granted (blocklisted GPUs, denied contexts). Probe before committing:
      // a refusal downgrades to WASM instead of failing the utterance.
      let kokoroConfig = resolveKokoroConfig();
      if (kokoroConfig.device === 'webgpu' && !(await probeWebGpu())) {
        kokoroConfig = downgradeToWasm(kokoroConfig);
      }

      worker.postMessage({
        type: 'generate',
        requestId,
        text: spoken,
        config: kokoroConfig,
      });
    },
    [speakViaBrowser],
  );

  const speak = useCallback(
    (message: Message) => {
      if (!message?.content) return;
      if (useIblai && isIblaiSupported) {
        void speakViaIblai(message);
      } else if (useEndpoint) {
        void speakViaEndpoint(message);
      } else {
        // Also the landing spot for `iblai` on unsupported devices (iOS): the
        // provider stays configured, the voice degrades to the system one.
        speakViaBrowser(message);
      }
    },
    [
      useIblai,
      isIblaiSupported,
      useEndpoint,
      speakViaIblai,
      speakViaEndpoint,
      speakViaBrowser,
    ],
  );

  const toggle = useCallback(
    (message: Message) => {
      // Read through the store rather than the render-time values so a rapid
      // second click sees the state the first one just wrote.
      const current = getSnapshot();
      const isThisActive =
        current.currentMessageId === message.id &&
        (current.isSpeaking || current.isLoading);
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
