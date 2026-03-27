"use client";

import React from "react";
import Image from "next/image";
import { useParams, usePathname, useSearchParams } from "next/navigation";

import {
  PenSquare,
  Settings,
  Brain,
  Terminal,
  Wrench,
  Plug,
  Shield,
  // Network,
  Clock,
  Grid,
  Key,
  MonitorSmartphone,
  LineChart,
  ChevronDown,
  Menu,
  User,
  Bot,
  GitFork,
  Loader2,
  FileWarning,
  UserCog,
  Archive,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/hooks/user-navigate";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MyMentorsModal } from "@/components/modals/my-mentors-modal";
import { EditMentorModal } from "@/components/modals/edit-mentor-modal";
import { NotificationDropdown } from "@iblai/iblai-js/web-containers";
import { UserProfileModal } from "@iblai/iblai-js/web-containers/next";
import { CreateMentorModal } from "@/components/modals/create-mentor-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LLMProviderSelectionModal } from "@/components/modals/llm-provider-selection-modal";
import {
  useGetMentorSettingsQuery,
  useForkMentorMutation,
  useEditMentorMutation,
} from "@iblai/iblai-js/data-layer";
import {
  useIsAdmin,
  useIsVisiting,
  useUserIsStudent,
  useUsername,
} from "@/hooks/use-user";
import { MODALS, UserType } from "@/lib/constants";
import { TenantKeyMentorIdParams } from "@/lib/types";
import { AuthModal } from "@/components/modals/auth-modal";

import {
  cn,
  getLLMProviderDetails,
  isLoggedIn,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
} from "@/lib/utils";
import { UserProfile } from "./user-profile";
import { useSidebar } from "@/components/ui/sidebar";
import { LearnerModeSwitch } from "./learner-mode-switch";
import { useShowFreeTrialDialog } from "@/hooks/user-user-actions";
// import { useAdvancedChat } from '@iblai/iblai-js/web-utils';
import { useAccessingPublicRoute } from "@/hooks/use-anonymous-mentor";
import { useEmbedMode } from "@/hooks/use-embed-mode";
import { EmbedNavBar } from "./embed-nav-bar";
import eventBus, { RemoteEvents } from "@/lib/eventBus";
import { useUserType } from "@/hooks/use-user-type";
import { rbacPermissionToDisplay } from "@/hoc/utils";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  analyticsActions,
  selectSelectedMentor,
} from "@/features/analytics/slice";
import { useMentorSettings } from "@/hooks/use-mentors/use-mentor-settings";
import { config } from "@/lib/config";
import { MentorVisibilityEnum } from "@iblai/iblai-api";
import { toast } from "sonner";
import { checkRbacPermission } from "@/hoc/withPermissions";
import { selectRbacPermissions } from "@/features/rbac/rbac-slice";
import { useModelDownload } from "@/hooks/use-model-download";
import {
  isTauriOfflineMode,
  isOfflineServerOrigin,
} from "@/hooks/use-tauri-offline";
import { isTauriApp } from "@/types/tauri";

