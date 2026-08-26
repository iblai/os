import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { useTranslations } from 'next-intl';

import {
  BadgeHelp,
  CircleUser,
  EllipsisVertical,
  Menu,
  Settings,
  ShieldQuestion,
  X,
} from 'lucide-react';

import { ChatPrivacyToggle } from '@iblai/iblai-js/web-containers';

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
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useChatMode } from '@/hooks/use-chat-mode';
import { useHelpCenter } from '@/hooks/use-help-center';
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
  const chatMode = useChatMode();
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

  function notifyParentOnEmbedClose() {
    window.parent?.postMessage(
      {
        closeEmbed: true,
        collapseSidebarCopilot: true,
      },
      '*',
    );
  }

  useEffect(() => {
    if (isPreviewMode) return;

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
  }, [isPreviewMode]);

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

  return (
    <nav className="flex h-16 w-full items-center bg-white px-4">
      <div className="flex w-full items-center gap-2">
        {/* Toggle sidebar button */}
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

        {/* Mentor name and profile image */}
        <button
          onClick={() => {
            dispatch(clearFiles(undefined));
            eventBus.emit(RemoteEvents.newChat);
            dispatch(chatActions.setShouldStartNewChat(true));
          }}
          className="flex cursor-pointer items-center gap-4"
          aria-label={t('startNewChat', { mentorName })}
        >
          <Avatar
            className={cn(
              'h-10 w-10 border-2 border-blue-500',
              CSS_CLASS_NAMES.APP_LAYOUT.MENTOR_IMAGE_CONTAINER_RING,
            )}
          >
            <AvatarImage src={profileImage} alt="" />
            <AvatarFallback className="bg-blue-400 text-white">
              {mentorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-bold text-gray-800">{mentorName}</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {isOnChatPage && isLoggedIn() && tenantKey && (
            <ChatPrivacyToggle
              org={tenantKey}
              userId={username ?? ''}
              mentor={mentorId}
              className="inline-flex max-md:[&>span]:hidden"
            />
          )}

          {chatMode === 'default' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t('openMenuOptions')}
                  aria-haspopup="menu"
                >
                  <EllipsisVertical className="h-5 w-5" />
                  <span className="sr-only">{t('menuOptions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {helpItems.map((item) => (
                  <DropdownMenuItem
                    className="h-10"
                    key={item.labelKey}
                    onClick={() => {
                      if (isPreviewMode) return;
                      item.onClick();
                    }}
                  >
                    <item.icon className="h-7 w-7" />
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t('openSettingsMenu')}
                  aria-haspopup="menu"
                >
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">{t('settingsMenu')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {username && (
                  <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                    <CircleUser className="h-7 w-7" />
                    {username}
                  </DropdownMenuLabel>
                )}
                {helpItems.map((item) => (
                  <DropdownMenuItem
                    key={item.labelKey}
                    onClick={() => {
                      if (isPreviewMode) return;
                      item.onClick();
                    }}
                  >
                    <item.icon className="h-7 w-7" />
                    {t(item.labelKey)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isIframed && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label={t('closeChat')}
              onClick={() => {
                if (isPreviewMode) return;
                notifyParentOnEmbedClose();
              }}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">{t('closeChat')}</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
