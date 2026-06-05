'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Settings,
  Brain,
  Terminal,
  Plug,
  Wrench,
  Shield,
  ShieldCheck,
  Clock,
  Grid,
  Key,
  MonitorSmartphone,
  FileWarning,
  UserCog,
  Archive,
  Container,
  Sparkles,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import {
  useGetMentorSettingsQuery,
  useGetMemsearchStatusQuery,
  useGetClawMentorConfigQuery,
} from '@iblai/iblai-js/data-layer';

import { MODALS, UserType } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { rbacPermissionToDisplay } from '@/hoc/utils';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { useUserType } from '@/hooks/use-user-type';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';

/**
 * Config-derived flags that can gate the visibility of a mentor segment.
 * Add a new flag here when introducing another config-gated segment, then
 * set `enabledThroughConfig` on the segment to read it. No filter logic
 * changes are required.
 */
export type MentorSegmentConfigFlags = {
  isMemsearchEnabled: boolean;
  isClawEnabled: boolean;
  /** True when a ClawMentorConfig exists for this mentor (sandbox wired to an instance). */
  clawConfigExists: boolean;
  isMemoryComponentEnabled: boolean;
};

/**
 * Visual grouping shared by the platform NavBar dropdown (3 columns / mobile
 * accordion) and the EditMentorModal sidebar (3 category tabs). Optional on
 * a segment so ad-hoc/hidden tabs can omit it and fall through to a default.
 */
export type MentorSegmentNavCategory =
  | 'configurations'
  | 'integrations'
  | 'analytics';

/**
 * Category order + display titles. Drives the left-to-right column order
 * in the nav-bar dropdown and the tab order in the EditMentorModal sidebar.
 */
export const MENTOR_SEGMENT_NAV_CATEGORIES: ReadonlyArray<{
  key: MentorSegmentNavCategory;
  title: string;
}> = [
  { key: 'configurations', title: 'Configurations' },
  { key: 'integrations', title: 'Integrations' },
  { key: 'analytics', title: 'Analytics' },
];

export type MentorSegment = {
  /** Stable identifier — matches MODALS.EDIT_MENTOR.tabs.* for tab segments */
  value: string;
  label: string;
  icon: LucideIcon;
  userTypes: UserType[];
  rbacResource?: (mentorDbId: number) => string;
  permissionFieldsCheck: string[];
  mentorVisibility: MentorVisibilityEnum[];
  /**
   * Optional config gate. Receives the merged config flags object and must
   * return true for the segment to remain visible. Omit (or return true)
   * to leave the segment always config-enabled.
   */
  enabledThroughConfig?: (flags: MentorSegmentConfigFlags) => boolean;
  /** Which NavBar dropdown column / modal sidebar tab this segment lives in. */
  navCategory?: MentorSegmentNavCategory;
};

/**
 * Single source-of-truth list of mentor segments. These render as tabs in
 * the EditMentorModal sidebar AND as menu items in the platform NavBar
 * dropdown. Order here is the order they appear in both consumers.
 */
