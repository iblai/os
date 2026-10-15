'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Hand, Zap, type LucideIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type PermissionMode = 'manual' | 'auto';

export const PERMISSION_MODES: readonly PermissionMode[] = ['manual', 'auto'];

export const PERMISSION_MODE_ICONS: Record<PermissionMode, LucideIcon> = {
  manual: Hand,
  auto: Zap,
};

// One mode for every chat, saved by the desktop and shared by every Code
// control on screen, so two composers (the canvas split) never disagree and a
// composer mounting mid-chat shows the mode in force. `picks` counts the
// user's choices, so a read that started before one never overwrites it.
let approvalMode: PermissionMode = 'auto';
let picks = 0;
const subscribers = new Set<() => void>();

function publish(mode: PermissionMode) {
  approvalMode = mode;
  subscribers.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function useApprovalMode(): PermissionMode {
  return useSyncExternalStore(
    subscribe,
    () => approvalMode,
    () => 'auto',
  );
}

export function setApprovalMode(mode: PermissionMode) {
  picks += 1;
  publish(mode);
}

/**
 * Show a chosen mode at once, so every control agrees, and save it on the
 * desktop. A save that fails puts back the mode the desktop still enforces
 * and reports it: left as chosen, Code would keep approving on its own
 * behind an "Ask Me" label. A newer pick that landed meanwhile is kept.
 */
export async function applyApprovalMode(
  mode: PermissionMode,
  save: (mode: PermissionMode) => Promise<unknown>,
  onFailure: (error: unknown) => void,
): Promise<boolean> {
  const previous = approvalMode;
  setApprovalMode(mode);
  try {
    await save(mode);
    return true;
  } catch (error) {
    if (approvalMode === mode) setApprovalMode(previous);
    onFailure(error);
    return false;
  }
}

/**
 * Show the mode the desktop has saved. Anything but `"auto"` is Ask Me: an
 * older desktop answers null when nothing was chosen, and one older still has
 * no such command — both ask at every step.
 */
export async function loadApprovalMode(
  read: () => Promise<string | null | undefined>,
) {
  const before = picks;
  const saved = await read().catch(() => null);
  if (picks === before) publish(saved === 'auto' ? 'auto' : 'manual');
}

/** Test support only: the mode outlives every component by design. */
export function resetApprovalModeForTests() {
  picks = 0;
  publish('auto');
}

/**
 * Code's approval mode beside the microphone, like Claude Code's mode
 * indicator by its send button: an icon that widens to the mode's name and
 * opens the choice. It is pinned inside an icon-wide box and grows over the
 * tool row rather than into it — pushing the row would make it re-fit its
 * pills on every hover. The short delay keeps a pointer just passing over the
 * icon on its way to a pill from widening it into that pill's way.
 */
export function CodeApprovalsButton({
  mode,
  onChange,
}: {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
}) {
  const t = useTranslations('chatInputFormCodingModeButton');
  const [open, setOpen] = useState(false);
  const Icon = PERMISSION_MODE_ICONS[mode];
  const name = (m: PermissionMode) =>
    m === 'auto' ? t('permissionModeAuto') : t('permissionModeManual');
  const hint = (m: PermissionMode) =>
    m === 'auto' ? t('permissionModeAutoHint') : t('permissionModeManualHint');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="relative flex h-8 w-8 shrink-0">
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="code-approvals-button"
            aria-label={t('approvalsAria', { mode: name(mode) })}
            className="group absolute top-0 right-0 z-10 flex h-8 cursor-pointer items-center rounded-lg border border-transparent px-[7px] text-sm font-medium text-[#38A1E5] transition-colors duration-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF] hover:delay-150 focus-visible:border-[#D0E0FF] focus-visible:bg-[#F5F8FF] focus-visible:outline-none data-[state=open]:border-[#D0E0FF] data-[state=open]:bg-[#F5F8FF]"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-28 group-hover:opacity-100 group-hover:delay-150 group-focus-visible:ml-1.5 group-focus-visible:max-w-28 group-focus-visible:opacity-100 group-data-[state=open]:ml-1.5 group-data-[state=open]:max-w-28 group-data-[state=open]:opacity-100">
              {name(mode)}
            </span>
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        side="top"
        align="end"
        collisionPadding={8}
        className="w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl"
      >
        <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-gray-500">
          {t('permissionModeLabel')}
        </div>
        <div
          role="radiogroup"
          aria-label={t('permissionModeLabel')}
          className="flex flex-col gap-0.5"
        >
          {PERMISSION_MODES.map((m) => {
            const ModeIcon = PERMISSION_MODE_ICONS[m];
            const selected = m === mode;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                data-testid={`code-approvals-option-${m}`}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                  selected ? 'bg-[#F5F8FF]' : 'hover:bg-gray-50'
                }`}
              >
                <ModeIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    selected ? 'text-[#38A1E5]' : 'text-gray-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`text-sm font-medium ${
                      selected ? 'text-[#38A1E5]' : 'text-gray-900'
                    }`}
                  >
                    {name(m)}
                  </span>
                  <span className="text-xs text-gray-500">{hint(m)}</span>
                </span>
                {selected && (
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#38A1E5]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
