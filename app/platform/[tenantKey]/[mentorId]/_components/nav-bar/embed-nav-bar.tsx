import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useTranslations } from 'next-intl';

import {
  BadgeHelp,
  CircleHelp,
  Glasses,
  Maximize2,
  Menu,
  Minimize2,
  ShieldQuestion,
  SquarePen,
  X,
} from 'lucide-react';

import {
  ChatPrivacyToggle,
  useChatPrivacy,
} from '@iblai/iblai-js/web-containers';

import { Button } from '@/components/ui/button';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { useIsIframed } from '@/hooks/use-is-iframed';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useShowCloseButton } from '@/hooks/use-show-close-button';
import { useAllowFullscreen } from '@/hooks/use-allow-fullscreen';
import { useIsLtiLaunch } from '@/hooks/use-is-lti-launch';
import { useShowUserProfile } from '@/hooks/use-show-user-profile';
import { useHelpCenter } from '@/hooks/use-help-center';
import { UserProfile } from './user-profile';
import { useUsername } from '@/hooks/use-user';
import { cn, isLoggedIn } from '@/lib/utils';
import { chatActions, clearFiles } from '@iblai/iblai-js/web-utils';
import { useAppDispatch } from '@/lib/hooks';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { CSS_CLASS_NAMES } from '@/lib/constants';

type Props = {
  mentorName: string;
  profileImage: string;
  isMobile: boolean;
  isAnonymousMentor: boolean;
  toggleSidebar: () => void;
  openSidebar: boolean;
  tenantKey: string;
  mentorId: string;
};