export const MENTOR_SEGMENTS: MentorSegment[] = [
  {
    value: MODALS.EDIT_MENTOR.tabs.settings,
    label: 'Settings',
    icon: Settings,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#show_settings`,
    permissionFieldsCheck: [
      'mentor_name',
      'mentor_description',
      'profile_image',
      'mentor_visibility',
      'metadata',
      'allow_anonymous',
      'is_lti_accessible',
      'show_attachment',
      'show_voice_call',
      'show_voice_record',
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.sandbox,
    label: 'Sandbox',
    icon: Container,
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    enabledThroughConfig: (flags) => flags.isClawEnabled,
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.access,
    label: 'Access',
    icon: UserCog,
    userTypes: [UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#read_shared_mentor`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.llm,
    label: 'LLM',
    icon: Brain,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/llms/#list`,
    permissionFieldsCheck: ['llm_provider'],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.prompts,
    label: 'Prompts',
    icon: Terminal,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) =>
      `/mentors/${mentorDbId}/prompts/#list&/mentors/${mentorDbId}/#view_prompts_menu`,
    permissionFieldsCheck: [
      'system_prompt',
      'proactive_prompt',
      'guided_prompt_instructions',
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.skills,
    label: 'Skills',
    icon: Sparkles,
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Skills only makes sense when a sandbox is wired to a Claw instance.
    // Sandbox tab itself is shown earlier so admins can connect first.
    enabledThroughConfig: (flags) =>
      flags.isClawEnabled && flags.clawConfigExists,
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.safety,
    label: 'Safety',
    icon: Shield,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) =>
      `/mentors/${mentorDbId}/#view_moderation_logs`,
    permissionFieldsCheck: [
      'moderation_system_prompt',
      'safety_system_prompt',
      'moderation_response',
      'safety_response',
    ],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.privacy,
    label: 'Privacy',
    icon: ShieldCheck,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.disclaimer,
    label: 'Disclaimers',
    icon: FileWarning,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) =>
      `/mentors/${mentorDbId}/#view_disclaimers&/mentors/${mentorDbId}/#view_disclaimers_menu`,
    permissionFieldsCheck: ['disclaimer'],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.tools,
    label: 'Tools',
    icon: Wrench,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) =>
      `/mentors/${mentorDbId}/tools/#list&/mentors/${mentorDbId}/#view_tools_menu`,
    permissionFieldsCheck: ['mentor_tools'],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.mcp,
    label: 'MCP',
    icon: Plug,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/mcpservers/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.memory,
    label: 'Memory',
    icon: Archive,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/memory/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    enabledThroughConfig: (flags) =>
      flags.isMemsearchEnabled && flags.isMemoryComponentEnabled,
    navCategory: 'analytics',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.history,
    label: 'History',
    icon: Clock,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#view_chat_history`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'analytics',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.audit_log,
    label: 'Audit',
    icon: ScrollText,
    userTypes: [UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#view_audit_logs`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    navCategory: 'analytics',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.datasets,
    label: 'Datasets',
    icon: Grid,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/documents/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.api,
    label: 'API',
    icon: Key,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: () => '/apitokens/#list',
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.embed,
    label: 'Embed',
    icon: MonitorSmartphone,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#can_use_embed`,
    permissionFieldsCheck: ['custom_css', 'allow_anonymous'],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'integrations',
  },
];

export type MentorSegmentFilterContext = {
  isAdmin: boolean;
  tenantKey: string | undefined;
  // Mentor settings shape comes from the data layer with no exported type;
  // the filter only reads a few fields off it.
  mentorSettings: any;
  // Shape comes from `selectRbacPermissions`; only `checkRbacPermission`
  // inspects it and it accepts a generic object.
  rbacPermissions: object;
  flags: MentorSegmentConfigFlags;
  isUserTypeAllowed: (segment: MentorSegment) => boolean;
};

/**
 * Pure filter pipeline. Exported so that ad-hoc items (e.g. the nav-bar's
 * Analytics entry) can reuse the same rules without going through the hook.
 */
export function filterMentorSegments<T extends MentorSegment>(
  segments: T[],
  ctx: MentorSegmentFilterContext,
): T[] {
  const mainTenantKey = config.mainTenantKey();

  return segments
    .filter((segment) => segment.enabledThroughConfig?.(ctx.flags) ?? true)
    .filter((segment) => ctx.isUserTypeAllowed(segment))
    .filter((segment) => {
      const isAdminOnMainTenant =
        ctx.isAdmin && ctx.tenantKey === mainTenantKey;
      const mentorNotOnMainTenant =
        ctx.mentorSettings?.platform_key !== mainTenantKey;
      const visibilityMatches = segment.mentorVisibility.includes(
        ctx.mentorSettings?.mentor_visibility as MentorVisibilityEnum,
      );
      const isNonAdminOnMainTenant =
        !ctx.isAdmin && ctx.tenantKey === mainTenantKey;
      const visibilityAllowed = visibilityMatches && !isNonAdminOnMainTenant;

      return isAdminOnMainTenant || mentorNotOnMainTenant || visibilityAllowed;
    })
    .filter((segment) => {
      const hasFieldPermission = rbacPermissionToDisplay(
        segment.permissionFieldsCheck,
        ctx.mentorSettings?.permissions?.field,
      );
      const hasRbacPermission =
        !segment.rbacResource ||
        (!!ctx.mentorSettings &&
          checkRbacPermission(
            ctx.rbacPermissions,
            segment.rbacResource(ctx.mentorSettings.mentor_id),
          ));
      return hasFieldPermission && hasRbacPermission;
    });
}

export type UseMentorSegmentsOptions = {
  /**
   * When true, the hook resolves the mentor id from the open modal stack
   * (via `useNavigate().getMentorId()`) before falling back to the URL.
   * EditMentorModal sets this so that opening the modal for a different
   * mentor shows that mentor's tabs. The platform NavBar leaves it false
   * so its dropdown always reflects the page mentor regardless of which
   * mentor is currently being edited in a modal.
   * @default false
   */
  preferModalMentorId?: boolean;
};

