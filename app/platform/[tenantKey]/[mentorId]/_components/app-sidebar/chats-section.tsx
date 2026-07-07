'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PLATFORM_SIDEBAR_FLYOUT_ITEM_COLOR as FLYOUT_ITEM_COLOR,
  PLATFORM_SIDEBAR_FLYOUT_TITLE_COLOR as FLYOUT_TITLE_COLOR,
  PLATFORM_SIDEBAR_NAV_ACTIVE_BG_OPEN as NAV_ACTIVE_BG_OPEN,
  PLATFORM_SIDEBAR_NAV_MUTED as NAV_MUTED,
  usePlatformSidebarNavCallback,
} from '@iblai/iblai-js/web-containers/next';

import {
  chatApiSlice,
  useAddPinnedMessageMutation,
  useDeleteMessageMutation,
  useGetPinnedMessagesQuery,
  useGetRecentMessageQuery,
  useUnPinMessageMutation,
} from '@iblai/iblai-js/data-layer';
import {
  chatActions,
  clearFiles,
  selectActiveChatMessages,
  selectNumberOfActiveChatMessages,
  selectSessionId,
  selectStreaming,
} from '@iblai/iblai-js/web-utils';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  cn,
  getCurrentArtifactTitle,
  getFirstMessageWithContent,
} from '@/lib/utils';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { getUserName } from '@/features/utils';
import Markdown from '@/components/markdown';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { exportMessagesToXlsx } from './export-messages';

// =============================================================================
// Chats section — Pinned + Recent with per-row three-dot menu (Pin/Unpin,
// Export, Delete). Port of the OLD `recent-messages.tsx` + `pinned-messages.tsx`
// pair onto the new sidebar's visual style. Renders both a rail-mode flyout
// and an expanded-mode collapsible.
// =============================================================================

type ChatRow = {
  session_id: string;
  mentor?: { unique_id?: string | null; profile_image?: string | null } | null;
  messages?: unknown;
};

function chatRowLabel(row: ChatRow, noContentLabel: string): React.ReactNode {
  const messages = (row.messages as unknown[]) ?? [];
  const content = getFirstMessageWithContent(messages as never);
  if (content) {
    return (
      <Markdown className="!space-y-0 [&_*]:!my-0 [&_*]:!text-[14px] [&_*]:!leading-snug [&_*]:!font-normal [&_*]:!text-inherit [&_h2]:!border-0">
        {content}
      </Markdown>
    );
  }
  const artifactTitle = getCurrentArtifactTitle(messages as never);
  return artifactTitle || noContentLabel;
}