export const menuItems = [
  {
    icon: PenSquare,
    label: "New Chat",
    userTypes: [
      UserType.ANONYMOUS,
      UserType.STUDENT,
      UserType.FREE_TRIAL,
      UserType.ADMIN,
    ],
    rbacResource: (_mentorDbId: number) => `/mentors/${_mentorDbId}/#chat`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      MentorVisibilityEnum.VIEWABLE_BY_ANYONE,
    ],
  },
  {
    icon: Settings,
    label: "Settings",
    tab: MODALS.EDIT_MENTOR.tabs.settings,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#show_settings`,
    permissionFieldsCheck: [
      "mentor_name",
      "mentor_description",
      "profile_image",
      "mentor_visibility",
      "metadata",
      "allow_anonymous",
      "is_lti_accessible",
      "show_attachment",
      "show_voice_call",
      "show_voice_record",
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: UserCog,
    label: "Access",
    tab: MODALS.EDIT_MENTOR.tabs.access,
    userTypes: [UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#read_shared_mentor`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
  },
  {
    icon: Brain,
    label: "LLM",
    tab: MODALS.EDIT_MENTOR.tabs.llm,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) => `/mentors/${_mentorDbId}/llms/#list`,
    permissionFieldsCheck: ["llm_provider"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Terminal,
    label: "Prompts",
    tab: MODALS.EDIT_MENTOR.tabs.prompts,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/prompts/#list&/mentors/${_mentorDbId}/#view_prompts_menu`,
    permissionFieldsCheck: [
      "system_prompt",
      "proactive_prompt",
      "guided_prompt_instructions",
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Shield,
    label: "Safety",
    tab: MODALS.EDIT_MENTOR.tabs.safety,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#view_moderation_logs`,
    permissionFieldsCheck: [
      "safety_system_prompt",
      "moderation_system_prompt",
      "safety_response",
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: FileWarning,
    label: "Disclaimers",
    tab: MODALS.EDIT_MENTOR.tabs.disclaimer,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#view_disclaimers&/mentors/${_mentorDbId}/#view_disclaimers_menu`,
    permissionFieldsCheck: ["disclaimer"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Wrench,
    label: "Tools",
    tab: MODALS.EDIT_MENTOR.tabs.tools,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/tools/#list&/mentors/${_mentorDbId}/#view_tools_menu`,
    permissionFieldsCheck: ["mentor_tools"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Plug,
    label: "MCP",
    tab: MODALS.EDIT_MENTOR.tabs.mcp,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/mcpservers/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Archive,
    label: "Memory",
    tab: MODALS.EDIT_MENTOR.tabs.memory,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/memory/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  // {
  //   icon: Network,
  //   label: 'Flow',
  //   tab: MODALS.EDIT_MENTOR.tabs.flow,
  //   userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
  // },
  {
    icon: Clock,
    label: "History",
    tab: MODALS.EDIT_MENTOR.tabs.history,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#view_chat_history`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Grid,
    label: "Datasets",
    tab: MODALS.EDIT_MENTOR.tabs.datasets,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/documents/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: Key,
    label: "API",
    tab: MODALS.EDIT_MENTOR.tabs.api,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: () => "/apitokens/#list",
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: MonitorSmartphone,
    label: "Embed",
    tab: MODALS.EDIT_MENTOR.tabs.embed,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#can_use_embed`,
    permissionFieldsCheck: ["custom_css", "allow_anonymous"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    icon: LineChart,
    label: "Analytics",
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#view_analytics`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
];

export const getFilteredMenuItems = (
  isUserTypeAllowed: (item: any) => boolean,
  isAdmin: boolean,
  tenantKey: string | undefined,
  mentorSettings: any,
  config: any,
  rbacPermissions: any,
) => {
  // New Chat (first item) is always included for all users
  const newChatItem = menuItems[0];

  // Filter remaining items (admin/settings items)
  const filteredItems = menuItems
    .slice(1)
    .filter((item) => isUserTypeAllowed(item))
    .filter((item) => {
      if (
        (isAdmin && tenantKey === config.mainTenantKey()) ||
        mentorSettings?.platform_key !== config.mainTenantKey() ||
        (item.mentorVisibility.includes(
          mentorSettings?.mentor_visibility as MentorVisibilityEnum,
        ) &&
          !(!isAdmin && tenantKey === config.mainTenantKey()))
      ) {
        return true;
      }
      return false;
    })
    .filter((item) => {
      // Include item only if both permission checks pass (AND logic)
      const hasFieldPermission = rbacPermissionToDisplay(
        item.permissionFieldsCheck,
        mentorSettings?.permissions?.field,
      );
      const hasRbacPermission =
        !item.rbacResource ||
        (mentorSettings &&
          checkRbacPermission(
            rbacPermissions,
            item.rbacResource?.(mentorSettings!.mentor_id),
          ));
      return hasFieldPermission && hasRbacPermission;
    });

  return [newChatItem, ...filteredItems];
};

export function NavBar() {
  const [openModal, setOpenModal] = React.useState(false);
  const dispatch = useAppDispatch();
  const selectedAnalyticsMentor = useAppSelector(selectSelectedMentor);
  const isAccessingPublicRoute = useAccessingPublicRoute();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const isAdmin = useIsAdmin();
  const userIsStudent = useUserIsStudent();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck, FreeTrialDialog, closeModal, isModalOpen } =
    useShowFreeTrialDialog();

  // Check if we're in Tauri offline mode - skip API calls if so
  const isTauriOffline =
    isOfflineServerOrigin() || (isTauriApp() && isTauriOfflineMode());

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? "",
    },
    {
      skip: !mentorId || !tenantKey || !username || isTauriOffline,
    },
  );
  const { data: mentorSettingsCombinedPublicAndPrivate } = useMentorSettings();

  const requiresLoginForChat =
    mentorSettingsCombinedPublicAndPrivate?.mentorVisibility ===
      MentorVisibilityEnum.VIEWABLE_BY_ANYONE &&
    mentorSettingsCombinedPublicAndPrivate?.allowAnonymous === false;

  const loginButtonLabel = requiresLoginForChat ? "Log in" : "Log in";

  const handleLoginClick = React.useCallback(() => {
    if (requiresLoginForChat && tenantKey) {
      redirectToAuthSpaJoinTenant(tenantKey);
      return;
    }

    console.log(
      "[auth-redirect] User login from navbar without tenant key or login not required",
    );
    redirectToAuthSpa();
  }, [requiresLoginForChat, tenantKey]);

  const {
    openEditMentorModal,
    showEditMentorModal,
    closeEditMentorModal,
    showCreateMentorModal,
    closeCreateMentorModal,
    navigateToAnalytics,
    navigateToMentor,
    getUpdatedModalStack,
    navigateToNotifications,
  } = useNavigate();
  const [isProviderSelectionOpen, setIsProviderSelectionOpen] =
    React.useState(false);

  const userIsVisiting = useIsVisiting();

  const { isUserTypeAllowed } = useUserType(mentorSettings);

  const llmProviderDetails = getLLMProviderDetails(
    mentorSettingsCombinedPublicAndPrivate?.llmProvider ?? "",
    mentorSettingsCombinedPublicAndPrivate?.llmName,
  );

  const { toggleSidebar, open: openSidebar, isMobile } = useSidebar();

  const [, setIsMentorListOpen] = React.useState(false);

  const [isUserProfileOpen, setIsUserProfileOpen] = React.useState(false);
  const [isMyMentorsModalOpen, setIsMyMentorsModalOpen] = React.useState(false);
  const embedMode = useEmbedMode();

  // Local LLM download hook for Tauri app
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
    foundryStatusLoaded,
    onSelectFoundryModel,
  } = useModelDownload();

  console.log("[NavBar] After useModelDownload:", {
    isLocalLLMAvailable,
    foundryStatus,
    foundryStatusLoaded,
    isUsingFoundry,
    hasFoundryStatus: foundryStatus !== undefined,
    foundryStatusIsNull: foundryStatus === null,
    foundryStatusKeys: foundryStatus ? Object.keys(foundryStatus) : "null",
  });

  // Log whenever foundryStatus changes
  React.useEffect(() => {
    console.log("[NavBar] foundryStatus changed:", {
      foundryStatus,
      foundryStatusLoaded,
      isNull: foundryStatus === null,
      keys: foundryStatus ? Object.keys(foundryStatus) : "null",
    });
  }, [foundryStatus, foundryStatusLoaded]);

  // Log when modal is open with foundryStatus
  React.useEffect(() => {
    if (isUserProfileOpen) {
      console.log("[NavBar] Modal is open, current foundryStatus:", {
        foundryStatus,
        foundryStatusLoaded,
        isUsingFoundry,
        hasFoundryStatus: foundryStatus !== undefined && foundryStatus !== null,
      });
    }
  }, [isUserProfileOpen, foundryStatus, foundryStatusLoaded, isUsingFoundry]);

  const [forkMentor, { isLoading: isForkingMentor }] = useForkMentorMutation();

  const [editMentor] = useEditMentorMutation();
  const searchParams = useSearchParams();
  const hideNavbarRaw = searchParams.get("hide-navbar");
  const hideNavbar = hideNavbarRaw === "1" || hideNavbarRaw === "true";

  const handleModifyMentor = async () => {
    if (!tenantKey || !mentorId || !username) {
      toast.error("Unable to modify mentor. Missing context.");
      return;
    }
    try {
      const forkedMentor = await forkMentor({
        mentor: mentorId,
        // @ts-expect-error org is not part of the useForkMentorMutation Query definition
        org: mentorSettings?.platform_key,
        userId: username ?? "",
        requestBody: {
          new_mentor_name: `Copy of ${selectedMentorName}`,
          destination_platform_key: tenantKey,
          clone_documents: mentorSettings?.forkable_with_training_data,
        },
      }).unwrap();
      if (
        // @ts-expect-error settings is not part of the forkedMentor object
        forkedMentor?.settings?.mentor_visibility ===
        MentorVisibilityEnum.VIEWABLE_BY_ANYONE
      ) {
        await editMentor({
          // @ts-expect-error mentor is not part of the useEditMentorMutation Query definition
          mentor: forkedMentor.unique_id,
          org: tenantKey,
          userId: username ?? "",
          formData: {
            mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
          },
        }).unwrap();
      }
      //REDIRECT TO THE NEW MENTOR
      toast.success("Mentor successfully forked. Switching to new mentor...");
      const newStack = getUpdatedModalStack(
        MODALS.EDIT_MENTOR.name,
        MODALS.EDIT_MENTOR.tabs.settings,
        forkedMentor.unique_id,
      );
      navigateToMentor(
        // @ts-expect-error mentor is not part of the useEditMentorMutation Query definition
        forkedMentor.unique_id,
        `modal=${JSON.stringify(newStack)}`,
      );
    } catch (error) {
      toast.error("Failed to modify mentor");
      // console.error(JSON.stringify(error));;
    }
  };

  const selectedMentorName =
    mentorSettingsCombinedPublicAndPrivate?.mentorName || "";
  const selectedMentorCategory =
    mentorSettingsCombinedPublicAndPrivate?.llmName ?? "";

  const filteredItems = getFilteredMenuItems(
    isUserTypeAllowed,
    isAdmin,
    tenantKey,
    mentorSettings,
    config,
    rbacPermissions,
  );

  const showForkButton =
    !(isAdmin && tenantKey === config.mainTenantKey()) &&
    mentorSettings?.mentor_visibility ===
      MentorVisibilityEnum.VIEWABLE_BY_ANYONE &&
    // @ts-ignore
    mentorSettings?.platform_key === config.mainTenantKey() &&
    mentorSettings?.forkable;

  const hasDropdownItems = filteredItems.length > 0 || showForkButton;

  React.useEffect(() => {
    if (mentorSettingsCombinedPublicAndPrivate?.mentorUniqueId) {
      dispatch(
        analyticsActions.setSelectedMentor({
          slug: mentorSettingsCombinedPublicAndPrivate?.mentorSlug ?? "",
          name: mentorSettingsCombinedPublicAndPrivate?.mentorName ?? "",
          profileImage:
            mentorSettingsCombinedPublicAndPrivate?.profileImage ?? "",
        }),
      );
    }
  }, [mentorSettingsCombinedPublicAndPrivate?.mentorUniqueId]);

  const pathname = usePathname();
  const isPromptGalleryOrAnalytics =
    pathname.includes("/prompt-gallery") || pathname.includes("/analytics");
  const isWorkflowsPage = /\/workflows\/[^/]+\/?$/.test(pathname);
  const isOnChatPage =
    !pathname.includes("/prompt-gallery") &&
    !pathname.includes("/analytics") &&
    !pathname.includes("/explore") &&
    !isWorkflowsPage;

  const handleAvatarClick = () => {
    // Open the mentor menu instead of the profile
    setIsMentorListOpen(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleViewNotifications = React.useCallback(
    (notificationId?: string) => {
      navigateToNotifications(notificationId);
    },
    [navigateToNotifications],
  );

  const visibleToLoggedInUsersOnly = !isAccessingPublicRoute || isLoggedIn();

  if (hideNavbar) {
    return <></>;
  }
  if (embedMode) {
    return (
      <EmbedNavBar
        isMobile={isMobile}
        isAnonymousMentor={isAccessingPublicRoute}
        toggleSidebar={toggleSidebar}
        openSidebar={openSidebar}
        mentorName={selectedMentorName}
        profileImage={
          mentorSettingsCombinedPublicAndPrivate?.profileImage ?? ""
        }
        tenantKey={tenantKey}
      />
    );
  }

  return (
    <>
      <nav className="flex h-16 items-center bg-white pr-4 mb-4 z-10 border-b border-[#D0E0FF]">
        <div className="flex items-center">
          {/* Add drawer toggle button for tablet view */}
          {isMobile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-4 cursor-pointer"
                    onClick={toggleSidebar}
                    aria-label={openSidebar ? "Close sidebar" : "Open sidebar"}
                    data-testid="(Close|Open) sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content" side="right">
                  Toggle Sidebar
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="flex items-center pl-2 md:pl-4">
            {isOnChatPage && isAdmin && !userIsStudent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
                    onClick={() =>
                      !userIsVisiting && setIsProviderSelectionOpen(true)
                    }
                    aria-label="LLM Model Selector"
                  >
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white">
                      {llmProviderDetails?.logo ? (
                        <Image
                          src={llmProviderDetails.logo}
                          alt={`${selectedMentorCategory} model logo`}
                          className="h-5 w-5 object-contain"
                          height={32}
                          width={32}
                          loading="lazy"
                        />
                      ) : (
                        <Bot />
                      )}
                    </div>
                    <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {selectedMentorCategory}
                    </span>
                    {!userIsStudent && (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="ibl-tooltip-content" side="bottom">
                  {isAdmin ? "Select LLM Model" : selectedMentorName}
                </TooltipContent>
              </Tooltip>
            )}

            {!pathname.includes("/explore") &&
              !isWorkflowsPage &&
              mentorId &&
              (isPromptGalleryOrAnalytics ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex items-center gap-1 text-sm font-medium text-[#646464]"
                        onClick={() => setIsMyMentorsModalOpen(true)}
                      >
                        <Avatar className="mr-1 h-5 w-5">
                          <AvatarImage
                            src={selectedAnalyticsMentor?.profileImage ?? ""}
                            alt={selectedAnalyticsMentor?.name ?? ""}
                            onClick={handleAvatarClick}
                          />
                          <AvatarFallback>
                            {selectedAnalyticsMentor?.name?.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{selectedAnalyticsMentor?.name}</span>
                        {!userIsStudent && (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      className="ibl-tooltip-content"
                      side="bottom"
                    >
                      Select Mentor
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : hasDropdownItems ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848]"
                    asChild
                  >
                    <Button
                      variant="ghost"
                      className="flex cursor-pointer items-center gap-1"
                      aria-label="Selected mentor dropdown button"
                    >
                      <User className="h-4 w-4 text-[#646464]" />
                      <span className="hidden sm:block">
                        {selectedMentorName}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    className="w-[180px] rounded-md border border-gray-200 bg-white p-2 shadow-lg"
                  >
                    {filteredItems.map((item, index) => {
                      return (
                        <DropdownMenuItem
                          key={index}
                          className={cn(
                            "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100",
                          )}
                          onClick={() => {
                            if (item.tab) {
                              openEditMentorModal(item.tab);
                              return;
                            }
                            if (item.label.toLowerCase() === "analytics") {
                              executeWithTrialCheck(navigateToAnalytics);
                              return;
                            }
                            // startNewChat();
                            eventBus.emit(RemoteEvents.newChat);
                          }}
                        >
                          <item.icon className="mr-3 h-4 w-4 text-gray-600" />
                          {item.label}
                        </DropdownMenuItem>
                      );
                    })}
                    {/* FORK MENTOR FEATURE */}
                    {!(isAdmin && tenantKey === config.mainTenantKey()) &&
                      mentorSettings?.mentor_visibility ===
                        MentorVisibilityEnum.VIEWABLE_BY_ANYONE &&
                      // @ts-ignore
                      mentorSettings?.platform_key === config.mainTenantKey() &&
                      mentorSettings?.forkable && (
                        <DropdownMenuItem
                          className={cn(
                            "flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100",
                          )}
                          onClick={() => {
                            executeWithTrialCheck(handleModifyMentor);
                          }}
                          disabled={isForkingMentor}
                          aria-disabled={isForkingMentor}
                          aria-busy={isForkingMentor}
                        >
                          {isForkingMentor ? (
                            <Loader2 className="mr-3 h-4 w-4 text-gray-600 animate-spin" />
                          ) : (
                            <GitFork className="mr-3 h-4 w-4 text-gray-600" />
                          )}
                          Modify
                        </DropdownMenuItem>
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  className="flex items-center gap-1 text-sm font-medium text-[#646464]"
                  aria-label="Selected mentor"
                >
                  <User className="h-4 w-4 text-[#646464]" />
                  <span className="hidden sm:block">{selectedMentorName}</span>
                </Button>
              ))}

            <>
              {isOnChatPage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="hidden cursor-pointer items-center gap-2 text-sm font-medium whitespace-nowrap text-[#646464] transition-colors hover:text-[#484848] md:flex"
                      onClick={() => setIsMyMentorsModalOpen(true)}
                    >
                      <Image
                        src="/icons/my-mentors.svg"
                        alt=""
                        width={20}
                        height={20}
                        className="text-gray-500"
                      />
                      <span className="whitespace-nowrap hidden lg:flex">
                        My Mentors
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="ibl-tooltip-content" side="bottom">
                    View My Mentors
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0 xl:gap-6">
          {visibleToLoggedInUsersOnly && isAdmin && !userIsVisiting && (
            <div className="hidden items-center gap-2 xl:flex">
              <span
                className={cn(
                  "text-sm",
                  userIsStudent ? "font-semibold" : "text-gray-500",
                )}
              >
                Learner
              </span>
              <LearnerModeSwitch />
              <span
                className={cn(
                  "text-sm",
                  userIsStudent ? "text-gray-500" : "font-semibold",
                )}
              >
                Instructor
              </span>
            </div>
          )}
          {!embedMode && visibleToLoggedInUsersOnly && (
            <NotificationDropdown
              org={tenantKey}
              userId={username ?? ""}
              isAdmin={isAdmin}
              onViewNotifications={handleViewNotifications}
            />
          )}
          {visibleToLoggedInUsersOnly && <UserProfile />}

          {!isLoggedIn() && (
            <div className="flex gap-x-2">
              <Button className="ibl-button-primary" onClick={handleLoginClick}>
                {loginButtonLabel}
              </Button>
              <Button onClick={handleLoginClick} variant="outline">
                Sign up for free
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* MODALS */}
      {isProviderSelectionOpen && (
        <LLMProviderSelectionModal
          isOpen={isProviderSelectionOpen}
          onClose={() => setIsProviderSelectionOpen(false)}
        />
      )}
      {showEditMentorModal && (
        <EditMentorModal
          isOpen={showEditMentorModal}
          onClose={closeEditMentorModal}
        />
      )}
      {showCreateMentorModal && (
        <CreateMentorModal
          isOpen={showCreateMentorModal}
          onClose={closeCreateMentorModal}
        />
      )}
      {isMyMentorsModalOpen && (
        <MyMentorsModal
          isOpen={isMyMentorsModalOpen}
          onClose={() => setIsMyMentorsModalOpen(false)}
          hideCreateButton={isPromptGalleryOrAnalytics}
        />
      )}
      {isUserProfileOpen && (
        <UserProfileModal
          isOpen={isUserProfileOpen}
          onClose={() => setIsUserProfileOpen(false)}
          params={{
            tenantKey,
            mentorId,
            isAdmin,
          }}
          useGravatarPicFallback={
            config.enableGravatarOnProfilePic() !== "false"
          }
          currentSPA={config.iblPlatform() || "mentor"}
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
      )}
      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}
      {openModal && (
        <AuthModal
          isOpen={openModal}
          onClose={handleCloseModal}
          tenantKey={tenantKey ?? ""}
        />
      )}
    </>
  );
}
