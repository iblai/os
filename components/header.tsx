'use client';

import React from 'react';
import Image from 'next/image';
import { useParams, usePathname } from 'next/navigation';

import {
  PenSquare,
  Settings,
  Brain,
  Terminal,
  Plug,
  Wrench,
  Shield,
  Network,
  Clock,
  ScrollText,
  Grid,
  Key,
  MonitorSmartphone,
  LineChart,
  ChevronDown,
  Plus,
  Menu,
} from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/modals/settings-modal';
import { LLMProviderSelectionModal } from '@/components/modals/llm-provider-selection-modal';
import { MentorListModal } from '@/components/modals/mentor-list-modal';
import { Switch } from '@/components/ui/switch';
import { EditMentorModal } from '@/components/modals/edit-mentor-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { HelpModal } from '@/components/modals/help-modal';
import { CreateMentorModal } from '@/components/modals/create-mentor-modal';
import { UserProfileModal } from '@iblai/iblai-js/web-containers/next';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useNavigate } from '@/hooks/user-navigate';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { getUserEmail } from '@/features/utils';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { ANONYMOUS_USERNAME, MODALS } from '@/lib/constants';

import { ProfileButton } from './header/profile-button';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';
import { useModelDownload } from '@/hooks/use-model-download';

const menuItems = [
  { icon: PenSquare, label: 'New chat', isAdmin: false },
  {
    icon: Settings,
    label: 'Settings',
    tab: MODALS.EDIT_MENTOR.tabs.settings,
    isAdmin: true,
  },
  {
    icon: Brain,
    label: 'LLM',
    tab: MODALS.EDIT_MENTOR.tabs.llm,
    isAdmin: true,
  },
  {
    icon: Terminal,
    label: 'Prompts',
    tab: MODALS.EDIT_MENTOR.tabs.prompts,
    isAdmin: true,
  },
  {
    icon: Wrench,
    label: 'Tools',
    tab: MODALS.EDIT_MENTOR.tabs.tools,
    isAdmin: true,
  },
  {
    icon: Plug,
    label: 'MCP',
    tab: MODALS.EDIT_MENTOR.tabs.mcp,
    isAdmin: true,
  },
  {
    icon: Shield,
    label: 'Safety',
    tab: MODALS.EDIT_MENTOR.tabs.safety,
    isAdmin: true,
  },
  {
    icon: Network,
    label: 'Flow',
    tab: MODALS.EDIT_MENTOR.tabs.flow,
    isAdmin: true,
  },
  {
    icon: Clock,
    label: 'History',
    tab: MODALS.EDIT_MENTOR.tabs.history,
    isAdmin: true,
  },
  {
    icon: ScrollText,
    label: 'Audit',
    tab: MODALS.EDIT_MENTOR.tabs.audit_log,
    isAdmin: true,
  },
  {
    icon: Grid,
    label: 'Datasets',
    tab: MODALS.EDIT_MENTOR.tabs.datasets,
    isAdmin: true,
  },
  { icon: Key, label: 'API', tab: MODALS.EDIT_MENTOR.tabs.api, isAdmin: true },
  {
    icon: MonitorSmartphone,
    label: 'Embed',
    tab: MODALS.EDIT_MENTOR.tabs.embed,
    isAdmin: true,
  },
  { icon: LineChart, label: 'Analytics', isAdmin: true },
];

// Define the ProfileButton component

// Update the props interface to include drawer controls
interface HeaderProps {
  isDrawerOpen?: boolean;
  toggleDrawer?: () => void;
  isMobileOrTablet?: boolean;
}

