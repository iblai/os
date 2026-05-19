'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (content: string) => {
      if (!isSupported || !content) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [isSupported],
  );

  const toggle = useCallback(
    (content: string) => {
      if (isSpeaking) {
        stop();
        return;
      }
      speak(content);
    },
    [isSpeaking, speak, stop],
  );

  return { isSpeaking, isSupported, speak, stop, toggle };
}
