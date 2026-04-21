'use client';

import React, { useState, useEffect } from 'react';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLazyGetConnectedServiceAuthUrlQuery } from '@iblai/iblai-js/data-layer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Code, X, Presentation, FileText } from 'lucide-react';
import {
  ImageIcon,
  PowerPointIcon,
  QuizIcon,
  RubricIcon,
  ResourceIcon,
  LessonPlanIcon,
  SyllabusIcon,
  MoreIcon,
} from '@/components/icons/svg-icons';
import { TOOLS } from '@iblai/iblai-js/web-utils';

interface OutsideButtonsProps {
  activeOptions: string[];
  onOptionClick: (optionName: string) => Promise<void>;
  setSessionTools: (tools: string[]) => Promise<void>;
  onCrossClick: (optionName: string) => Promise<void>;
  containerWidth: number;
  enableWebBrowsing: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
  googleSlidesIsEnabled: boolean;
  googleDocumentIsEnabled: boolean;
  tenantKey: string;
  userId: string;
  disabled?: boolean;
}

type GoogleService = typeof TOOLS.GOOGLE_SLIDES | typeof TOOLS.GOOGLE_DOCUMENT;

export const OutsideButtons = ({
  /* istanbul ignore next -- @preserve defensive default */ activeOptions = [],
  onOptionClick,
  setSessionTools,
  onCrossClick,
  containerWidth,
  enableWebBrowsing,
  imageGeneration,
  codeInterpreter,
  googleSlidesIsEnabled,
  googleDocumentIsEnabled,
  tenantKey,
  userId,
  disabled = false,
}: OutsideButtonsProps) => {
  const [getConnectedServiceAuthUrl] = useLazyGetConnectedServiceAuthUrlQuery();
  const [pendingAuth, setPendingAuth] = useState<GoogleService | null>(null);
  const [savedTools, setSavedTools] = useState<string[]>([]);

  // Listen for auth success messages from OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_AUTH_SUCCESS' && pendingAuth) {
        // Authentication succeeded, restore saved tools + add new tool
        const toolsToSet = savedTools.includes(pendingAuth)
          ? /* istanbul ignore next -- @preserve defensive: tool cannot be in savedTools and pending simultaneously */ savedTools
          : [...savedTools, pendingAuth];

        setSessionTools(toolsToSet).catch((error) => {
          console.error('Failed to activate Google option:', error);
        });

        setPendingAuth(null);
        setSavedTools([]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pendingAuth, savedTools, setSessionTools]);

  // Handler for Google OAuth authentication
  const handleGoogleOptionClick = async (service: GoogleService) => {
    const isActive = activeOptions.includes(service);

    if (isActive) {
      // If already active, deactivate it
      try {
        await onOptionClick(service);
      } catch (error) {
        console.error('Failed to click Google option:', error);
      }
      return;
    }

    // Open the popup window immediately on user click to avoid popup blockers
    // The window must be opened synchronously in the click handler
    const popup = window.open('about:blank', '_blank', 'width=600,height=600');

    if (!popup || popup.closed) {
      toast.error(
        'Please allow popups for this site to connect Google services',
      );
      return;
    }

    // Start OAuth flow
    const serviceName =
      service.split('-')?.[1] ??
      /* istanbul ignore next -- @preserve all services have dash */ service;

    try {
      // Save current tools before OAuth (to restore after if session resets)
      setSavedTools(activeOptions);
      setPendingAuth(service); // Track which service is being authenticated

      const response = await getConnectedServiceAuthUrl({
        org: tenantKey,
        provider: 'google',
        service: serviceName,
        userId,
      }).unwrap();

      // Navigate the already-opened popup to the auth URL
      if (response.auth_url) {
        const url = new URL(response.auth_url);
        const currentRedirectUri = `${window.location.origin}/google-oauth-callback/`;
        url.searchParams.set('redirect_uri', currentRedirectUri);
        url.searchParams.set('tool_name', service); // Pass service name to callback

        popup.location.href = url.toString();

        // Handle case where user closes popup without completing auth
        /* istanbul ignore next -- @preserve hard to test interval-based popup close detection */
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setPendingAuth(null);
          }
        }, 1000);
      } else {
        // No auth URL returned, close the popup
        popup.close();
        toast.error('Failed to get authentication URL');
        setPendingAuth(null);
      }
    } catch (error) {
      // Close the popup on error
      popup.close();
      console.error('Failed to initiate Google authentication:', error);
      toast.error('Failed to initiate Google authentication');
      setPendingAuth(null);
    }
  };

  const allButtons = [
    {
      name: 'Web Search',
      slug: TOOLS.WEB_SEARCH,
      icon: <Globe className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.WEB_SEARCH),
      action: () => onOptionClick(TOOLS.WEB_SEARCH),
      isEnabled: enableWebBrowsing,
    },
    {
      name: 'Code',
      slug: TOOLS.CODE_INTERPRETER,
      icon: <Code className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.CODE_INTERPRETER),
      action: () => onOptionClick(TOOLS.CODE_INTERPRETER),
      isEnabled: codeInterpreter,
    },
    {
      name: 'Image',
      slug: TOOLS.IMAGE_GENERATION,
      icon: <ImageIcon className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.IMAGE_GENERATION),
      action: () => onOptionClick(TOOLS.IMAGE_GENERATION),
      isEnabled: imageGeneration,
    },
    {
      name: 'Google Slides',
      slug: TOOLS.GOOGLE_SLIDES,
      icon: <Presentation className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.GOOGLE_SLIDES),
      action: () => handleGoogleOptionClick(TOOLS.GOOGLE_SLIDES),
      isEnabled: googleSlidesIsEnabled,
    },
    {
      name: 'Google Docs',
      slug: TOOLS.GOOGLE_DOCUMENT,
      icon: <FileText className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.GOOGLE_DOCUMENT),
      action: () => handleGoogleOptionClick(TOOLS.GOOGLE_DOCUMENT),
      isEnabled: googleDocumentIsEnabled,
    },
    {
      name: 'PowerPoint',
      slug: TOOLS.POWERPOINT,
      icon: <PowerPointIcon className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.POWERPOINT),
      action: /* istanbul ignore next -- @preserve disabled feature */ () =>
        onOptionClick(TOOLS.POWERPOINT),
      isEnabled: false,
    },
  ].filter((button) => button.isEnabled);

  /* istanbul ignore next -- @preserve disabled feature: moreMenuItems are all disabled */
  const moreMenuItems = [
    {
      name: 'Quiz',
      slug: TOOLS.QUIZ,
      icon: <QuizIcon className="h-4 w-4" />,
      description: 'Create a quiz or assessment',
      action: /* istanbul ignore next -- @preserve */ () =>
        onOptionClick(TOOLS.QUIZ),
      isEnabled: false,
    },
    {
      name: 'Rubric',
      slug: TOOLS.RUBRIC,
      icon: <RubricIcon className="h-4 w-4" />,
      description: 'Generate a grading rubric',
      action: /* istanbul ignore next -- @preserve */ () =>
        onOptionClick(TOOLS.RUBRIC),
      isEnabled: false,
    },
    {
      name: 'Resource',
      slug: TOOLS.RESOURCE,
      icon: <ResourceIcon className="h-4 w-4" />,
      description: 'Find or create resources',
      action: /* istanbul ignore next -- @preserve */ () =>
        onOptionClick(TOOLS.RESOURCE),
      isEnabled: false,
    },
    {
      name: 'Lesson Plan',
      slug: TOOLS.LESSON_PLAN,
      icon: <LessonPlanIcon className="h-4 w-4" />,
      description: 'Create a lesson plan',
      action: /* istanbul ignore next -- @preserve */ () =>
        onOptionClick(TOOLS.LESSON_PLAN),
      isEnabled: false,
    },
    {
      name: 'Syllabus',
      slug: TOOLS.SYLLABUS,
      icon: <SyllabusIcon className="h-4 w-4" />,
      description: 'Generate a course syllabus',
      action: /* istanbul ignore next -- @preserve */ () =>
        onOptionClick(TOOLS.SYLLABUS),
      isEnabled: false,
    },
  ].filter((item) => item.isEnabled);

  // Responsive outside buttons - move items to More dropdown based on available width
  const getVisibleButtons = () => {
    const minButtonWidth = 160;
    const moreButtonWidth = minButtonWidth;
    const hasStaticMoreMenu = moreMenuItems.length > 0;

    const maxButtonsNoMore = Math.max(
      1,
      Math.floor(containerWidth / minButtonWidth),
    );
    const shouldReserveMore =
      hasStaticMoreMenu || allButtons.length > maxButtonsNoMore;
    const availableWidth = shouldReserveMore
      ? Math.max(0, containerWidth - moreButtonWidth)
      : containerWidth;
    const maxVisible = Math.max(1, Math.floor(availableWidth / minButtonWidth));
    const visibleCount = Math.min(allButtons.length, maxVisible);

    return {
      visible: allButtons.slice(0, visibleCount),
      hidden: allButtons.slice(visibleCount),
    };
  };

  const { visible: visibleButtons, hidden: hiddenButtons } =
    getVisibleButtons();

  // Get the currently selected more option for display
  const getSelectedMoreOption = () => {
    return (
      /* istanbul ignore next -- @preserve moreMenuItems is always empty */ moreMenuItems.find(
        (item) => item.slug && activeOptions.includes(item.slug),
      ) ||
      hiddenButtons.find(
        (item) => item.slug && activeOptions.includes(item.slug),
      )
    );
  };

  const selectedMoreOption = getSelectedMoreOption();

  // Don't render anything if there are no buttons to show
  if (
    visibleButtons.length === 0 &&
    hiddenButtons.length === 0 &&
    moreMenuItems.length === 0
  ) {
    return null;
  }

  return (
    <div className="bg-card flex w-full max-w-[calc(100%-1rem)] items-center justify-center gap-4 rounded-b-xl border border-t-0 border-gray-200 py-3 text-sm text-gray-600">
      {visibleButtons.map((button, index) => (
        <React.Fragment key={button.name}>
          {index > 0 && <span className="font-medium text-gray-500">|</span>}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={disabled || pendingAuth !== null}
            className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              button.isActive
                ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]' // Active state
                : pendingAuth === button.slug
                  ? 'cursor-wait border border-gray-200 opacity-60' // Pending state
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]' // Default and hover state
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              button.action();
            }}
          >
            <span
              className={`${button.isActive ? 'text-[#38A1E5]' : 'text-gray-600'}`}
            >
              {button.icon}
            </span>
            {button.name}
            {pendingAuth === button.slug && (
              <span className="text-xs text-gray-500">(connecting...)</span>
            )}
            {button.isActive && (
              <X
                className="ml-1 h-3 w-3 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  /* istanbul ignore next -- @preserve all buttons have slug */
                  if (button.slug) {
                    onCrossClick(button.slug);
                  }
                }}
              />
            )}
          </Button>
        </React.Fragment>
      ))}

      {/* More Dropdown */}
      {(hiddenButtons.length > 0 || moreMenuItems.length > 0) && (
        <>
          {visibleButtons.length > 0 && (
            <span className="font-medium text-gray-500">|</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={disabled}
                className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedMoreOption
                    ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]' // Active state
                    : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]' // Default and hover state
                }`}
              >
                {selectedMoreOption ? (
                  <>
                    <span
                      className={
                        /* istanbul ignore next -- @preserve always truthy here */ `${selectedMoreOption ? 'text-[#38A1E5]' : 'text-gray-600'}`
                      }
                    >
                      {selectedMoreOption.icon}
                    </span>
                    {selectedMoreOption.name}
                    <MoreIcon className="ml-1 h-3 w-3 cursor-pointer text-[#38A1E5]" />
                  </>
                ) : (
                  <>
                    <MoreIcon className="text-gray-600" />
                    More
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {/* Hidden responsive buttons */}
              {hiddenButtons.map((button) => (
                <DropdownMenuItem key={button.name} onClick={button.action}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`${selectedMoreOption && selectedMoreOption.name === button.name ? 'text-[#38A1E5]' : 'text-gray-600'}`}
                    >
                      {button.icon}
                    </span>
                    <span
                      className={`${selectedMoreOption && selectedMoreOption.name === button.name ? 'text-[#38A1E5]' : 'text-gray-600'}`}
                    >
                      {button.name}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
              {/* More menu items - istanbul ignore: moreMenuItems is always empty */}
              {moreMenuItems.map(
                /* istanbul ignore next -- @preserve */ (item) => (
                  <DropdownMenuItem key={item.name} onClick={item.action}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`${selectedMoreOption && selectedMoreOption.name === item.name ? 'text-[#38A1E5]' : 'text-gray-600'}`}
                      >
                        {item.icon}
                      </span>
                      <span
                        className={`${selectedMoreOption && selectedMoreOption.name === item.name ? 'text-[#38A1E5]' : 'text-gray-600'}`}
                      >
                        {item.name}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
};
