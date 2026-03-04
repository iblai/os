import React from 'react';

import {
  BadgeHelp,
  CircleUser,
  EllipsisVertical,
  Menu,
  Settings,
  ShieldQuestion,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useChatMode } from '@/hooks/use-chat-mode';
import { useUsername } from '@/hooks/use-user';
import { cn, isLoggedIn } from '@/lib/utils';
import { config } from '@/lib/config';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { addProtocolToUrl } from '@iblai/iblai-js/web-utils';
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
};

export function EmbedNavBar({
  mentorName,
  profileImage,
  isMobile,
  isAnonymousMentor,
  toggleSidebar,
  openSidebar,
  tenantKey,
}: Props) {
  const username = useUsername();
  const isPreviewMode = useIsPreviewMode();
  const chatMode = useChatMode();
  const dispatch = useAppDispatch();

  const { metadata } = useTenantMetadata({
    org: tenantKey,
  });

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

  const helpItems = [
    ...(metadata?.show_help !== false
      ? [
          {
            label: 'Help',
            icon: BadgeHelp,
            onClick: () => {
              window.open(
                addProtocolToUrl(metadata?.help_center_url || config.helpCenterUrl()),
                '_blank',
              );
            },
          },
        ]
      : []),
    {
      label: 'Support',
      icon: ShieldQuestion,
      onClick: () => {
        window.open(`mailto:${metadata?.support_email || config.supportEmail()}`, '_blank');
      },
    },
  ];

  const advancedChatSettings = [
    ...(username
      ? [
          {
            label: username ?? '',
            icon: CircleUser,
            onClick: () => {},
          },
        ]
      : []),
    /* {
      label: 'theme mode',
      icon: currentTheme === 'light' ? Moon : Sun,
      onClick: () => {
        setCurrentTheme(currentTheme === 'light' ? 'dark' : 'light');
      },
    }, */
    ...helpItems,
  ];

  return (
    <nav className="flex h-16 items-center bg-white px-4 w-full">
      <div className="flex items-center gap-2 w-full">
        {/* Toggle sidebar button */}
        {isMobile && visibleToLoggedInUsersOnly && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={toggleSidebar}
                aria-label={openSidebar ? 'Close sidebar' : 'Open sidebar'}
                data-testid="(Close|Open) sidebar"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="ibl-tooltip-content" side="right">
              Toggle Sidebar
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
          className="flex items-center gap-4 cursor-pointer"
          aria-label={`Start new chat with ${mentorName}`}
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

        {/* Close button */}
        {chatMode === 'default' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Open menu options"
                aria-haspopup="menu"
              >
                <EllipsisVertical className="h-5 w-5" />
                <span className="sr-only">Menu options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {helpItems.map((item) => (
                <DropdownMenuItem
                  className="h-10"
                  key={item.label}
                  onClick={() => {
                    // if (isPreviewMode) return;
                    item.onClick();
                  }}
                >
                  <item.icon className="h-7 w-7" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Open settings menu"
                  aria-haspopup="menu"
                  onClick={() => {
                    if (isPreviewMode) return;
                  }}
                >
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {advancedChatSettings.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={() => {
                      if (isPreviewMode) return;
                      item.onClick();
                    }}
                  >
                    <item.icon className="h-7 w-7" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Close chat"
          onClick={() => {
            if (isPreviewMode) return;
            notifyParentOnEmbedClose();
          }}
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close chat</span>
        </Button>
      </div>
    </nav>
  );
}
