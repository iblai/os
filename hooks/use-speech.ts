'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLazyGetChatMessageTtsQuery } from '@iblai/iblai-js/data-layer';
import type { Message } from '@iblai/iblai-js/web-utils';

import { useUsername } from '@/providers/use-user';
import { useMentorSettings } from './use-mentors/use-mentor-settings';

type Props = {
  mentorId?: string;
  tenantKey?: string;
};

export function useSpeech({ mentorId, tenantKey }: Props = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const cancelBrowserSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelBrowserSpeech();
      releaseAudio();
    };
  }, [cancelBrowserSpeech, releaseAudio]);

  const stop = useCallback(() => {
    cancelBrowserSpeech();
    releaseAudio();
    setIsSpeaking(false);
  }, [cancelBrowserSpeech, releaseAudio]);

  const speakViaEndpoint = useCallback(
    async (message: Message) => {
      if (!username || !tenantKey) return;
      const chatMessageId = message.id;
      cancelBrowserSpeech();
      releaseAudio();
      console.log('[chat message object dump]: ', { message });
      try {
        const blob = await fetchTts({
          org: tenantKey,
          user_id: username,
          chat_message_id: chatMessageId,
        }).unwrap();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          releaseAudio();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          releaseAudio();
        };
        setIsSpeaking(true);
        await audio.play();
      } catch (error) {
        console.error('TTS endpoint failed', error);
        setIsSpeaking(false);
        releaseAudio();
      }
    },
    [username, tenantKey, fetchTts, cancelBrowserSpeech, releaseAudio],
  );

  const speakViaBrowser = useCallback(
    (content: string) => {
      if (!isBrowserSupported || !content) return;
      cancelBrowserSpeech();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isBrowserSupported, cancelBrowserSpeech],
  );

  const speak = useCallback(
    (message: Message) => {
      if (!message?.content) return;
      if (useEndpoint) {
        void speakViaEndpoint(message);
      } else {
        speakViaBrowser(message.content);
      }
    },
    [useEndpoint, speakViaEndpoint, speakViaBrowser],
  );

  const toggle = useCallback(
    (message: Message) => {
      if (isSpeaking) {
        stop();
        return;
      }
      speak(message);
    },
    [isSpeaking, speak, stop],
  );

  return { isSpeaking, isSupported, speak, stop, toggle };
}
