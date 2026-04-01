"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SettingsTab,
  LLMTab,
  PromptsTab,
  McpTab,
  ToolsTab,
  SafetyTab,
  // FlowTab,
  HistoryTab,
  DatasetsTab,
  ApiTab,
  EmbedTab,
  AccessTab,
} from "./tabs";
import { useNavigate } from "@/hooks/user-navigate";
import { MODALS, UserType } from "@/lib/constants";
import { useGetMentorSettingsQuery } from "@iblai/iblai-js/data-layer";
import { useGetMemsearchConfigQuery } from "@iblai/iblai-js/data-layer";
import { useParams } from "next/navigation";
import { useIsAdmin, useUsername } from "@/hooks/use-user";
import { TenantKeyMentorIdParams } from "@/lib/types";
import { rbacPermissionToDisplay } from "@/hoc/utils";
import {
  Settings,
  Brain,
  Terminal,
  Plug,
  Wrench,
  Shield,
  Clock,
  Grid,
  Key,
  MonitorSmartphone,
  FileWarning,
  UserCog,
  Archive,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemoryTab } from "./tabs/memory-tab";
import { DisclaimersTab } from "./tabs/disclaimers-tab";
import { checkRbacPermission } from "@/hoc/withPermissions";
import { selectRbacPermissions } from "@/features/rbac/rbac-slice";
import { useAppSelector } from "@/lib/hooks";
import { useUserType } from "@/hooks/use-user-type";
import { MentorVisibilityEnum } from "@iblai/iblai-api";
import { config } from "@/lib/config";
type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const editMentorTabs = [
  {
    label: "Settings",
    value: MODALS.EDIT_MENTOR.tabs.settings,
    component: <SettingsTab />,
    icon: Settings,
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
    label: "Access",
    value: MODALS.EDIT_MENTOR.tabs.access,
    component: <AccessTab />,
    userTypes: [UserType.ADMIN],
    icon: UserCog,
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#read_shared_mentor`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
  },
  {
    label: "LLM",
    value: MODALS.EDIT_MENTOR.tabs.llm,
    component: <LLMTab />,
    icon: Brain,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) => `/mentors/${_mentorDbId}/llms/#list`,
    permissionFieldsCheck: ["llm_provider"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    label: "Prompts",
    value: MODALS.EDIT_MENTOR.tabs.prompts,
    component: <PromptsTab />,
    icon: Terminal,
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
    label: "Safety",
    value: MODALS.EDIT_MENTOR.tabs.safety,
    component: <SafetyTab />,
    icon: Shield,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#view_moderation_logs`,
    permissionFieldsCheck: [
      "moderation_system_prompt",
      "safety_system_prompt",
      "moderation_response",
      "safety_response",
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    label: "Disclaimers",
    value: MODALS.EDIT_MENTOR.tabs.disclaimer,
    component: <DisclaimersTab />,
    icon: FileWarning,
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
    label: "Tools",
    value: MODALS.EDIT_MENTOR.tabs.tools,
    component: <ToolsTab />,
    icon: Wrench,
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
    label: "MCP",
    value: MODALS.EDIT_MENTOR.tabs.mcp,
    component: <McpTab />,
    icon: Plug,
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
    label: "Memory",
    value: MODALS.EDIT_MENTOR.tabs.memory,
    component: <MemoryTab />,
    icon: Archive,
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
  //   label: "Flow",
  //   value: MODALS.EDIT_MENTOR.tabs.flow,
  //   component: <FlowTab />,
  // },
  {
    label: "History",
    value: MODALS.EDIT_MENTOR.tabs.history,
    component: <HistoryTab />,
    icon: Clock,
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
    label: "Datasets",
    value: MODALS.EDIT_MENTOR.tabs.datasets,
    component: <DatasetsTab />,
    icon: Grid,
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
    label: "API",
    value: MODALS.EDIT_MENTOR.tabs.api,
    component: <ApiTab />,
    icon: Key,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: () => "/apitokens/#list",
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
  {
    label: "Embed",
    value: MODALS.EDIT_MENTOR.tabs.embed,
    component: <EmbedTab />,
    icon: MonitorSmartphone,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (_mentorDbId: number) =>
      `/mentors/${_mentorDbId}/#can_use_embed`,
    permissionFieldsCheck: ["custom_css", "allow_anonymous"],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
  },
];

export function EditMentorModal({ isOpen, onClose }: Props) {
  const { changeModalTab, getEditMentorTab } = useNavigate();
  const { getMentorId } = useNavigate();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [filteredTabs, setFilteredTabs] = useState<typeof editMentorTabs>([]);

  const { data: mentorSettings, isSuccess } = useGetMentorSettingsQuery(
    {
      mentor: getMentorId() || mentorId,
      org: tenantKey,
      // @ts-expect-error userId is no part of the useGetMentorSettingsQuery Query definition
      userId: username ?? "",
    },
    {
      skip: !(getMentorId() || mentorId) || !tenantKey || !username,
    },
  );
  const { data: memsearchConfig } = useGetMemsearchConfigQuery(
    {
      org: tenantKey,
      userId: username ?? "",
    },
    {
      skip: !tenantKey || !username,
    },
  );
  const isMemsearchEnabled = memsearchConfig?.enable_memsearch ?? false;
  const { isUserTypeAllowed } = useUserType(mentorSettings);
  const isAdmin = useIsAdmin();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const activeTab = getEditMentorTab() || MODALS.EDIT_MENTOR.tabs.settings;

  const handleTabChange = (tabValue: string) => {
    changeModalTab(tabValue);
  };

  useEffect(() => {
    if (mentorSettings) {
      console.log("[EditMentorModal] mentorSettings:", mentorSettings);
      console.log("[EditMentorModal] Filter context:", {
        isAdmin,
        tenantKey,
        mainTenantKey: config.mainTenantKey(),
        mentorPlatformKey: mentorSettings?.platform_key,
        mentorVisibility: mentorSettings?.mentor_visibility,
      });

      const filteredTabs = editMentorTabs
        .filter((item) => {
          // Hide Memory tab when memsearch is not enabled
          if (
            item.value === MODALS.EDIT_MENTOR.tabs.memory &&
            !isMemsearchEnabled
          ) {
            return false;
          }
          return true;
        })
        .filter(isUserTypeAllowed)
        .filter((item) => {
          const isAdminOnMainTenant =
            isAdmin && tenantKey === config.mainTenantKey();
          const mentorNotOnMainTenant =
            mentorSettings?.platform_key !== config.mainTenantKey();
          const visibilityMatches = item.mentorVisibility.includes(
            mentorSettings?.mentor_visibility as MentorVisibilityEnum,
          );
          const isNonAdminOnMainTenant =
            !isAdmin && tenantKey === config.mainTenantKey();
          const visibilityAllowed =
            visibilityMatches && !isNonAdminOnMainTenant;

          const passesFilter =
            isAdminOnMainTenant || mentorNotOnMainTenant || visibilityAllowed;

          console.log(`[EditMentorModal] Tab "${item.label}" filter:`, {
            tabMentorVisibility: item.mentorVisibility,
            isAdminOnMainTenant,
            mentorNotOnMainTenant,
            visibilityMatches,
            isNonAdminOnMainTenant,
            visibilityAllowed,
            passesFilter,
            reason: isAdminOnMainTenant
              ? "Admin on main tenant - all tabs allowed"
              : mentorNotOnMainTenant
                ? "Mentor not on main tenant - tab allowed"
                : visibilityAllowed
                  ? "Visibility matches and user is admin or not on main tenant"
                  : "Filtered out - visibility check failed or non-admin on main tenant",
          });

          if (passesFilter) {
            return true;
          }
          return false;
        })
        .filter((item) => {
          // Include item only if both permission checks pass (AND logic)
          const hasFieldPermission = rbacPermissionToDisplay(
            item.permissionFieldsCheck,
            // @ts-expect-error - permissions.field property may not exist on mentorSettings type
            mentorSettings?.permissions?.field,
          );
          const hasRbacPermission =
            !item.rbacResource ||
            checkRbacPermission(
              rbacPermissions,
              item.rbacResource?.(mentorSettings!.mentor_id),
            );
          return hasFieldPermission && hasRbacPermission;
        });

      console.log(
        "[EditMentorModal] Final filtered tabs:",
        filteredTabs.map((t) => t.label),
      );
      setFilteredTabs(filteredTabs);
    }
  }, [isSuccess, mentorSettings, rbacPermissions, isMemsearchEnabled]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`mx-auto w-[85vw] md:w-full max-w-7xl p-0 gap-0 overflow-hidden`}
        style={{
          height: "75vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogDescription className="sr-only">
          Edit Mentor settings, prompts, tools, safety, flow, history, datasets,
          and API keys
        </DialogDescription>
        <div className="flex-1 overflow-y-auto lg:overflow-hidden scrollbar-none">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex flex-col lg:flex-row h-full"
          >
            {/* Mobile Header */}
            <div className="lg:hidden">
              <DialogHeader className="px-3 py-4 border-b border-gray-200">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit {getMentorId() ? mentorSettings?.mentor : "Mentor"}
                </DialogTitle>
              </DialogHeader>
            </div>
            {/* Desktop Sidebar - Now takes up 1/3 of the width */}
            <div className="hidden lg:flex bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col w-80 min-w-0 flex-shrink-0">
              <DialogHeader className="p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 h-[73px] flex justify-start">
                <DialogTitle className="text-lg font-semibold text-gray-900">
                  Edit {getMentorId() ? mentorSettings?.mentor : "Mentor"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto scrollbar-none">
                <TabsList
                  className="flex-col h-auto bg-transparent p-2 space-y-1 w-full"
                  aria-label="Mentor settings tabs"
                >
                  {filteredTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="w-full justify-start px-4 py-3 text-left text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-400 data-[state=active]:text-white data-[state=active]:font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-300"
                      id={`desktop-tab-${tab.value}`}
                      aria-controls={`panel-${tab.value}`}
                    >
                      <tab.icon
                        className="h-4 w-4 mr-3 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {/* Mobile and Tablet Tabs */}
            <div className="lg:hidden">
              <TabsList
                className="w-full justify-start px-3 py-2 bg-white border-b border-gray-200 rounded-none h-auto overflow-x-auto"
                aria-label="Mentor settings tabs"
              >
                {/* Show first 4 tabs on mobile, first 8 tabs on tablet */}
                {filteredTabs
                  .slice(0, window.innerWidth >= 768 ? 8 : 3)
                  .map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
                      id={`tab-${tab.value}`}
                      aria-controls={`panel-${tab.value}`}
                    >
                      <tab.icon
                        className="h-3 w-3 sm:h-4 sm:w-4"
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden text-xs">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                {/* Show dropdown for remaining tabs */}
                {filteredTabs.length > (window.innerWidth >= 768 ? 8 : 3) && (
                  <>
                    <TabsTrigger
                      key={activeTab}
                      value={activeTab}
                      className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm px-2 data-[state=active]:shadow-none"
                      id={`tab-${activeTab}`}
                      aria-controls={`panel-${activeTab}`}
                    >
                      <Select value={activeTab} onValueChange={handleTabChange}>
                        <SelectTrigger
                          className="w-auto border-none shadow-none text-xs sm:text-sm"
                          aria-label="More tabs"
                        >
                          <SelectValue placeholder="More..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredTabs
                            .slice(window.innerWidth >= 768 ? 8 : 3)
                            .map((tab) => (
                              <SelectItem key={tab.value} value={tab.value}>
                                <div className="flex items-center gap-2">
                                  <tab.icon
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  {tab.label}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>
            {/* Main Content Area - Now takes up 2/3 of the width */}
            <div
              className="flex-1 flex flex-col overflow-hidden"
              style={{ height: "100%" }}
            >
              {filteredTabs.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 flex flex-col overflow-hidden m-0 p-0 data-[state=inactive]:hidden"
                  style={{ height: "100%" }}
                  id={`panel-${tab.value}`}
                  aria-labelledby={`tab-${tab.value}`}
                >
                  {tab.component}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
