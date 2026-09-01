'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Circle, CircleCheck, CircleDot } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { todosProgress, type Todo } from '@iblai/iblai-js/web-utils';

/**
 * Minimum gap between screen-reader announcements. A Base Agent can rewrite its
 * plan several times a second while working, and every `write_todos` call
 * replaces the whole list — announcing each one unthrottled would flood a
 * screen reader. Only the summary is ever announced, never the list itself.
 */
export const TODO_ANNOUNCE_THROTTLE_MS = 2000;

interface AgentTodoListProps {
  todos: Todo[] | undefined;
  isCurrentlyStreaming?: boolean;
}

interface StatusMeta {
  Icon: typeof Circle;
  labelKey: string;
  iconClass: string;
  contentClass: string;
}

/**
 * Status presentation. Colour is never the only cue (WCAG 1.4.1): each status
 * has a distinct icon *shape* — check / filled dot / hollow circle — plus a
 * strikethrough on completed rows. The status word itself is rendered
 * `sr-only`, so assistive tech announces it without the visual clutter of a
 * label on every row.
 */
const STATUS_META: Record<string, StatusMeta> = {
  completed: {
    Icon: CircleCheck,
    labelKey: 'agentTodoStatusCompleted',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    contentClass: 'text-gray-500 line-through dark:text-gray-500',
  },
  in_progress: {
    Icon: CircleDot,
    labelKey: 'agentTodoStatusInProgress',
    iconClass: 'text-blue-600 dark:text-blue-400',
    // The in-progress row's text carries a left-to-right shimmer so the active
    // step is obvious at a glance now that no row shows a written status.
    // `.todo-shimmer` (app/globals.css) owns the colour, since it paints the
    // glyphs with a clipped gradient — don't add a `text-*` utility here or it
    // will fight the `color: transparent` the clip depends on.
    contentClass: 'todo-shimmer font-medium',
  },
  pending: {
    Icon: Circle,
    labelKey: 'agentTodoStatusPending',
    iconClass: 'text-gray-400 dark:text-gray-500',
    contentClass: 'text-gray-700 dark:text-gray-300',
  },
};

/**
 * The SDK already normalizes unknown statuses to `pending`, but the fallback
 * keeps a row visible rather than crashing if a raw todo ever reaches the UI.
 */
function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? STATUS_META.pending;
}

export function AgentTodoList({
  todos,
  isCurrentlyStreaming = false,
}: AgentTodoListProps) {
  const t = useTranslations('chatAiMessageBubble');

  // Default expanded while the turn is still streaming so the user can watch
  // the agent work; collapse once it completes so finished conversations stay
  // readable. Mirrors `tool-call-item.tsx`.
  const [isOpen, setIsOpen] = useState(() => isCurrentlyStreaming);

  useEffect(() => {
    if (!isCurrentlyStreaming) {
      setIsOpen(false);
    }
  }, [isCurrentlyStreaming]);

  const items = todos ?? [];
  const { done, total } = todosProgress(todos);
  const hasTodos = total > 0;

  // Throttled polite announcement — summary only.
  const [announcement, setAnnouncement] = useState('');
  const lastAnnouncedAtRef = useRef(0);
  const pendingRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const summaryAnnouncement = hasTodos
    ? t('agentTodoAnnouncement', { done, total })
    : '';

  useEffect(() => {
    if (!summaryAnnouncement) return;

    const elapsed = Date.now() - lastAnnouncedAtRef.current;

    if (elapsed >= TODO_ANNOUNCE_THROTTLE_MS) {
      lastAnnouncedAtRef.current = Date.now();
      setAnnouncement(summaryAnnouncement);
      return;
    }

    // Inside the throttle window: remember the newest summary and let the
    // already-scheduled trailing announcement pick it up. Everything in
    // between is dropped rather than queued, so the screen reader hears one
    // update per window no matter how fast the agent rewrites its plan.
    pendingRef.current = summaryAnnouncement;
    if (timerRef.current !== null) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastAnnouncedAtRef.current = Date.now();
      setAnnouncement(pendingRef.current);
    }, TODO_ANNOUNCE_THROTTLE_MS - elapsed);
  }, [summaryAnnouncement]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  // No `write_todos` call on this turn -> no affordance at all.
  if (!hasTodos) {
    return null;
  }

  const summary = t('agentTodoProgress', { done, total });

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-2"
      data-testid="agent-todo-list"
    >
      <CollapsibleTrigger
        className="flex cursor-pointer items-center gap-1 pt-1 text-xs text-gray-500 transition-colors hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
        data-testid="agent-todo-list-trigger"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <span className="font-medium">{t('agentTodoListTitle')}</span>
        <span
          className="text-gray-400 dark:text-gray-500"
          data-testid="agent-todo-list-progress"
        >
          — {summary}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">
        <ol
          className="space-y-1.5 border-l-2 border-gray-200 pt-2 pl-3 text-xs leading-relaxed dark:border-gray-700"
          data-testid="agent-todo-list-items"
        >
          {items.map((todo, index) => {
            const meta = getStatusMeta(todo.status);
            const { Icon } = meta;
            const statusLabel = t(meta.labelKey);

            return (
              <li
                key={`${index}-${todo.content}`}
                className="flex items-start gap-1.5"
                data-testid="agent-todo-item"
                data-status={todo.status}
              >
                <Icon
                  aria-hidden="true"
                  className={cn('mt-0.5 h-3 w-3 shrink-0', meta.iconClass)}
                />
                <span className="sr-only">{statusLabel}</span>
                <span className={cn('min-w-0 flex-1', meta.contentClass)}>
                  {todo.content}
                </span>
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="agent-todo-list-announcer"
      >
        {announcement}
      </div>
    </Collapsible>
  );
}