export function EmbedNavBar({
  mentorName,
  profileImage,
  isMobile,
  isAnonymousMentor,
  toggleSidebar,
  openSidebar,
  tenantKey,
  mentorId,
}: Props) {
  const t = useTranslations('navBarEmbedNavBar');
  const username = useUsername();
  const isPreviewMode = useIsPreviewMode();
  const isIframed = useIsIframed();
  // An LMS course frame (LTI) has no launcher to reopen the chat: no close.
  const isLtiLaunch = useIsLtiLaunch();
  const showCloseButton = useShowCloseButton() && !isLtiLaunch;
  const showUserProfile = useShowUserProfile();
  const allowFullscreen = useAllowFullscreen();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const isWorkflowsPage = /\/workflows\/[^/]+\/?$/.test(pathname ?? '');
  const isOnChatPage =
    !pathname?.includes('/prompt-gallery') &&
    !pathname?.includes('/analytics') &&
    !pathname?.includes('/explore') &&
    !isWorkflowsPage;

  const { helpCenterUrl, supportEmail, showHelp } = useHelpCenter(tenantKey);

  const visibleToLoggedInUsersOnly = !isAnonymousMentor || isLoggedIn();

  const { featureEnabled, privacyModeDisabled, effective, messageCount } =
    useChatPrivacy({
      org: tenantKey,
      userId: username ?? '',
      mentor: mentorId,
    });
  const isPrivate = effective.mode === 'disabled';
  const hasMessages = messageCount > 0;

  function notifyParentOnEmbedClose() {
    // The host restores normal size when the widget closes, so it reopens small.
    setIsFullscreen(false);
    window.parent?.postMessage(
      {
        closeEmbed: true,
        collapseSidebarCopilot: true,
      },
      '*',
    );
  }

  function toggleFullscreen() {
    const next = !isFullscreen;
    setIsFullscreen(next);
    window.parent?.postMessage({ embedFullscreen: next }, '*');
  }

  useEffect(() => {
    if (isPreviewMode || !showCloseButton) return;

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Let nested overlays (dropdowns, dialogs, popovers, tooltips) handle ESC first.
      if (event.defaultPrevented) return;
      if (document.querySelector('[data-state="open"]')) return;
      notifyParentOnEmbedClose();
    }
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isPreviewMode, showCloseButton]);

  function startNewChat() {
    dispatch(clearFiles(undefined));
    eventBus.emit(RemoteEvents.newChat);
    dispatch(chatActions.setShouldStartNewChat(true));
  }

  const iconButtonClass =
    'h-10 w-10 rounded-[10px] text-gray-600 [&_svg]:h-5 [&_svg]:w-5';

  const helpItems = [
    ...(showHelp
      ? [
          {
            labelKey: 'help' as const,
            icon: BadgeHelp,
            onClick: () => {
              window.open(helpCenterUrl, '_blank');
            },
          },
        ]
      : []),
    {
      labelKey: 'support' as const,
      icon: ShieldQuestion,
      onClick: () => {
        window.open(`mailto:${supportEmail}`, '_blank');
      },
    },
  ];

  const showIncognito =
    isOnChatPage &&
    isLoggedIn() &&
    !!tenantKey &&
    ((featureEnabled && !privacyModeDisabled) || isPrivate);

  // The SDK toggle owns the Incognito rules and its confirm dialog; the menu
  // row drives it, so the row stays one keyboard-reachable menu item.
  const incognitoToggleRef = useRef<HTMLDivElement>(null);

  // The toggle's confirm dialog opens over the menu. Closing the menu would
  // unmount the toggle and its dialog with it.
  function keepMenuOpenForConfirm(event: Event) {
    if (document.querySelector('[data-testid="chat-privacy-confirm-dialog"]')) {
      event.preventDefault();
    }
  }

  return (
    <nav
      data-elevated={hasMessages ? 'true' : 'false'}
      className={cn(
        'flex h-14 w-full shrink-0 items-center border-b bg-white pr-1.5 pl-3.5 transition-[border-color,box-shadow] duration-200',
        hasMessages
          ? 'border-[#f0f1f3] shadow-[0_1px_3px_rgba(16,24,40,0.05)]'
          : 'border-transparent',
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-1">
        {isMobile && visibleToLoggedInUsersOnly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={toggleSidebar}
                aria-label={openSidebar ? t('closeSidebar') : t('openSidebar')}
                data-testid="(Close|Open) sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="ibl-tooltip-content" side="right">
              {t('toggleSidebar')}
            </TooltipContent>
          </Tooltip>
        )}

        <div
          className="flex min-w-0 flex-1 items-center gap-2.5"
          data-testid="embed-agent-identity"
        >
          <div className="relative shrink-0">
            <Avatar
              className={cn(
                'h-8 w-8',
                CSS_CLASS_NAMES.APP_LAYOUT.MENTOR_IMAGE_CONTAINER_RING,
              )}
            >
              <AvatarImage src={profileImage} alt="" />
              <AvatarFallback className="bg-gradient-to-br from-[#38A1E5] to-[#7284FF] text-xs font-bold text-white">
                {mentorName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isPrivate && (
              <span
                aria-hidden="true"
                data-testid="embed-incognito-badge"
                className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-white ring-2 ring-white [&_svg]:h-2.5 [&_svg]:w-2.5"
              >
                <Glasses />
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] leading-5 font-semibold text-gray-900">
              {mentorName}
            </span>
            {isPrivate && (
              <span className="truncate text-xs leading-4 text-gray-500">
                {t('incognitoChat')}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {/* Only when the host asks for it (the Chrome side panel does). */}
          {showUserProfile && <UserProfile embed />}

          <Button
            variant="ghost"
            size="icon"
            className={iconButtonClass}
            aria-label={t('newChat')}
            onClick={startNewChat}
          >
            <SquarePen />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={iconButtonClass}
                aria-label={t('openMenuOptions')}
                aria-haspopup="menu"
              >
                <CircleHelp />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 rounded-xl p-1.5"
              onFocusOutside={keepMenuOpenForConfirm}
              onInteractOutside={keepMenuOpenForConfirm}
            >
              {showIncognito && (
                <>
                  <DropdownMenuItem
                    role="menuitemcheckbox"
                    aria-checked={isPrivate}
                    data-testid="embed-incognito-item"
                    className="h-10 justify-between gap-3"
                    onSelect={(event) => {
                      event.preventDefault();
                      if (isPreviewMode) return;
                      incognitoToggleRef.current
                        ?.querySelector<HTMLButtonElement>(
                          '[data-testid="chat-privacy-toggle"]',
                        )
                        ?.click();
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Glasses className="h-4 w-4 text-gray-500" />
                      {t('incognito')}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
                        isPrivate ? 'bg-[#38A1E5]' : 'bg-gray-200',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]',
                          isPrivate ? 'left-[18px]' : 'left-0.5',
                        )}
                      />
                    </span>
                    <div ref={incognitoToggleRef} className="sr-only">
                      <ChatPrivacyToggle
                        org={tenantKey}
                        userId={username ?? ''}
                        mentor={mentorId}
                        className="inline-flex"
                      />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {helpItems.map((item) => (
                <DropdownMenuItem
                  className="h-10"
                  key={item.labelKey}
                  onClick={() => {
                    if (isPreviewMode) return;
                    item.onClick();
                  }}
                >
                  <item.icon className="h-4 w-4 text-gray-500" />
                  {t(item.labelKey)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isIframed && allowFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              aria-label={
                isFullscreen ? t('exitFullscreen') : t('enterFullscreen')
              }
              data-testid="embed-fullscreen-toggle"
              onClick={() => {
                if (isPreviewMode) return;
                toggleFullscreen();
              }}
            >
              {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          )}

          {isIframed && showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              aria-label={t('closeChat')}
              onClick={() => {
                if (isPreviewMode) return;
                notifyParentOnEmbedClose();
              }}
            >
              <X />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