/**
 * Hook that resolves and filters the canonical mentor segment list. Used by
 * EditMentorModal (to render its tabs) and the platform NavBar (to render
 * its dropdown). Both consumers receive the same filtered list, ensuring
 * the modal and the nav-bar can never disagree about which segments a user
 * is allowed to see.
 *
 * `isSegmentVisible` exposes the same filter pipeline for one-off items
 * (e.g. nav-bar Analytics) that aren't part of MENTOR_SEGMENTS but should
 * obey the same RBAC + visibility + user-type rules.
 */
export function useMentorSegments(options: UseMentorSegmentsOptions = {}) {
  const { preferModalMentorId = false } = options;
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const isAdmin = useIsAdmin();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { getMentorId } = useNavigate();

  const resolvedMentorId = preferModalMentorId
    ? getMentorId() || mentorId
    : mentorId;

  const { data: mentorSettings, isSuccess } = useGetMentorSettingsQuery(
    {
      mentor: resolvedMentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the useGetMentorSettingsQuery query definition
      userId: username ?? '',
    },
    {
      skip: !resolvedMentorId || !tenantKey || !username,
    },
  );

  const { data: memsearchConfig } = useGetMemsearchStatusQuery(
    {
      org: tenantKey,
      userId: username ?? '',
    },
    {
      skip: !tenantKey || !username,
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    },
  );

  const isMemsearchEnabled = memsearchConfig?.enable_memsearch ?? false;
  // @ts-expect-error enable_claw is not yet in the MentorSettingsPublic type
  const isClawEnabled: boolean = mentorSettings?.enable_claw ?? false;

  // The claw-config endpoint is keyed by the mentor's UUID. Use the value from
  // mentor settings; fall back to the resolved id (which may already be a UUID
  // when navigating directly).
  const mentorUuid: string | undefined =
    mentorSettings?.mentor_unique_id ?? resolvedMentorId;

  // The data-layer normalises 404 → null, so a non-null result means the
  // mentor has a wired ClawMentorConfig (sandbox connected to an instance).
  // Skip the query until we know claw is enabled — there's no point fetching
  // the config when we'd never gate on it.
  const { data: clawMentorConfig } = useGetClawMentorConfigQuery(
    { org: tenantKey!, mentorUniqueId: mentorUuid! },
    { skip: !isClawEnabled || !tenantKey || !mentorUuid },
  );
  const clawConfigExists = !!clawMentorConfig;

  const isMemoryComponentEnabled =
    // @ts-ignore - enable_memory_component exists on API but not typed
    mentorSettings?.enable_memory_component ?? false;
  const { isUserTypeAllowed } = useUserType(mentorSettings);

  // `isUserTypeAllowed` is a fresh function on every render of `useUserType`.
  // Stash it in a ref so we always read the latest version inside memos
  // without invalidating them on every parent render.
  const isUserTypeAllowedRef = useRef(isUserTypeAllowed);
  isUserTypeAllowedRef.current = isUserTypeAllowed;

  const filterContext = useMemo<MentorSegmentFilterContext>(
    () => ({
      isAdmin,
      tenantKey,
      mentorSettings,
      rbacPermissions,
      flags: {
        isMemsearchEnabled,
        isMemoryComponentEnabled,
        isClawEnabled,
        clawConfigExists,
      },
      isUserTypeAllowed: (segment) => isUserTypeAllowedRef.current(segment),
    }),
    [
      isAdmin,
      tenantKey,
      mentorSettings,
      rbacPermissions,
      isMemsearchEnabled,
      isClawEnabled,
      clawConfigExists,
      isMemoryComponentEnabled,
    ],
  );

  const filteredSegments = useMemo(
    () => filterMentorSegments(MENTOR_SEGMENTS, filterContext),
    [filterContext],
  );

  const isSegmentVisible = useCallback(
    (segment: MentorSegment) =>
      filterMentorSegments([segment], filterContext).length > 0,
    [filterContext],
  );

  return {
    /** Unfiltered source-of-truth list (rarely needed). */
    segments: MENTOR_SEGMENTS,
    /** The filtered list ready for both the modal and the nav-bar. */
    filteredSegments,
    /** Predicate that runs the same filter pipeline against an ad-hoc segment. */
    isSegmentVisible,
    /** Loaded mentor settings (consumers may want to react to it). */
    mentorSettings,
    /** True until the mentor settings query has succeeded. */
    isLoading: !isSuccess,
  };
}
