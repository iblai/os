'use client';

/**
 * Inline permission prompts for Code (opencode over ACP).
 *
 * These ARE the security boundary. Code runs the agent as an ordinary child process at
 * the user's own privilege — nothing confines it to the workspace — so every operation
 * it wants to perform emits `opencode:permission_request` and lands inside the
 * assistant's reply bubble, styled to match the tool-call list it sits under — the
 * prompt is part of the agent's activity, not an alert interrupting it. Every operation
 * means every one: reading a file as much as writing one, shell, grep, fetch. There is
 * no auto-approval, so expect several per turn.
 *
 * Deliberately NOT a modal. A dialog stealing focus on every one of those is how people
 * learn to click Allow without reading, which would defeat the point. The policy is
 * pinned in Rust (`enforce_permission_policy`) and rewritten on every spawn, so it can't
 * be loosened by editing the opencode config on disk.
 *
 * Unanswered prompts resolve themselves — Rust denies on a timeout, and Stop denies
 * immediately — and both emit `opencode:permission_resolved` so the panel clears
 * instead of stranding on screen.
 */

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionRequest {
  request_id: string;
  /** The turn that produced it — the streaming assistant message's own id. */
  generation_id: string;
  /** The chat waiting on it, for the sidebar badge. */
  session_id: string;
  title: string | null;
  /** ACP ToolKind — "read" | "edit" | "execute" | … See `KIND_LABELS`. */
  kind: string | null;
  command: string | null;
  allow_option_id: string | null;
  reject_option_id: string | null;
}

function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// ---------------------------------------------------------------------------
// Shared store
//
// Module-level rather than component state because two places need the same list:
// the bubble, to decide whether it has anything to render at all (a prompt can be the
// FIRST thing in a turn, before any text — an empty bubble returns null and the user
// would sit in front of a silently stalled turn), and the panel itself. One listener
// pair for the whole app, so this can't turn into the per-instance localStorage
// fan-out that froze the model-download UI (see CLAUDE.local.md).
// ---------------------------------------------------------------------------

const EMPTY: PermissionRequest[] = [];
let pending: PermissionRequest[] = EMPTY;
const subscribers = new Set<() => void>();
let listening = false;

function publish(next: PermissionRequest[]) {
  pending = next;
  subscribers.forEach((notify) => notify());
}

function drop(requestId: string) {
  const next = pending.filter((p) => p.request_id !== requestId);
  if (next.length !== pending.length) publish(next.length ? next : EMPTY);
}

async function startListening() {
  if (listening || !isTauriApp()) return;
  listening = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<PermissionRequest>('opencode:permission_request', (evt) => {
    if (pending.some((p) => p.request_id === evt.payload.request_id)) return;
    publish([...pending, evt.payload]);
  });
  await listen<{ request_id: string }>('opencode:permission_resolved', (evt) =>
    drop(evt.payload.request_id),
  );
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  void startListening();
  return () => {
    subscribers.delete(notify);
    // The listeners deliberately outlive the last subscriber: chat components
    // remount constantly, and a request arriving between teardown and re-subscribe
    // would be lost — leaving opencode blocked with nothing on screen.
  };
}

/** Permission requests currently awaiting an answer. Stable reference while unchanged. */
export function useCodePermissionRequests(): PermissionRequest[] {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => EMPTY,
  );
}

/**
 * Chats with something awaiting an answer, for the sidebar badge.
 *
 * Prompts are scoped to the turn that raised them, so a request in a background chat is
 * invisible until you switch to it — and would quietly time out as denied after 180s.
 * This is what tells the user where to look.
 */
export function useCodePermissionSessions(): Set<string> {
  const requests = useCodePermissionRequests();
  // Recomputed per render rather than memoised: `requests` only changes identity when
  // the list actually changes, and the set is a handful of strings.
  return new Set(requests.map((r) => r.session_id).filter(Boolean));
}

/**
 * Test support only. Module state (the pending list AND the once-only listener guard)
 * outlives any single component by design, so without this every test after the first
 * inherits the previous one's requests and never re-registers its event listeners.
 */
export function resetCodePermissionsForTests() {
  pending = EMPTY;
  listening = false;
  subscribers.forEach((notify) => notify());
}

/** ACP ToolKind → the i18n key naming the operation, so the user sees what's at stake. */
const KIND_LABELS: Record<string, string> = {
  read: 'read',
  edit: 'write',
  delete: 'delete',
  move: 'move',
  search: 'search',
  execute: 'exec',
  fetch: 'fetch',
  think: 'think',
};

export function CodePermissionCards({
  generationId,
}: {
  /** Only show prompts raised by this turn. */
  generationId: string;
}) {
  const all = useCodePermissionRequests();
  const requests = all.filter((r) => r.generation_id === generationId);
  const t = useTranslations('chatCodePermissionCard');

  const answer = async (
    request: PermissionRequest,
    optionId: string | null,
  ) => {
    // Drop it first: the answer is one-way and a second click would resolve an id
    // Rust has already forgotten.
    drop(request.request_id);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('opencode_permission_respond', {
        requestId: request.request_id,
        optionId,
      });
    } catch (e) {
      console.error('[code-permission] respond failed', e);
    }
  };

  if (requests.length === 0) return null;

  return (
    // Same visual language as ToolCallIndicator directly above it — gray left rail,
    // xs gray text, 18px sub-indent (12px icon + 6px gap). A white bordered card here
    // shouted next to that quiet list; this reads as a continuation of the agent's
    // activity, which is what it is. Only the buttons carry colour.
    <div className="mb-2 space-y-3 border-l-2 border-gray-200 pt-1 pl-3 text-xs leading-relaxed">
      {requests.map((request) => (
        <div key={request.request_id}>
          <div className="flex flex-wrap items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <ShieldCheck className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="font-medium">{t('title')}</span>
            <span className="rounded bg-gray-200 px-1 py-px font-mono text-[10px] tracking-wide text-gray-500 uppercase">
              {t(`kind.${KIND_LABELS[request.kind ?? ''] ?? 'other'}`)}
            </span>
          </div>
          <div className="mt-0.5 ml-[18px] text-gray-400 dark:text-gray-500">
            {request.title || t('unnamedAction')}
          </div>
          {request.command && (
            // bg-gray-200 is what the bubble already uses for inline code and pre
            // blocks, so the command sits on the same surface as the reply's own.
            <code className="mt-1 ml-[18px] block rounded bg-gray-200 px-1.5 py-1 font-mono break-all text-gray-700">
              {request.command}
            </code>
          )}
          <div className="mt-2 ml-[18px] flex items-center gap-2">
            {/* The app's brand CTA (globals.css) — the ibl.ai blue gradient, same as
                auth-popover and free-trial-dialog. NOT shadcn's `bg-primary`, which
                this app maps to near-black. Kept in colour on purpose: everything
                around it is grey, and this is the one thing needing an answer. */}
            <Button
              size="sm"
              type="button"
              className="ibl-button-primary h-7 text-xs"
              onClick={() => answer(request, request.allow_option_id)}
            >
              {t('allow')}
            </Button>
            {/* Neutral outline, not destructive red: denying is a routine answer
                here, not an error. */}
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-7 text-xs"
              onClick={() => answer(request, request.reject_option_id)}
            >
              {t('deny')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
