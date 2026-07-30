'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { X, BookOpen, Archive, Check, Terminal, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { DeepSearchIcon, CanvasIcon } from '@/components/icons/svg-icons';
import { TOOLS, hasRemoteAiConfig } from '@iblai/iblai-js/web-utils';
import {
  useGhostOs,
  isSystemControlEnabled,
  setSystemControlEnabled,
  isLocalLLMEnabled,
  getLocalLLMModel,
  modelSupportsSystemControl,
} from '@iblai/iblai-js/web-containers';
import { MemoryButton } from './memory-button';
import { CodingModeButton } from './coding-mode-button';
import { MemoryMenu } from './memory-menu';
import { isTauriApp } from '@/types/tauri';

// Computer Use is macOS-only in prod; the env flag bypasses the OS check so the
// toggle can be exercised on Linux/Windows desktop builds during testing.
const isMacOS = () => {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.userAgent || '');
};
const allowNonMacOSComputerUse = () =>
  process.env.NEXT_PUBLIC_ALLOW_NON_MACOS_COMPUTER_USE_TOGGLE === 'true';

// 12GB floor, matching the SDK default (DEFAULT_SYSTEM_CONTROL_REQUIRED_SIZE_GB)
// and the Local Models tab's "supported" indicator. modelSupportsSystemControl
// gates size <= gb (strictly greater), so a model of exactly 12GB is also off.
const COMPUTER_USE_MIN_MODEL_GB = 12;

interface InsideButtonsProps {
  activeOptions: string[];
  onOptionClick: (optionName: string) => Promise<void>;
  deepResearch: boolean;
  artifactsEnabled: boolean;
  studyMode: boolean;
  containerWidth: number;
  disabled?: boolean;
  onOpenPromptGallery?: () => void;
  embedMode?: boolean;
  promptsIsEnabled?: boolean;
  memoryEnabled?: boolean;
  /**
   * When chat private mode is active (effective mode === 'disabled'), the
   * Memory button is hidden — memory is not stored for a private session, so
   * offering it would be misleading. See chat-input-form.tsx for where this
   * is derived from `useChatPrivacy`.
   */
  isPrivate?: boolean;
  tenantKey?: string;
  username?: string;
}

