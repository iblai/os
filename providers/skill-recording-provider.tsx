'use client';

import { createContext, useContext } from 'react';

import {
  useSkillRecording,
  type SkillRecording,
} from '@/hooks/use-skill-recording';

const SkillRecordingContext = createContext<SkillRecording | null>(null);

/**
 * One recording, shared by the row that starts it and the review the chat
 * area shows afterwards — they sit in different parts of the tree.
 */
export function SkillRecordingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const recording = useSkillRecording();
  return (
    <SkillRecordingContext.Provider value={recording}>
      {children}
    </SkillRecordingContext.Provider>
  );
}

/** Null outside the panel, where nothing records. */
export function useSkillRecordingContext(): SkillRecording | null {
  return useContext(SkillRecordingContext);
}
