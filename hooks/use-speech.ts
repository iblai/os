'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useLazyGetChatMessageTtsQuery } from '@iblai/iblai-js/data-layer';
import type { Message } from '@iblai/iblai-js/web-utils';

import { useUsername } from '@/providers/use-user';
import { useMentorSettings } from './use-mentors/use-mentor-settings';

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

function teardownPlayback() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
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

  const [fetchTts] = useLazyGetChatMessageTtsQuery();

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

      try {
        const dataUrl = await fetchTts(
          {
            org: tenantKey,
            user_id: username,
            chat_message_id: String(message.id),
          },
          true,
        ).unwrap();
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
          console.warn(
            'TTS endpoint returned an unexpected payload; falling back to browser speech.',
            dataUrl,
          );
          speakViaBrowser(message);
          return;
        }
        const audio = new Audio(dataUrl);
        activeAudio = audio;
        audio.onended = () => {
          activeAudio = null;
          update({ currentMessageId: null, isSpeaking: false });
        };
        audio.onerror = () => {
          activeAudio = null;
          update({ currentMessageId: null, isSpeaking: false });
        };
        update({ isSpeaking: true, isLoading: false });
        await audio.play();
      } catch (error) {
        console.error('TTS endpoint failed', error);
        resetSpeech();
      }
    },
    [username, tenantKey, fetchTts, speakViaBrowser],
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
