'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Loader2, MessageCircle, SquarePen } from 'lucide-react';

import { useAppSelector } from '@/lib/hooks';
import { selectSessionId } from '@iblai/iblai-js/web-utils';
import { getUserName } from '@/features/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import { chatRowLabel, ChatRow } from './chat-row-label';
import { useRecentChats } from './use-recent-chats';
import {
  groupChatRowsByRecency,
  type ChatRecencyGroupKey,
} from './group-chats-by-recency';

const RECENCY_LABEL_KEYS: Record<ChatRecencyGroupKey, string> = {
  last7: 'chatsRecencyLast7Days',
  last30: 'chatsRecencyLast30Days',
  older: 'chatsRecencyOlder',
};

const ROW_CLASS =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left text-[14px] font-normal text-[#1f1f20] transition-colors hover:bg-[#f4f4f4]';

export function ChatSearchDialog({
  open,
  onOpenChange,
  tenantKey,
  mentorId,
  username,
  onNewChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantKey: string;
  mentorId: string | undefined;
  username: string | null;
  onNewChat: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  const appSessionId = useAppSelector(selectSessionId);
  const resolvedUserId = username ?? getUserName();

  const {
    recent,
    searchInput,
    setSearchInput,
    sentinelRef,
    isFetchingNextPage,
    handleSelectRow,
  } = useRecentChats({
    tenantKey,
    mentorId,
    resolvedUserId,
    appSessionId,
    open,
    onAfterNav: () => onOpenChange(false),
  });

  const groups = React.useMemo(
    () => groupChatRowsByRecency(recent, Date.now()),
    [recent],
  );

  const renderRow = (row: ChatRow) => (
    <button
      type="button"
      onClick={() => handleSelectRow(row)}
      // Same stable row identity as `ChatRowItem`: the visible label prefers
      // the asynchronously generated session title, so tests (and anything
      // else needing a deterministic handle) key on the session id.
      data-session-id={row.session_id}
      className={ROW_CLASS}
    >
      <MessageCircle
        className="size-4 shrink-0 text-[#8e8ea0]"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        {chatRowLabel(row, t('noContent'))}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(480px,80vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{t('searchChats')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('searchChatsPlaceholder')}
        </DialogDescription>

        <div className="border-b border-[#ececee] px-4 py-3.5 pr-12">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchChatsPlaceholder')}
            aria-label={t('searchChatsPlaceholder')}
            autoFocus
            className="w-full bg-transparent text-[16px] leading-6 text-[#1f1f20] outline-none placeholder:text-[#9ca3af]"
          />
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onOpenChange(false);
            }}
            className={ROW_CLASS}
          >
            <SquarePen
              className="size-4 shrink-0 text-[#5f5f61]"
              strokeWidth={1.5}
              aria-hidden
            />
            <span>{t('newChat')}</span>
          </button>

          {recent.length > 0
            ? groups.map((group) => (
                <div key={group.key}>
                  <p className="px-3 pt-3 pb-1 text-[12px] font-normal text-[#8e8ea0]">
                    {t(RECENCY_LABEL_KEYS[group.key])}
                  </p>
                  <ul className="flex flex-col" role="list">
                    {group.rows.map((row) => (
                      <li key={`search-recent-${row.session_id}`}>
                        {renderRow(row)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : null}

          {recent.length === 0 && (
            <span className="block px-3 py-2 text-[13px] text-[#94a3b8] italic">
              {t('noRecentChats')}
            </span>
          )}

          {isFetchingNextPage && (
            <div
              role="status"
              aria-label={t('loadingMoreChats')}
              className="flex items-center justify-center py-3"
            >
              <Loader2 className="size-4 animate-spin text-[#94a3b8]" />
            </div>
          )}
          <div
            ref={sentinelRef}
            data-testid="chat-search-scroll-sentinel"
            aria-hidden
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