export const InsideButtons = ({
  activeOptions,
  onOptionClick,
  deepResearch,
  studyMode,
  artifactsEnabled,
  containerWidth,
  disabled = false,
  onOpenPromptGallery,
  embedMode = false,
  promptsIsEnabled = false,
  memoryEnabled = false,
  isPrivate = false,
  tenantKey,
  username,
}: InsideButtonsProps) => {
  const t = useTranslations('chatInputFormInsideButtons');

  // Computer Use = the Tauri GhostOS assistant. Same calls as the old profile
  // "Computer Assistant" toggle (useGhostOs install/stop + localStorage pref),
  // no backend round-trip. Reads the pref on mount; cross-tab sync not polled.
  const ghostOs = useGhostOs();
  const [computerUseEnabled, setComputerUseEnabled] = useState(isSystemControlEnabled);
  const toggleComputerUse = () => {
    const next = !computerUseEnabled;
    // Guard only when turning on. Computer Use runs on EITHER a large local model
    // or the remote AI (DM OpenAI-compatible endpoint) — allow enabling when
    // either backend is ready, so a local model is not required. The chatbox has
    // no inline notice space, so remind via toast instead of failing silently.
    if (next) {
      const localReady =
        isLocalLLMEnabled() &&
        modelSupportsSystemControl(getLocalLLMModel(), COMPUTER_USE_MIN_MODEL_GB);
      if (!localReady && !hasRemoteAiConfig()) {
        toast.warning(
          isLocalLLMEnabled()
            ? t('computerUseModelTooSmall')
            : t('computerUseNeedsLocalModel'),
        );
        return;
      }
    }
    setComputerUseEnabled(next);
    setSystemControlEnabled(next);
    if (next) ghostOs.install();
    else ghostOs.stop();
  };

  // Code (opencode over ACP) is desktop-only. Detected AFTER mount, never during
  // render: Tauri injects its globals into the remote origin some time after load, so a
  // render-time read can latch false forever (and would mismatch prerendered HTML
  // during hydration). Keeping the gate here also means <CodingModeButton> — which
  // needs Redux + the mentor route — never mounts in a plain browser.
  const [inTauri, setInTauri] = useState(false);
  useEffect(() => {
    if (isTauriApp()) return setInTauri(true);
    let tries = 0;
    const t = setInterval(() => {
      if (isTauriApp()) {
        setInTauri(true);
        clearInterval(t);
      } else if (++tries > 10) {
        clearInterval(t);
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  const allInsideButtons = [
    {
      name: 'Computer Use',
      label: t('computerUse'),
      icon: <Monitor className="h-4 w-4" />,
      isActive: computerUseEnabled,
      action: toggleComputerUse,
      isEnabled: ghostOs.isAvailable && (isMacOS() || allowNonMacOSComputerUse()),
    },
    {
      name: 'Canvas',
      label: t('canvas'),
      icon: <CanvasIcon className="h-4 w-4" />,
      isActive: artifactsEnabled,
      action: () => onOptionClick(TOOLS.CANVAS),
      isEnabled: true,
    },
    {
      name: 'Prompts',
      label: t('prompts'),
      icon: <Terminal className="h-4 w-4" />,
      isActive: false,
      action: () => onOpenPromptGallery?.(),
      isEnabled: !embedMode && promptsIsEnabled,
    },
    {
      name: 'Study Mode',
      label: t('studyMode'),
      icon: <BookOpen className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.STUDY_MODE),
      action: () => onOptionClick(TOOLS.STUDY_MODE),
      isEnabled: studyMode,
    },
    {
      name: 'Deep Research',
      label: t('deepResearch'),
      icon: <DeepSearchIcon className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.DEEP_RESEARCH),
      action: () => onOptionClick(TOOLS.DEEP_RESEARCH),
      isEnabled: deepResearch,
    },
    {
      name: 'Memory',
      label: t('memory'),
      icon: <Archive className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.MEMORY),
      // Memory uses <MemoryButton> in visible mode and a popover handler in
      // the hidden dropdown, so this `action` lambda is unreachable.
      action: /* istanbul ignore next */ () => onOptionClick(TOOLS.MEMORY),
      // Hidden in private mode — memory is not stored for a private session.
      isEnabled: memoryEnabled && !embedMode && !!username && !isPrivate,
    },
  ].filter((item) => item.isEnabled);

  // Get visible inside buttons based on screen size.
  // Below the desktop breakpoint (800px) we collapse ALL tool buttons —
  // including active ones — into the overflow dropdown. Active pills render
  // as `icon + label + ✕`, so even two of them blow the inline row's width
  // and push the outside buttons / send control out of alignment on
  // small/tablet viewports. See issue #1533.
  const getVisibleInsideButtons = () => {
    const minButtonWidth = 120;

    if (allInsideButtons.length === 1 && containerWidth > minButtonWidth) {
      return { visible: allInsideButtons, hidden: [] };
    }

    if (containerWidth < 800) {
      // Mobile + tablet: nothing inline, everything in the dropdown.
      return { visible: [], hidden: allInsideButtons };
    }

    // Desktop: show all buttons inline.
    return { visible: allInsideButtons, hidden: [] };
  };

  const { visible: visibleInsideButtons, hidden: hiddenInsideButtons } =
    getVisibleInsideButtons();

  const [hiddenMemoryPopoverOpen, setHiddenMemoryPopoverOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Coding Mode (desktop-only) — always inline; owns its own folder popover. */}
      {inTauri && <CodingModeButton />}
      {/* Responsive Inside Buttons */}
      {visibleInsideButtons.map((button) => {
        if (button.name === 'Memory') {
          return (
            <MemoryButton
              key={button.name}
              tenantKey={tenantKey}
              username={username}
            />
          );
        }

        return (
          <div key={button.name} className="relative">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={disabled}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                button.isActive
                  ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
                  : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                button.action();
              }}
            >
              <span
                className={button.isActive ? 'text-[#38A1E5]' : 'text-gray-600'}
              >
                {button.icon}
              </span>
              {button.label}
              {button.isActive && (
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                />
              )}
            </Button>
          </div>
        );
      })}

      {/* Hidden inside buttons dropdown if needed */}
      {hiddenInsideButtons.length > 0 && (
        <Popover
          open={hiddenMemoryPopoverOpen}
          onOpenChange={setHiddenMemoryPopoverOpen}
        >
          <PopoverAnchor>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg text-gray-600 transition-all duration-200 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-xs">•••</span>
                  <span className="sr-only">{t('moreOptions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {/* Hidden buttons are always inactive based on current logic, so isActive branches are defensive */}
                {hiddenInsideButtons.map((button) => {
                  const isMemory = button.name === 'Memory';
                  return (
                    <DropdownMenuItem
                      key={button.name}
                      onClick={
                        isMemory
                          ? (e) => {
                              e.preventDefault();
                              setHiddenMemoryPopoverOpen(true);
                            }
                          : button.action
                      }
                      className={
                        /* istanbul ignore next */ button.isActive
                          ? 'bg-[#F5F8FF] text-[#38A1E5]'
                          : ''
                      }
                    >
                      <div className="flex w-full items-center gap-2">
                        <span
                          className={
                            /* istanbul ignore next */ button.isActive
                              ? 'text-[#38A1E5]'
                              : 'text-gray-600'
                          }
                        >
                          {button.icon}
                        </span>
                        <span className="flex-1">{button.label}</span>
                        {
                          /* istanbul ignore next */ button.isActive && (
                            <Check className="h-4 w-4 text-[#38A1E5]" />
                          )
                        }
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-96 rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
            // Radix wires this onto a global focus-outside listener that
            // jsdom cannot reliably trigger from a unit test.
            onFocusOutside={
              /* istanbul ignore next */ (e) => e.preventDefault()
            }
          >
            <MemoryMenu
              onClose={() => setHiddenMemoryPopoverOpen(false)}
              tenantKey={tenantKey}
              username={username}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
