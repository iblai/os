'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Pin } from 'lucide-react';

import { useAppSelector } from '@/lib/hooks';
import { selectSessionId, useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { getUserName } from '@/features/utils';
import { useUserIsStudent } from '@/hooks/use-user';
import { cn } from '@/lib/utils';
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

import { ChatRow, chatRowLabel } from './chat-row-label';
import { ChatRowItem } from './chat-row';
import { useRecentChats } from './use-recent-chats';

const NAV_MUTED = '#5f5f61';
const FLYOUT_TITLE_COLOR = '#646676';
const FLYOUT_ITEM_COLOR = '#1f1f20';
const NAV_ACTIVE_BG_OPEN =
  'data-[state=open]:bg-[#cfe8fa]/40 data-[state=open]:hover:bg-[#cfe8fa]/50';

export function SidebarChatsSection({
  collapsed,
  open,
  onOpenChange,
  onCollapsedIconClick,
  tenantKey,
  mentorId,
  username,
  onAfterNav,
}: {
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollapsedIconClick?: () => void;
  tenantKey: string;
  mentorId: string | undefined;
  username: string | null;
  onAfterNav?: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  const appSessionId = useAppSelector(selectSessionId);
  const resolvedUserId = username ?? getUserName();
  const userIsStudent = useUserIsStudent();
  const { metadata } = useTenantMetadata({ org: tenantKey });
  const canExport =
    !userIsStudent || metadata?.enable_chat_history_export !== false;

  const {
    pinned,
    recent,
    sentinelRef,
    actingSessionId,
    handleSelectRow,
    handlePin,
    handleUnpin,
    handleDelete,
    handleExport,
  } = useRecentChats({
    tenantKey,
    mentorId,
    resolvedUserId,
    appSessionId,
    open,
    onAfterNav,
  });

  // Render helpers -----------------------------------------------------

  const renderRow = (row: ChatRow, kind: 'pinned' | 'recent') => (
    <ChatRowItem
      key={`${kind}-${row.session_id}`}
      row={row}
      active={row.session_id === appSessionId}
      onSelect={() => handleSelectRow(row)}
      isPinned={kind === 'pinned'}
      isLoading={actingSessionId === row.session_id}
      canExport={canExport}
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
            {pinned.map((row) => (
              <button
                key={`flyout-pinned-${row.session_id}`}
                type="button"
                onClick={() => handleSelectRow(row)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
                style={{ color: FLYOUT_ITEM_COLOR }}
              >
                <span className="sr-only">{t('pinned')}</span>
                <span className="min-w-0 flex-1 truncate">
                  {chatRowLabel(row, t('noContent'))}
                </span>
                {/* The flyout has no row menu to make way for, so the pin
                    simply stays — in the same trailing slot the expanded
                    list keeps it in. */}
                <Pin
                  className="size-3.5 shrink-0 text-[#9ca3af]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </button>
            ))}
            {/* Pinned first, then recent, and no headings over either: the
                panel is already called Recents, and a pin on the row says
                more than a caps label over a group does. */}
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
            <ul
              className="flex flex-col gap-0.5"
              role="list"
              data-testid="pinned-chats-list"
            >
              {pinned.map((row) => (
                <li key={`pinned-${row.session_id}`}>
                  {renderRow(row, 'pinned')}
                </li>
              ))}
            </ul>
          )}
          {/* Neither group is headed any more: pinned rows sort to the top
              and say so with a pin on the row. The lists carry testids
              instead, because the headings used to be what the e2e page
              object located them by. */}
          {recent.length > 0 ? (
            <ul
              className="flex flex-col gap-0.5"
              role="list"
              data-testid="recent-chats-list"
            >
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
          <div
            ref={sentinelRef}
            data-testid="recent-scroll-sentinel"
            aria-hidden
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
