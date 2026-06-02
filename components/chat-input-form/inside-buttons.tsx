'use client';

import type React from 'react';
import { useState } from 'react';
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
import { X, BookOpen, Archive, Check, Terminal } from 'lucide-react';
import { DeepSearchIcon, CanvasIcon } from '@/components/icons/svg-icons';
import { TOOLS } from '@iblai/iblai-js/web-utils';
import { MemoryButton } from './memory-button';
import { MemoryMenu } from './memory-menu';

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
  tenantKey,
  username,
}: InsideButtonsProps) => {
  const allInsideButtons = [
    {
      name: 'Canvas',
      icon: <CanvasIcon className="h-4 w-4" />,
      isActive: artifactsEnabled,
      action: () => onOptionClick(TOOLS.CANVAS),
      isEnabled: true,
    },
    {
      name: 'Prompts',
      icon: <Terminal className="h-4 w-4" />,
      isActive: false,
      action: () => onOpenPromptGallery?.(),
      isEnabled: !embedMode && promptsIsEnabled,
    },
    {
      name: 'Study Mode',
      icon: <BookOpen className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.STUDY_MODE),
      action: () => onOptionClick(TOOLS.STUDY_MODE),
      isEnabled: studyMode,
    },
    {
      name: 'Deep Research',
      icon: <DeepSearchIcon className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.DEEP_RESEARCH),
      action: () => onOptionClick(TOOLS.DEEP_RESEARCH),
      isEnabled: deepResearch,
    },
    {
      name: 'Memory',
      icon: <Archive className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.MEMORY),
      action: () => onOptionClick(TOOLS.MEMORY),
      isEnabled: memoryEnabled && !embedMode && !!username,
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
              {button.name}
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
                  <span className="sr-only">More options</span>
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
                        <span className="flex-1">{button.name}</span>
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
            onFocusOutside={(e) => e.preventDefault()}
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
