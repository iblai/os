'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, BookOpen, Archive, Check, Terminal } from 'lucide-react';
import { DeepSearchIcon, CanvasIcon } from '@/components/icons/svg-icons';
import { TOOLS } from '@iblai/iblai-js/web-utils';
import { MemoryButton } from './memory-button';

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
      // Memory actions are disabled for now.
      action: /* istanbul ignore next */ () => onOptionClick(TOOLS.MEMORY),
      isEnabled: false,
    },
  ].filter((item) => item.isEnabled);

  // Get visible inside buttons based on screen size
  // Active buttons are always visible, inactive ones are hidden based on available width
  const getVisibleInsideButtons = () => {
    const activeButtons = allInsideButtons.filter((btn) => btn.isActive);
    const inactiveButtons = allInsideButtons.filter((btn) => !btn.isActive);
    const minButtonWidth = 120;

    if (allInsideButtons.length === 1 && containerWidth > minButtonWidth) {
      return { visible: allInsideButtons, hidden: [] };
    }

    if (containerWidth < 600) {
      // Mobile: show only active buttons, hide all inactive ones
      return {
        visible: activeButtons,
        hidden: inactiveButtons,
      };
    } else if (containerWidth < 800) {
      // Tablet: show active buttons + first inactive one if space allows
      const visibleInactive = activeButtons.length === 0 ? inactiveButtons.slice(0, 1) : [];
      return {
        visible: [...activeButtons, ...visibleInactive],
        hidden: inactiveButtons.filter((btn) => !visibleInactive.includes(btn)),
      };
    } else {
      // Desktop: show all buttons
      return { visible: allInsideButtons, hidden: [] };
    }
  };

  const { visible: visibleInsideButtons, hidden: hiddenInsideButtons } = getVisibleInsideButtons();

  return (
    <div className="flex items-center gap-1.5 relative">
      {/* Responsive Inside Buttons */}
      {visibleInsideButtons.map((button) => {
        // Memory buttons are disabled for now.
        /* istanbul ignore next */ if (button.name === 'Memory') {
          return <MemoryButton key={button.name} />;
        }

        return (
          <div key={button.name} className="relative">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={disabled}
              className={`h-8 px-2 text-sm rounded-lg flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                button.isActive
                  ? 'text-[#38A1E5] bg-[#F5F8FF] border border-[#D0E0FF]'
                  : 'text-gray-600 hover:bg-[#F5F8FF] hover:border hover:border-[#D0E0FF]'
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                button.action();
              }}
            >
              <span className={button.isActive ? 'text-[#38A1E5]' : 'text-gray-600'}>
                {button.icon}
              </span>
              {button.name}
              {button.isActive && (
                <X
                  className="h-3 w-3 ml-1 cursor-pointer"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={disabled}
              className="h-8 w-8 text-gray-600 hover:bg-[#F5F8FF] hover:border hover:border-[#D0E0FF] rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-xs">•••</span>
              <span className="sr-only">More options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {/* Hidden buttons are always inactive based on current logic, so isActive branches are defensive */}
            {hiddenInsideButtons.map((button) => (
              <DropdownMenuItem
                key={button.name}
                onClick={button.action}
                className={
                  /* istanbul ignore next */ button.isActive ? 'bg-[#F5F8FF] text-[#38A1E5]' : ''
                }
              >
                <div className="flex items-center gap-2 w-full">
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
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
