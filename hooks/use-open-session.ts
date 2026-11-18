'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch } from '@reduxjs/toolkit';
import { chatActions, clearFiles } from '@iblai/iblai-js/web-utils';

import { sessionCacheKey } from '@/lib/utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { useAppDispatch } from '@/lib/hooks';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';

type CachedSessionIds = Record<string, string>;

/**
 * Point the chat at an existing session.
 *
 * Two callers share this: the recent-chats sidebar, and an embed asked to
 * open a particular session. They have to agree — a second copy of this
 * would drift, and the half that drifted would leave streaming state from
 * the previous chat attached to the new one.
 *
 * The actual load is not done here. Writing the session id into the cached
 * map is what the SDK's loader effect watches, and it fetches that session's
 * messages for the signed-in user. A session that is not theirs, or belongs
 * to another agent, simply comes back with nothing — the backend stays the
 * one authority on who may read what, rather than this app guessing.
 */
export function selectChatSession({
  sessionId,
  tenantKey,
  mentorId,
  dispatch,
  cachedSessionIds,
  saveCachedSessionIds,
}: {
  sessionId: string;
  tenantKey: string;
  mentorId: string;
  dispatch: Dispatch;
  cachedSessionIds: CachedSessionIds;
  saveCachedSessionIds: (value: CachedSessionIds) => void;
}): void {
  // Tear down any in-flight streaming, typing and file context from the
  // previous chat before pointing everything at the new session.
  dispatch(clearFiles(undefined));
  eventBus.emit(RemoteEvents.stopChatGenerating);
  dispatch(chatActions.resetIsTyping(undefined));
  dispatch(chatActions.setStreaming(false));
  dispatch(chatActions.resetCurrentStreamingMessage(undefined));
  dispatch(chatActions.setActiveTab('chat'));
  dispatch(chatActions.updateSessionIds(sessionId));
  dispatch(chatActions.setShouldStartNewChat(false));

  saveCachedSessionIds({
    ...cachedSessionIds,
    [sessionCacheKey(tenantKey, mentorId)]: sessionId,
  });
}

/**
 * Open the session named by `?session=` once, on load.
 *
 * An embedded agent is often placed to continue a particular conversation
 * rather than start a fresh one, and the host has no way to say so today.
 * The agent-ai component already forwards arbitrary query params through
 * `extraparams`, so a host passing `session=<id>` arrives here.
 *
 * Applied once per session id: re-running it on every render would fight the
 * user every time they picked a different chat from the sidebar.
 */
export function useOpenSessionFromUrl({
  sessionId,
  tenantKey,
  mentorId,
}: {
  sessionId: string | null;
  tenantKey: string | undefined;
  mentorId: string | undefined;
}): void {
  const dispatch = useAppDispatch();
  const [cachedSessionIds, saveCachedSessionIds] = useLocalStorage<
    Record<string, string>
  >(LOCAL_STORAGE_KEYS.SESSION_ID, {});
  const appliedRef = useRef<string | null>(null);

  // `cachedSessionIds` is read, not depended on: including it would re-run
  // this the moment the write below lands.
  const cachedRef = useRef(cachedSessionIds);
  cachedRef.current = cachedSessionIds;

  useEffect(() => {
    if (!sessionId || !tenantKey || !mentorId) return;
    if (appliedRef.current === sessionId) return;
    appliedRef.current = sessionId;

    // Already the active session for this agent — selecting it again would
    // tear down a chat that is already the right one.
    if (cachedRef.current[sessionCacheKey(tenantKey, mentorId)] === sessionId) {
      return;
    }

    selectChatSession({
      sessionId,
      tenantKey,
      mentorId,
      dispatch,
      cachedSessionIds: cachedRef.current,
      saveCachedSessionIds,
    });
  }, [sessionId, tenantKey, mentorId, dispatch, saveCachedSessionIds]);
}
