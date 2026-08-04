'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Download,
  Loader2,
  MoreVertical,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ChatRow, chatRowLabel } from './chat-row-label';

function ChatThreeDotMenu({
  isPinned,
  isLoading,
  canExport = true,
  open,
  onOpenChange,
  onPinToggle,
  onExport,
  onDelete,
}: {
  isPinned: boolean;
  isLoading: boolean;
  canExport?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
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
            // `group-hover/chat-row`, not `group-hover`: the shared Sidebar
            // wrapper is itself a `.group`, so the unnamed variant matched a
            // hover anywhere in the sidebar and lit up every row's menu at
            // once. The name pins the hover to this row.
            isLoading
              ? 'opacity-100'
              : 'opacity-0 group-hover/chat-row:opacity-100',
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
        {canExport && (
          <DropdownMenuItem className="gap-2" onSelect={onExport}>
            <Download
              className="size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            {t('export')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="gap-2" onSelect={onDelete}>
          <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatRowItem({
  row,
  active,
  onSelect,
  isPinned,
  isLoading,
  canExport = true,
  awaitingPermission = false,
  onPinToggle,
  onExport,
  onDelete,
}: {
  row: ChatRow;
  active: boolean;
  onSelect: () => void;
  isPinned: boolean;
  isLoading: boolean;
  canExport?: boolean;
  /** Code is blocked on a permission answer in this chat. */
  awaitingPermission?: boolean;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('appSidebarIndex');
  const [menuOpen, setMenuOpen] = React.useState(false);
  // Hover is the CSS half; these are the states hover cannot see. An open
  // menu or an in-flight action owns the slot outright — by then the pointer
  // may well be somewhere else entirely.
  const showPin = isPinned && !menuOpen && !isLoading;

  return (
    <div className="group/chat-row relative" data-testid="chat-row">
      <button
        type="button"
        onClick={onSelect}
        // Stable machine-readable identity for the row. The visible label
        // prefers the backend-generated session title (chatRowLabel), which
        // is produced asynchronously — so the text a user typed can vanish
        // from the DOM at any moment. E2E tests locate rows via this
        // attribute instead of the label.
        data-session-id={row.session_id}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 pr-8 text-left text-[14px] font-normal transition-colors',
          active
            ? 'bg-[#eef6fc] text-[#1e40af]'
            : 'text-[#4a5568] hover:bg-[#f4f4f4]',
        )}
      >
        {/* Pinned rows are marked on the row itself rather than gathered
            under a "Pinned" heading: they still sort to the top, and the
            list reads as one list instead of two. The mark itself is drawn
            in the three-dot slot below; this is the half a screen reader
            needs, since it cannot see either. */}
        {isPinned && <span className="sr-only">{t('pinned')}</span>}
        {/* Code's prompts only render in the chat that raised them, so a background
            chat would otherwise wait unseen and time out as denied after 180s. This is
            the only signal telling the user where to look — deliberately in the row's
            own muted grey rather than an accent colour, so it reads as a hint you can
            find when you look for it, not an alert competing with the chat title. */}
        {awaitingPermission && (
          <span
            data-testid="chat-awaiting-permission"
            title={t('awaitingPermission')}
            aria-label={t('awaitingPermission')}
            className="size-1.5 shrink-0 rounded-full bg-[#9ca3af]"
          />
        )}
        <span className="line-clamp-1 min-w-0 flex-1 overflow-hidden">
          {chatRowLabel(row, t('noContent'))}
        </span>
      </button>
      {/* One slot, two occupants. A pinned row wears its pin until you
          reach for the row, at which point the pin steps aside for the menu
          that can unpin it. An unpinned row's slot stays empty until then,
          so a quiet list stays quiet. */}
      {/* `right-0`, not an inset: flush with the row's own edge, the 24px
          slot centres on the same axis as the chevron on the Recents trigger
          above it — the icons down the right-hand side line up. */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2">
        {showPin && (
          <span
            data-testid="chat-row-pin"
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#9ca3af] transition-opacity group-hover/chat-row:opacity-0"
          >
            <Pin className="size-3.5" strokeWidth={1.75} />
          </span>
        )}
        <ChatThreeDotMenu
          isPinned={isPinned}
          isLoading={isLoading}
          canExport={canExport}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onPinToggle={onPinToggle}
          onExport={onExport}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
