'use client';

import * as React from 'react';
import { useDebounce } from 'use-debounce';
import { useRouter } from 'next/navigation';

import {
  chatApiSlice,
  useAddPinnedMessageMutation,
  useDeleteMessageMutation,
  useGetPinnedMessagesQuery,
  useGetRecentMessagesInfiniteQuery,
  useUnPinMessageMutation,
} from '@iblai/iblai-js/data-layer';
import {
  chatActions,
  clearFiles,
  selectActiveChatMessages,
  selectNumberOfActiveChatMessages,
  selectStreaming,
} from '@iblai/iblai-js/web-utils';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { getUserName } from '@/features/utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { exportMessagesToXlsx } from '../export-messages';

import { ChatRow } from './chat-row-label';

export type UseRecentChatsArgs = {
  tenantKey: string;
  mentorId: string | undefined;
  resolvedUserId: string | null;
  appSessionId: string;
  open: boolean;
  onAfterNav?: () => void;
};

export function useRecentChats({
  tenantKey,
  mentorId,
  resolvedUserId,
  appSessionId,
  open,
  onAfterNav,
}: UseRecentChatsArgs) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  // The message-loader effect in `useAdvancedChat` keys EXCLUSIVELY on
  // `cachedSessionId[mentorId]` (backed by localStorage `session_id`). Row
  // clicks must write this value or the panel never repopulates — selecting
  // an existing chat would otherwise only update the URL (issue #1881).
  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<
    Record<string, string>
  >(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    /* istanbul ignore next -- @preserve localStorage deserializer */
    { deserializer: (value) => JSON.parse(value) },
  );

  const [pinMessage] = useAddPinnedMessageMutation();
  const [unpinMessage] = useUnPinMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  // Tracks the row whose pin/unpin/delete is currently in flight, so we
  // can render a spinner in its three-dot trigger slot — visual feedback
  // anchored to the exact row the user clicked.
  const [actingSessionId, setActingSessionId] = React.useState<string | null>(
    null,
  );

  // RTK Query's `Recipe<...>` type is too narrow for the SDK-typed
  // chat queries (it resolves to `InfiniteData<never, never>`). The
  // actual runtime payload is `{ results: ChatRow[] }`. Cast once via
  // `unknown` so each call site stays readable.
  type ChatCacheDraft = { results?: ChatRow[] };
  const updateChatCache = chatApiSlice.util.updateQueryData as unknown as <
    K extends 'getPinnedMessages',
  >(
    endpoint: K,
    args: object,
    recipe: (draft: ChatCacheDraft) => void,
  ) => unknown;

  // Search box (expanded mode only) — debounced into the query arg so we
  // don't refetch on every keystroke.
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch] = useDebounce(searchInput, 300);

  // Infinite-scroll sentinel — observed below to auto-load the next page.
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Recent — paginated via infinite scroll. The backend filters by `mentor`
  // and `search`; `filterByMentor` below stays as a defensive client net in
  // case the backend hasn't wired the param yet. `refetch` is invoked after
  // pin/unpin so the lists reflect server truth.
  const {
    data: recentInfiniteData,
    refetch: refetchRecent,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetRecentMessagesInfiniteQuery(
    {
      org: tenantKey,
      // @ts-ignore — userId is required at the URL path level
      userId: resolvedUserId,
      mentor: mentorId,
      search: debouncedSearch,
    },
    {
      skip: !tenantKey || !resolvedUserId,
    },
  );

  const recentRows = React.useMemo(
    () =>
      (recentInfiniteData?.pages?.flatMap((p) => p?.results ?? []) ??
        []) as ChatRow[],
    [recentInfiniteData],
  );

  // Pinned — same shape; `sessionId` arg is the cache key the SDK uses
  // for invalidation, not a row filter.
  const { data: pinnedMessages, refetch: refetchPinned } =
    useGetPinnedMessagesQuery(
      {
        org: tenantKey,
        sessionId: appSessionId,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
      },
      {
        skip: !tenantKey || !resolvedUserId,
        selectFromResult: (state) => ({
          ...state,
          data: {
            ...state.data,
            results: ((state.data as { results?: ChatRow[] } | undefined)
              ?.results ?? []) as ChatRow[],
          },
        }),
      },
    );

  const isStreaming = useAppSelector(selectStreaming);
  const numberOfActiveChatMessages = useAppSelector(
    selectNumberOfActiveChatMessages,
  );
  const activeChatMessages = useAppSelector(selectActiveChatMessages);

  React.useEffect(() => {
    if (
      getUserName() &&
      !isStreaming &&
      numberOfActiveChatMessages === 2 &&
      activeChatMessages[1]?.role === 'assistant'
    ) {
      refetchRecent();
    }
  }, [
    refetchRecent,
    isStreaming,
    numberOfActiveChatMessages,
    activeChatMessages,
  ]);

  const filterByMentor = React.useCallback(
    (list: ChatRow[]) =>
      list.filter(
        (r) =>
          !mentorId || !r.mentor?.unique_id || r.mentor.unique_id === mentorId,
      ),
    [mentorId],
  );

  // SDK types `pinnedMessages` as `PinnedMessageGet[]`, but the API
  // actually returns `{ results: [...] }`. We rebuilt that shape inside
  // `selectFromResult`, so the runtime is correct — cast through unknown.
  const pinned = React.useMemo(
    () =>
      filterByMentor(
        (pinnedMessages as unknown as { results?: ChatRow[] } | undefined)
          ?.results ?? [],
      ),
    [pinnedMessages, filterByMentor],
  );
  // Recent must EXCLUDE rows that are also in Pinned — the API returns
  // every session under recent regardless of pin state, so without this
  // dedup a pinned chat would appear in both sections (confusing UX
  // the user explicitly called out). Computing pinned first lets us
  // filter recent against it.
  const pinnedSessionIds = React.useMemo(
    () => new Set(pinned.map((p) => p.session_id)),
    [pinned],
  );
  const recent = React.useMemo(
    () =>
      filterByMentor(recentRows).filter(
        (r) => !pinnedSessionIds.has(r.session_id),
      ),
    [recentRows, filterByMentor, pinnedSessionIds],
  );

  // Auto-load the next page when the sentinel scrolls into view. Guards on
  // `hasNextPage` (single-page backends never trigger) and `isFetchingNextPage`
  // (no overlapping loads). `open` is a dep so the observer re-attaches when
  // the collapsible expands and the sentinel mounts.
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, open]);

  // Helpers shared by both lists ---------------------------------------

  const navHrefFor = (row: ChatRow): string | undefined => {
    const m = row.mentor?.unique_id;
    if (!m || !tenantKey) return undefined;
    return `/platform/${tenantKey}/${m}?session=${encodeURIComponent(
      String(row.session_id),
    )}`;
  };

  // Selecting an existing chat. Navigating (`router.push(?session=...)`) is
  // NOT enough on its own — nothing reads the query param back into state.
  // We must also point the chat slice + the cached session id at the picked
  // session so the loader effect re-fires and repaints the message panel.
  // Clicking the already-active chat is a no-op for state (we only navigate /
  // close the flyout) to avoid thrashing the in-flight session.
  const handleSelectRow = (row: ChatRow) => {
    const href = navHrefFor(row);
    if (!href) return;

    if (row.session_id !== appSessionId) {
      // Different session: tear down any in-flight streaming/typing state and
      // file context from the previous chat before pointing everything at the
      // newly selected session.
      dispatch(clearFiles(undefined));
      eventBus.emit(RemoteEvents.stopChatGenerating);
      dispatch(chatActions.resetIsTyping(undefined));
      dispatch(chatActions.setStreaming(false));
      dispatch(chatActions.resetCurrentStreamingMessage(undefined));
      dispatch(chatActions.setActiveTab('chat'));
      dispatch(chatActions.updateSessionIds(row.session_id));
      dispatch(chatActions.setShouldStartNewChat(false));

      // The localStorage `session_id` value the loader effect watches. This
      // is the dependency that triggers getChats() → setNewMessages.
      if (mentorId) {
        saveCachedSessionId({
          ...cachedSessionId,
          [mentorId]: row.session_id,
        });
      }
    }

    router.push(href);
    onAfterNav?.();
  };

  const handlePin = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      const result = await pinMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        requestBody: { session_id: row.session_id },
      }).unwrap();
      // Optimistic patch so the row appears in Pinned immediately. The
      // `Promise.all` refetch right after is the source of truth — if the
      // server transforms the row (e.g. adds a title, timestamp) we want
      // to see those properties on the next render. Recent cache is NOT
      // mutated here so the UI's `pinnedSessionIds` dedup is the single
      // signal hiding the row from Recent until it's unpinned.
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = draft.results ?? [];
            draft.results.push((result ?? row) as ChatRow);
          },
        ) as never,
      );
      await Promise.all([refetchRecent(), refetchPinned()]);
    } catch (err) {
      console.error('Failed to pin message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleUnpin = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      // Same shape as `pinMessage` — `requestBody: { session_id }` is
      // what the backend's DELETE handler expects. SDK service signature
      // needs to declare `requestBody: PinnedMessageRequest` for this
      // to typecheck cleanly (see note below).
      await unpinMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        // @ts-ignore — requestBody not yet declared on the SDK's
        // `aiMentorOrgsUsersPinMessageDestroy` service signature.
        requestBody: { session_id: row.session_id },
      }).unwrap();
      // Optimistic: pop out of Pinned. The dedup in `recent` then
      // re-includes the row on next render. Refetch in parallel so we
      // converge on server truth without an extra round-trip.
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
      await Promise.all([refetchRecent(), refetchPinned()]);
    } catch (err) {
      console.error('Failed to unpin message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleDelete = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      await deleteMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        sessionId: row.session_id,
      }).unwrap();
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
      // Recent now renders from the infinite query, so we refetch to drop the
      // deleted row from the paginated pages.
      void refetchRecent();
      // Active-session safety: clear file context and start a new chat
      // so the canvas/composer doesn't keep pointing at a deleted session.
      if (row.session_id === appSessionId) {
        dispatch(clearFiles(undefined));
        eventBus.emit(RemoteEvents.newChat);
        dispatch(chatActions.setShouldStartNewChat(true));
      }
    } catch (err) {
      console.error('Failed to delete message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleExport = (row: ChatRow) => {
    // Delegate to the shared sibling helper — it uses `write-excel-file`
    // (already a project dep) and is covered by `export-messages.test.ts`.
    exportMessagesToXlsx(row.messages ?? []);
  };

  return {
    pinned,
    recent,
    searchInput,
    setSearchInput,
    sentinelRef,
    isFetchingNextPage,
    actingSessionId,
    handleSelectRow,
    handlePin,
    handleUnpin,
    handleDelete,
    handleExport,
  };
}