// Update the Header component to accept the new props
export function Header({
  isDrawerOpen = false,
  toggleDrawer = () => {},
  isMobileOrTablet = false,
}: HeaderProps) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const isAdmin = useIsAdmin();
  const {
    openEditMentorModal,
    showEditMentorModal,
    closeEditMentorModal,
    navigateToHome,
    openCreateMentorModal,
    showCreateMentorModal,
    closeCreateMentorModal,
  } = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isProviderSelectionOpen, setIsProviderSelectionOpen] =
    React.useState(false);

  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? ANONYMOUS_USERNAME,
    },
    {
      refetchOnMountOrArgChange: true,
    },
  );

  const [isMentorListOpen, setIsMentorListOpen] = React.useState(false);
  const [isInstructor, setIsInstructor] = React.useState(true);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  const [isUserProfileOpen, setIsUserProfileOpen] = React.useState(false);

  // Model download state for Local LLM support
  const {
    isAvailable: isLocalLLMAvailable,
    state: localLLMState,
    ollamaStatus,
    startDownload,
    cancelDownload,
    installOllama,
    installFoundry,
    checkStatus,
    resetState,
    isUsingFoundry,
    foundryModels,
    selectedFoundryModel,
    foundryStatus,
    onSelectFoundryModel,
  } = useModelDownload();

  const selectedMentorName = mentorPublicSettings?.mentor || '';
  const selectedMentorCategory = mentorPublicSettings?.llm_name || '';

  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTablet = useMediaQuery({ minWidth: 768, maxWidth: 1023 });

  const pathname = usePathname();
  const isPromptGalleryOrAnalytics =
    pathname.includes('/prompt-gallery') || pathname.includes('/analytics');
  const isOnChatPage =
    !pathname.includes('/prompt-gallery') &&
    !pathname.includes('/analytics') &&
    !pathname.includes('/explore');

  const handleMentorSelect = (mentor: unknown) => {
    console.log('Selected mentor:', mentor);
    setIsMentorListOpen(false);
  };

  if (isMobile) {
    return (
      <header className="flex h-20 items-center justify-between bg-white pr-4">
        <div className="flex items-center">
          {/* Drawer toggle button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-4"
                  onClick={toggleDrawer}
                  aria-label={isDrawerOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="ibl-tooltip-content" side="right">
                Toggle Sidebar
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Content div - same as tablet view */}
          <div className="flex items-center space-x-6 pl-2">
            {isOnChatPage && isInstructor && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
                      onClick={() => setIsProviderSelectionOpen(true)}
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
                        <Image
                          src={'/placeholder.svg'}
                          alt="LLM model icon"
                          className="h-5 w-5 object-contain"
                          height={32}
                          width={32}
                        />
                      </div>
                      <span className="hidden max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap md:block">
                        {selectedMentorCategory}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="ibl-tooltip-content" side="bottom">
                    Select LLM Model
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {!pathname.includes('/explore') && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentAI_logo%202-g0IIg5g9339HMl0lTgvLQSm02plhB3.png"
                      alt="Agentic OS"
                    />
                    <AvatarFallback>
                      {selectedMentorName.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{selectedMentorName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[180px] rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                >
                  {menuItems.map((item, index) => (
                    <DropdownMenuItem
                      key={index}
                      className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        if (item.tab) {
                          openEditMentorModal(item.tab);
                          return;
                        }
                        navigateToHome();
                      }}
                    >
                      <item.icon className="mr-3 h-4 w-4 text-gray-600" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Right section with user controls - same as tablet */}
        <div className="mr-2 flex items-center space-x-6">
          <ProfileButton
            userImage="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rectangle%20%281%29-mODsL0FbnqjnO5Z76jp3UtUkbjRXsj.png"
            userName="MA"
            onClick={() => {}}
            onProfileClick={() => setIsUserProfileOpen(true)}
            isInstructor={isInstructor}
            setIsInstructor={setIsInstructor}
            isMobile={true}
          />
        </div>

        <LLMProviderSelectionModal
          isOpen={isProviderSelectionOpen}
          onClose={() => setIsProviderSelectionOpen(false)}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        <MentorListModal
          isOpen={isMentorListOpen}
          onClose={() => setIsMentorListOpen(false)}
          onSelect={handleMentorSelect}
        />
        <EditMentorModal
          isOpen={showEditMentorModal}
          onClose={closeEditMentorModal}
        />
        {/* <UserProfileModal
          isOpen={isUserProfileOpen}
          onClose={() => setIsUserProfileOpen(false)}
          params={{
            tenantKey,
            mentorId,
            isAdmin,
          }}
          authURL={config.authUrl()}
          currentPlatformBaseDomain={config.platformBaseDomain()}
          localLLMProps={{
            isAvailable: isLocalLLMAvailable,
            state: localLLMState,
            ollamaStatus,
            isUsingFoundry,
            foundryModels,
            selectedFoundryModel,
            foundryStatus,
            onStartDownload: startDownload,
            onCancelDownload: cancelDownload,
            onInstallOllama: installOllama,
            onInstallFoundry: installFoundry,
            onCheckStatus: checkStatus,
            onResetState: resetState,
            onSelectFoundryModel,
          }}
        /> */}
      </header>
    );
  }

  return (
    <header className="flex h-20 items-center justify-between bg-white pr-4">
      <div className="flex items-center">
        {/* Add drawer toggle button for tablet view */}
        <TooltipProvider>
          {isMobileOrTablet && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-4"
                  onClick={toggleDrawer}
                  aria-label={isDrawerOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="ibl-tooltip-content" side="right">
                Toggle Sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>

        <div
          className={`flex items-center space-x-6 ${isMobileOrTablet ? 'pl-2' : 'pl-4'} ${!isOnChatPage || !isInstructor ? '' : ''}`}
        >
          {isOnChatPage && isInstructor && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center gap-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
                    onClick={() => {
                      if (!isAdmin) return null;
                      setIsProviderSelectionOpen(true);
                    }}
                  >
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
                      <Image
                        src={'/placeholder.svg'}
                        alt="LLM model icon"
                        className="h-5 w-5 object-contain"
                        height={32}
                        width={32}
                      />
                    </div>
                    <span className="hidden max-w-[100px] overflow-hidden text-ellipsis whitespace-nowrap md:block">
                      {selectedMentorCategory}
                    </span>
                    {isAdmin && (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content" side="bottom">
                  {isAdmin ? 'Select LLM model' : selectedMentorName}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {!pathname.includes('/explore') &&
            (isPromptGalleryOrAnalytics ? (
              <div className="flex items-center space-x-2 text-sm font-medium text-[#646464]">
                <Avatar className="mr-1 h-5 w-5">
                  <AvatarImage
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentAI_logo%202-g0IIg5g9339HMl0lTgvLQSm02plhB3.png"
                    alt="Agentic OS"
                  />
                  <AvatarFallback>
                    {selectedMentorName.substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span>{selectedMentorName}</span>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]">
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentAI_logo%202-g0IIg5g9339HMl0lTgvLQSm02plhB3.png"
                      alt="Agentic OS"
                    />
                    <AvatarFallback>
                      {selectedMentorName.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span>{selectedMentorName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[180px] rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                >
                  {menuItems
                    .filter((item) => item.isAdmin === isAdmin)
                    .map((item, index) => (
                      <DropdownMenuItem
                        key={index}
                        className={cn(
                          'flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100',
                        )}
                        onClick={() => {
                          if (item.tab) {
                            openEditMentorModal(item.tab);
                            return;
                          }
                          navigateToHome();
                        }}
                      >
                        <item.icon className="mr-3 h-4 w-4 text-gray-600" />
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}

          <>
            {isOnChatPage && isAdmin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="hidden w-full gap-2 bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:text-white hover:opacity-90 sm:hidden sm:w-auto md:hidden lg:flex"
                      onClick={() => openCreateMentorModal()}
                    >
                      <Plus className="h-4 w-4" />
                      Create
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="ibl-tooltip-content" side="bottom">
                    Create New Agent
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        </div>
      </div>

      <div className="mr-2 flex items-center space-x-6">
        {isAdmin && (
          <div className="hidden items-center gap-2 md:flex">
            <span
              className={`text-sm ${isInstructor ? 'text-gray-500' : 'font-semibold'}`}
            >
              User
            </span>
            <Switch
              checked={isInstructor}
              onCheckedChange={setIsInstructor}
              className="data-[state=checked]:bg-blue-500"
            />
            <span
              className={`text-sm ${isInstructor ? 'font-semibold' : 'text-gray-500'}`}
            >
              Admin
            </span>
          </div>
        )}

        <ProfileButton
          userImage="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Rectangle%20%281%29-mODsL0FbnqjnO5Z76jp3UtUkbjRXsj.png"
          userName="MA"
          onClick={() => {}}
          onProfileClick={() => setIsUserProfileOpen(true)}
          isInstructor={isInstructor}
          setIsInstructor={setIsInstructor}
          isMobile={isTablet}
        />
      </div>
      <LLMProviderSelectionModal
        isOpen={isProviderSelectionOpen}
        onClose={() => setIsProviderSelectionOpen(false)}
      />
      <EditMentorModal
        isOpen={showEditMentorModal}
        onClose={closeEditMentorModal}
      />
      {showCreateMentorModal && (
        <CreateMentorModal
          isOpen={showCreateMentorModal}
          onClose={closeCreateMentorModal}
        />
      )}
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={() => setIsUserProfileOpen(false)}
        email={getUserEmail()}
        mainPlatformKey={config.mainTenantKey()}
        params={{
          tenantKey,
          mentorId,
          isAdmin,
        }}
        authURL={config.authUrl()}
        currentPlatformBaseDomain={config.platformBaseDomain()}
        localLLMProps={{
          isAvailable: isLocalLLMAvailable,
          state: localLLMState,
          ollamaStatus,
          isUsingFoundry,
          foundryModels,
          selectedFoundryModel,
          foundryStatus,
          onStartDownload: startDownload,
          onCancelDownload: cancelDownload,
          onInstallOllama: installOllama,
          onInstallFoundry: installFoundry,
          onCheckStatus: checkStatus,
          onResetState: resetState,
          onSelectFoundryModel,
        }}
      />
    </header>
  );
}

// Also export as default
export default Header;