function ChatThreeDotMenu({
  isPinned,
  isLoading,
  onPinToggle,
  onExport,
  onDelete,
}: {
  isPinned: boolean;
  isLoading: boolean;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isLoading}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
          // `MoreVertical` matches the per-project three-dot trigger in
          // `SidebarProjectsSection` so both lists feel consistent. While
          // an action on THIS row is in flight, the icon is swapped for
          // a spinner — the user knows exactly which row is processing.
          className={cn(
            'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#7d7e82] transition-opacity hover:bg-[#eef0f3] hover:text-[#1f2937] data-[state=open]:opacity-100',
            isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          aria-label={t('chatActions')}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <Loader2
              className="size-3.5 animate-spin"
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <MoreVertical className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem className="gap-2" onSelect={onPinToggle}>
          {isPinned ? (
            <PinOff
              className="size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
          ) : (
            <Pin className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          )}
          {isPinned ? t('unpin') : t('pin')}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onExport}>
          <Download
            className="size-3.5 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          {t('export')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-red-600 focus:text-red-700"
          onSelect={onDelete}
        >
          <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChatRowItem({
  row,
  active,
  onSelect,
  isPinned,
  isLoading,
  onPinToggle,
  onExport,
  onDelete,
}: {
  row: ChatRow;
  active: boolean;
  onSelect: () => void;
  isPinned: boolean;
  isLoading: boolean;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 pr-8 text-left text-[14px] font-normal transition-colors',
          active
            ? 'bg-[#eef6fc] text-[#1e40af]'
            : 'text-[#4a5568] hover:bg-[#f4f4f4]',
        )}
      >
        <span className="line-clamp-1 min-w-0 flex-1 overflow-hidden">
          {chatRowLabel(row, t('noContent'))}
        </span>
      </button>
      <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
        <ChatThreeDotMenu
          isPinned={isPinned}
          isLoading={isLoading}
          onPinToggle={onPinToggle}
          onExport={onExport}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

export function SidebarChatsSection({
  collapsed,
  open,
  onOpenChange,
  onCollapsedIconClick,
  tenantKey,
  mentorId,
  username,
}: {
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollapsedIconClick?: () => void;
  tenantKey: string;
  mentorId: string | undefined;
  username: string | null;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { onAfterNav } = usePlatformSidebarNavCallback();
  const t = useTranslations('appSidebarIndex');
  const appSessionId = useAppSelector(selectSessionId);
  const resolvedUserId = username ?? getUserName();
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
    K extends 'getRecentMessage' | 'getPinnedMessages',
  >(
    endpoint: K,
    args: object,
    recipe: (draft: ChatCacheDraft) => void,
  ) => unknown;

  // Recent — scoped to the current mentor in the cache selector so we
  // don't paint rows from other agents. `refetch` is invoked after
  // pin/unpin so the lists reflect server truth (no stale optimistic
  // state if the server transitions the row in unexpected ways).
  const { data: recentMessages, refetch: refetchRecent } =
    useGetRecentMessageQuery(
      {
        org: tenantKey,
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
      filterByMentor(
        (recentMessages as unknown as { results?: ChatRow[] } | undefined)
          ?.results ?? [],
      ).filter((r) => !pinnedSessionIds.has(r.session_id)),
    [recentMessages, filterByMentor, pinnedSessionIds],
  );

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
          'getRecentMessage',
          { org: tenantKey, userId: resolvedUserId },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
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

  // Render helpers -----------------------------------------------------

  const renderRow = (row: ChatRow, kind: 'pinned' | 'recent') => (
    <ChatRowItem
      key={`${kind}-${row.session_id}`}
      row={row}
      active={row.session_id === appSessionId}
      onSelect={() => handleSelectRow(row)}
      isPinned={kind === 'pinned'}
      isLoading={actingSessionId === row.session_id}
      onPinToggle={() =>
        kind === 'pinned' ? handleUnpin(row) : handlePin(row)
      }
      onExport={() => handleExport(row)}
      onDelete={() => handleDelete(row)}
    />
  );

  if (collapsed) {
    return (
      <HoverCard openDelay={180} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={onCollapsedIconClick}
            className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#c4c4c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
            aria-label={t('chats')}
          >
            <MessageSquare
              className="size-4 shrink-0"
              style={{ color: NAV_MUTED }}
              strokeWidth={1.5}
            />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          className="z-[200] flex max-h-[70vh] w-max max-w-[320px] min-w-[240px] flex-col rounded-2xl border border-[#e6e6e8] bg-white px-3 py-2.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
        >
          <span
            className="mb-1.5 shrink-0 text-[13px] leading-tight font-medium"
            style={{ color: FLYOUT_TITLE_COLOR }}
          >
            {t('chats')}
          </span>
          <div className="scrollbar-thin min-h-0 overflow-y-auto pr-1">
            {pinned.length > 0 && (
              <>
                <p className="px-1 pb-1 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  {t('pinned')}
                </p>
                {pinned.map((row) => (
                  <button
                    key={`flyout-pinned-${row.session_id}`}
                    type="button"
                    onClick={() => handleSelectRow(row)}
                    className="block w-full truncate rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
                    style={{ color: FLYOUT_ITEM_COLOR }}
                  >
                    {chatRowLabel(row, t('noContent'))}
                  </button>
                ))}
              </>
            )}
            <p
              className={cn(
                'px-1 pb-1 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase',
                pinned.length > 0 && 'pt-2',
              )}
            >
              {t('recent')}
            </p>
            {recent.length > 0 ? (
              recent.map((row) => (
                <button
                  key={`flyout-recent-${row.session_id}`}
                  type="button"
                  onClick={() => handleSelectRow(row)}
                  className="block w-full truncate rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
                  style={{ color: FLYOUT_ITEM_COLOR }}
                >
                  {chatRowLabel(row, t('noContent'))}
                </button>
              ))
            ) : (
              <span className="block rounded-md px-1.5 py-1.5 text-[14px] text-[#94a3b8] italic">
                {t('noRecentChats')}
              </span>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  const triggerClassName = cn(
    'flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] outline-none transition-colors hover:bg-[#f4f4f4] focus-visible:ring-2 focus-visible:ring-[#cfe8fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]',
    NAV_ACTIVE_BG_OPEN,
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <CollapsibleTrigger asChild>
        <button type="button" className={triggerClassName}>
          <MessageSquare
            className="size-4 shrink-0"
            style={{ color: NAV_MUTED }}
            strokeWidth={1.5}
          />
          <span className="min-w-0 flex-1 truncate">{t('chats')}</span>
          {open ? (
            <ChevronDown
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          ) : (
            <ChevronRight
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="mt-0.5 mr-1 ml-1.5 border-l-2 border-[#e2e8f0] pb-0.5 pl-2.5">
          {pinned.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                {t('pinned')}
              </p>
              <ul className="flex flex-col gap-0.5" role="list">
                {pinned.map((row) => (
                  <li key={`pinned-${row.session_id}`}>
                    {renderRow(row, 'pinned')}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p
            className={cn(
              'px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase',
              pinned.length > 0 && 'mt-1',
            )}
          >
            {t('recent')}
          </p>
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-0.5" role="list">
              {recent.map((row) => (
                <li key={`recent-${row.session_id}`}>
                  {renderRow(row, 'recent')}
                </li>
              ))}
            </ul>
          ) : (
            <span className="block px-2 py-1.5 text-[13px] text-[#94a3b8] italic">
              {t('noRecentChats')}
            </span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
