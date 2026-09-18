'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chatActions, selectActiveTab } from '@iblai/iblai-js/web-utils';
import {
  addPermissionRequest,
  dropPermissionRequest,
} from '@/components/chat/code-permission-card';
import { readCoworkApprovals } from '@/lib/cowork-approvals';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';

const EVENT = 'MENTOR:BROWSE_EVENT';

/** Mirror of `OutboundMessage` in `extensions/chrome/src/browse-protocol.ts`. */
type Frame =
  | { type: 'ack' }
  | { type: 'event'; event: { type: string; text?: string } }
  | { type: 'log'; text: string; ok: boolean }
  | { type: 'confirm'; id: number; description: string }
  | { type: 'done'; text: string; note?: string }
  | { type: 'error'; message: string };

const post = (message: unknown) => window.parent.postMessage(message, '*');

/**
 * A Browse run, rendered as one ordinary assistant turn.
 *
 * The loop itself lives in the extension's service worker — it is the only place
 * with `chrome.scripting` — so this drives the same Redux streaming lifecycle
 * `useRemoteChat` uses for a remote-AI turn (setCurrentStreamingMessage →
 * per-delta ensureStreamingAssistantMessage → appendMessageToActiveTab on
 * finish), which is what makes the run look like every other reply instead of a
 * second surface.
 */
export function useBrowseRun() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveTab);
  const [isRunning, setIsRunning] = useState(false);

  const generation = useRef('');
  const content = useRef('');
  const tools = useRef(0);
  const openConfirms = useRef(new Set<string>());

  const commit = useCallback(
    (text: string) => {
      content.current = text;
      dispatch(
        chatActions.setStreamingMessageIdAndContent({
          id: generation.current,
          content: text,
        }),
      );
      dispatch(chatActions.ensureStreamingAssistantMessage(undefined));
    },
    [dispatch],
  );

  const finish = useCallback(
    (tail?: string) => {
      if (!generation.current) return;
      if (tail)
        commit(content.current ? `${content.current}\n\n${tail}` : tail);
      // Any prompt still on screen can no longer be answered — the worker has
      // stopped listening for it.
      for (const id of openConfirms.current) dropPermissionRequest(id);
      openConfirms.current.clear();
      dispatch(chatActions.appendMessageToActiveTab(undefined));
      dispatch(chatActions.resetCurrentStreamingMessage(undefined));
      // Back to idle, which is also what un-hides the guided prompts and makes
      // them refetch — the same ending as a normal turn.
      dispatch(chatActions.setStatus('idle'));
      generation.current = '';
      setIsRunning(false);
    },
    [commit, dispatch],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data as { type?: string; payload?: Frame } | null;
      if (data?.type !== EVENT || !data.payload || !generation.current) return;
      const frame = data.payload;

      switch (frame.type) {
        case 'ack':
          // The panel has it; nothing to show, but the run is alive.
          break;
        case 'event':
          if (frame.event.type === 'text' && frame.event.text) {
            commit(content.current + frame.event.text);
          }
          break;
        case 'log':
          dispatch(
            chatActions.addToolCall({
              id: `${generation.current}-${tools.current++}`,
              name: 'browse',
              log: frame.text,
              result: frame.ok ? 'ok' : 'failed',
            }),
          );
          dispatch(chatActions.ensureStreamingAssistantMessage(undefined));
          break;
        case 'confirm': {
          const requestId = `${generation.current}-confirm-${frame.id}`;
          openConfirms.current.add(requestId);
          addPermissionRequest({
            request_id: requestId,
            generation_id: generation.current,
            session_id: generation.current,
            title: frame.description,
            kind: 'execute',
            command: null,
            allow_option_id: 'allow',
            reject_option_id: 'deny',
            respond: (optionId) => {
              // The card drops it too, but a direct caller must not be able to
              // leave a prompt on screen that has already been answered.
              openConfirms.current.delete(requestId);
              dropPermissionRequest(requestId);
              post({
                type: 'MENTOR:BROWSE_CONFIRM',
                id: frame.id,
                ok: optionId === 'allow',
              });
            },
          });
          break;
        }
        case 'error':
          finish(frame.message);
          break;
        case 'done':
          finish(frame.note);
          break;
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [commit, dispatch, finish]);

  const run = useCallback(
    (goal: string) => {
      if (isRunning) return;
      const id = `browse-${Date.now()}`;
      generation.current = id;
      content.current = '';
      tools.current = 0;
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: goal,
        timestamp: new Date().toISOString(),
        visible: true,
      };
      // `addUserMessage` spreads `state.chats[tab]`, which throws when that tab
      // has no array yet — and a throw here would abort the submit, losing the
      // text the user typed. Seeding the tab is the recovery, not a guess about
      // which shape the store is in.
      try {
        dispatch(
          chatActions.addUserMessage({ tab: activeTab, message: userMessage }),
        );
      } catch {
        dispatch(chatActions.setNewMessages([userMessage]));
      }
      dispatch(
        chatActions.setCurrentStreamingMessage({
          id,
          content: '',
          reasoningContent: '',
          toolCalls: [],
          isReasoning: false,
        }),
      );
      // `setStatus`, NOT `setStreaming`: the chat reads `state.status`
      // (`selectStreaming` / `selectIsPending` both derive from it) and nothing
      // reads what `setStreaming` writes. Getting this wrong made the whole run
      // invisible — no working indicator, no streaming bubble, no Stop button,
      // and the guided prompts stayed on screen for the duration.
      // `'streaming'` rather than `'pending'` because the bubble that carries
      // the tool log and the text is gated on `isStreaming` alone.
      dispatch(chatActions.setStatus('streaming'));
      setIsRunning(true);
      // Read per run, not per mount: the user can change Approvals between
      // turns, and the worker has no way to see the app's localStorage.
      post({
        type: 'MENTOR:BROWSE_RUN',
        goal,
        auto: readCoworkApprovals() === 'auto',
      });
    },
    [activeTab, dispatch, isRunning],
  );

  const stop = useCallback(() => {
    if (!isRunning) return;
    post({ type: 'MENTOR:BROWSE_STOP' });
  }, [isRunning]);

  return { run, stop, isRunning };
}
