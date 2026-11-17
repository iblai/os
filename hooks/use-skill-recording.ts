'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecordedStep } from '@/lib/recorded-skill';

export const RECORD_START = 'MENTOR:RECORD_START';
export const RECORD_STOP = 'MENTOR:RECORD_STOP';
export const RECORD_EVENT = 'MENTOR:RECORD_EVENT';

/** Mirror of the recorder frames in `extensions/chrome/src/browse-protocol.ts`. */
type Frame =
  | { type: 'recording'; steps: number }
  | { type: 'recorded'; steps: RecordedStep[] }
  | { type: 'error'; message: string };

const post = (message: unknown) => window.parent.postMessage(message, '*');

export interface SkillRecording {
  isRecording: boolean;
  /** How many steps are in the recording so far, for the panel's own row. */
  count: number;
  /** The finished recording, once Stop has been answered. */
  steps: RecordedStep[] | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Drop a finished recording — review was saved, or abandoned. */
  clear: () => void;
}

/**
 * Recording lives in the extension's service worker, which is the only place
 * that can watch a page; this is the app's half of that conversation.
 */
export function useSkillRecording(): SkillRecording {
  const [isRecording, setIsRecording] = useState(false);
  const [count, setCount] = useState(0);
  const [steps, setSteps] = useState<RecordedStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recording = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const frame = event.data as (Frame & { type?: string }) | null;
      if (!frame?.type) return;
      if (frame.type === 'recording') {
        recording.current = true;
        setIsRecording(true);
        setCount(frame.steps);
        return;
      }
      if (frame.type === 'recorded') {
        recording.current = false;
        setIsRecording(false);
        setSteps(frame.steps);
        return;
      }
      if (frame.type === 'error') {
        recording.current = false;
        setIsRecording(false);
        setError(frame.message);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const start = useCallback(() => {
    setError(null);
    setSteps(null);
    setCount(0);
    // Optimistic: the row has to answer the click, and a worker that never
    // confirms sends an error frame that puts it back.
    recording.current = true;
    setIsRecording(true);
    post({ type: RECORD_START });
  }, []);

  const stop = useCallback(() => {
    if (!recording.current) return;
    post({ type: RECORD_STOP });
  }, []);

  const clear = useCallback(() => {
    setSteps(null);
    setCount(0);
  }, []);

  return { isRecording, count, steps, error, start, stop, clear };
}
