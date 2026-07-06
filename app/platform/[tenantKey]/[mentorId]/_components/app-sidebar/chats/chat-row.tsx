'use client';

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
