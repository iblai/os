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
  CalendarClock,
  Clock,
  Grid,
  FlaskConical,
  GraduationCap,
  Key,
  MonitorSmartphone,
  FileWarning,
  UserCog,
  Archive,
  Container,
  Sparkles,
  ScrollText,
  Volume2,
  MonitorPlay,
  LineChart,
  type LucideIcon,
} from 'lucide-react';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import {
  useGetMentorSettingsQuery,
  useGetMemsearchStatusQuery,
  isBaseAgentMentor,
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
  isMemoryComponentEnabled: boolean;
  /** True when `enable_privacy_router` is on for this mentor. */
  isPrivacyEnabled: boolean;
  /**
   * True when the mentor's CallConfiguration has `enable_video` on — the
   * toggle that's surfaced in the Settings tab. Gates the standalone
   * Screen share top-level tab.
   */
  isScreenshareEnabled: boolean;
  /**
   * True when "Enable voice calls" (`show_voice_call`) is on in Settings.
   * Gates the standalone Voice top-level tab — turning voice calls off
   * removes the Voice tab from the sidebar entirely.
   */
  isVoiceCallEnabled: boolean;
  /**
   * True when the mentor resolves to the "base-agent" type (its own slug or
   * its template mentor's slug is one of the base-agent aliases) — the only
   * mentor type that supports Agent Skills. Gates the Skills tab. Fails OPEN
   * when the type cannot be determined (see `resolveIsBaseAgentMentor`).
   */
  isBaseAgent: boolean;
};

/**
 * Best-effort extraction of the template mentor's slug from the untyped
 * `template_mentor` field on the mentor-settings response. The backend
 * serializer types it as `any`; handle the plausible shapes (plain slug
 * string, nested object) and return undefined for anything else (e.g. a
 * numeric PK), which callers treat as "indeterminate".
 */
export function resolveTemplateMentorSlug(
  templateMentor: unknown,
): string | undefined {
  if (typeof templateMentor === 'string') return templateMentor || undefined;
  if (templateMentor && typeof templateMentor === 'object') {
    const record = templateMentor as Record<string, unknown>;
    for (const key of ['slug', 'mentor_slug', 'name', 'template_name']) {
      const value = record[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  return undefined;
}

/**
 * Whether the mentor should be treated as a Base Agent for gating purposes.
 *
 * Mirrors the backend `Mentor.get_mentor_type()` check via the SDK's
 * `isBaseAgentMentor` (own slug or template mentor slug ∈ base-agent
 * aliases), but fails OPEN — returns true — when the settings response
 * doesn't let us decide: mentor_slug missing (settings not loaded) or
 * `template_mentor` present in a shape we can't read a slug from (e.g. a
 * numeric PK). Hiding the Skills tab from a real base agent would silently
 * remove the feature, while showing it to a non-base agent only surfaces a
 * harmless read-only section — so indeterminate cases keep the tab.
 */
export function resolveIsBaseAgentMentor(
  mentorSettings:
    | { mentor_slug?: string | null; template_mentor?: unknown }
    | undefined,
): boolean {
  const mentorSlug = mentorSettings?.mentor_slug ?? undefined;
  const templateMentorRaw = mentorSettings?.template_mentor;
  const templateMentorSlug = resolveTemplateMentorSlug(templateMentorRaw);

  if (isBaseAgentMentor({ mentorSlug, templateMentorSlug })) return true;

  const slugIndeterminate = !mentorSlug;
  const templateIndeterminate =
    templateMentorRaw != null && !templateMentorSlug;
  return slugIndeterminate || templateIndeterminate;
}

/**
 * Visual grouping shared by the platform NavBar dropdown (3 columns / mobile
 * accordion) and the EditMentorModal sidebar (3 category tabs). Optional on
 * a segment so ad-hoc/hidden tabs can omit it and fall through to a default.
 */
export type MentorSegmentNavCategory =
  | 'configurations'
  | 'integrations'
  | 'runtime';

/**
 * Category order + display titles. Drives the left-to-right column order
 * in the nav-bar dropdown and the tab order in the EditMentorModal sidebar.
 */
export const MENTOR_SEGMENT_NAV_CATEGORIES: ReadonlyArray<{
  key: MentorSegmentNavCategory;
  /** English fallback — consumers should render `t(titleKey)` instead. */
  title: string;
  /** i18n key in the `header` messages namespace. */
  titleKey: string;
}> = [
  {
    key: 'configurations',
    title: 'Configurations',
    titleKey: 'configurations',
  },
  { key: 'integrations', title: 'Integrations', titleKey: 'integrations' },
  { key: 'runtime', title: 'Runtime', titleKey: 'runtime' },
];

export type MentorSegment = {
  /** Stable identifier — matches MODALS.EDIT_MENTOR.tabs.* for tab segments */
  value: string;
  /** English fallback — consumers should render `t(labelKey)` instead. */
  label: string;
  /** i18n key in the `header` messages namespace (same one header.tsx uses). */
  labelKey: string;
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
    labelKey: 'settings',
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
    labelKey: 'sandbox',
    icon: Container,
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible. The "Dedicated sandbox" (`enable_claw`) master toggle
    // now lives inline on the Sandbox tab itself; the tab is where admins turn
    // the capability on and connect it to an instance.
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.access,
    label: 'Access',
    labelKey: 'access',
    icon: UserCog,
    userTypes: [UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#read_shared_mentor`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.llm,
    label: 'LLM',
    labelKey: 'llm',
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
    labelKey: 'prompts',
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
    labelKey: 'skills',
    icon: Sparkles,
    userTypes: [UserType.ADMIN],
    // Admin-only for now — the userTypes filter alone gates visibility
    // (mirrors Tasks/Sandbox/Evals). Deliberately NO `rbacResource` until the
    // agent-skills RBAC contract is settled with the backend (the ActionDefs
    // register `/platforms/{db_pk}/…` paths the FE has no sanctioned pk
    // source for).
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Agent Skills only apply to Base Agent mentors — other agent types
    // (google-agent, openai-agent, n8n-workflow, …) never read the skills
    // directory, so the tab is hidden for them. The gate fails open when the
    // mentor type can't be determined (see `resolveIsBaseAgentMentor`).
    // Within base agents the tab is always reachable: skills only *run* when
    // a sandbox is wired, and the SDK's <AgentSkills/> renders a "connect a
    // sandbox" grayed state until then.
    enabledThroughConfig: (flags) => flags.isBaseAgent,
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.voice,
    label: 'Voice',
    labelKey: 'voice',
    icon: Volume2,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    // Backend doesn't yet expose voice_provider/openai_voice/google_voice in
    // mentorSettings.permissions.field, nor whitelist /mentors/{id}/#voice_settings.
    // Re-add `rbacResource` + `permissionFieldsCheck` once those land.
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible. The "Enable voice calls" (`show_voice_call`) master
    // toggle now lives inline at the top of the Voice tab; turning it off grays
    // out the voice/call configuration below instead of hiding the whole tab.
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.privacy,
    label: 'Privacy',
    labelKey: 'privacy',
    icon: ShieldCheck,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible. The "PII filtering" (`enable_privacy_router`) master
    // toggle now lives inline at the top of the Privacy tab; turning it off
    // grays out the PII rules below instead of hiding the whole tab.
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.safety,
    label: 'Safety',
    labelKey: 'safety',
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
    value: MODALS.EDIT_MENTOR.tabs.tasks,
    label: 'Tasks',
    labelKey: 'tasks',
    icon: CalendarClock,
    // Platform-admin-only until the backend exposes an RBAC resource for
    // periodic agents. No `rbacResource` set — the userTypes filter alone
    // gates visibility (mirroring Sandbox / Access).
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'runtime',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.disclaimer,
    label: 'Disclaimers',
    labelKey: 'disclaimers',
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
    value: MODALS.EDIT_MENTOR.tabs.screenshare,
    // Title is just "Screen" — the tab body's copy still talks about
    // "screen sharing" (SDK-owned descriptions).
    label: 'Screen',
    labelKey: 'screenShare',
    icon: MonitorPlay,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible. The "Enable screen sharing" (`enable_video`) master
    // toggle now lives inline at the top of the Screen tab; turning it
    // off grays out the screen-sharing prompts below instead of hiding the tab.
    navCategory: 'configurations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.tools,
    label: 'Tools',
    labelKey: 'tools',
    icon: Wrench,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) =>
      `/mentors/${mentorDbId}/tools/#list&/mentors/${mentorDbId}/#view_tools_menu`,
    permissionFieldsCheck: ['mentor_tools'],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.mcp,
    label: 'MCP',
    labelKey: 'mcp',
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
    labelKey: 'memory',
    icon: Archive,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/memory/#list`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible. The "Remember past conversations"
    // (`enable_memory_component`) master toggle now lives inline at the top of
    // the Memory tab; turning it off grays out the memory management below
    // instead of hiding the whole tab.
    navCategory: 'runtime',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.history,
    label: 'History',
    labelKey: 'history',
    icon: Clock,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#view_chat_history`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'runtime',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.audit_log,
    label: 'Audit',
    labelKey: 'audit',
    icon: ScrollText,
    userTypes: [UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#view_audit_logs`,
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    navCategory: 'runtime',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.datasets,
    label: 'Datasets',
    labelKey: 'datasets',
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
    value: MODALS.EDIT_MENTOR.tabs.evaluation,
    label: 'Evals',
    labelKey: 'evals',
    icon: FlaskConical,
    // Strictly admin-only, in BOTH the nav-bar dropdown and the Edit Agent
    // modal — the userTypes filter alone gates visibility (mirrors
    // Tasks/Sandbox). Deliberately NO `rbacResource`: `isUserTypeAllowed`
    // treats an RBAC grant as an alternative to the userTypes check, so any
    // resource listed here would let non-admins holding that grant see the
    // tab (an earlier copy-paste of the Datasets resource did exactly that).
    // Do not add one back without a dedicated evals RBAC action.
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS],
    // Without a navCategory the new categorized layout (modal sidebar +
    // nav-bar dropdown) silently drops this segment — both consumers skip
    // any segment lacking a category. Agent evaluation reports on run
    // performance, so it belongs in Runtime alongside History/Audit.
    navCategory: 'runtime',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.api,
    label: 'API',
    labelKey: 'api',
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
    value: MODALS.EDIT_MENTOR.tabs.lti,
    label: 'LTI',
    labelKey: 'lti',
    icon: GraduationCap,
    // Admin-only for now: LTI launch configuration is a platform-admin
    // concern and the backend doesn't yet expose an RBAC resource or a
    // permission field for it (mirrors Tasks). The userTypes filter alone
    // gates visibility — re-add `rbacResource` + `permissionFieldsCheck`
    // once those land.
    userTypes: [UserType.ADMIN],
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    // Always visible to admins — intentionally NOT gated on the "Enable LTI
    // launches" (`is_lti_accessible`) toggle. LTI access is turned on inline
    // when the first LTI link is created, so the tab must stay reachable even
    // while the setting is still off.
    navCategory: 'integrations',
  },
  {
    value: MODALS.EDIT_MENTOR.tabs.embed,
    label: 'Embed',
    labelKey: 'embed',
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
  {
    // Analytics "hub" tab. Unlike other tabs it doesn't render dashboards
    // inside the modal — its content lists the analytics destinations and,
    // on click, the host navigates to the full-page analytics view. In the
    // nav-bar dropdown the same value is special-cased to jump straight to
    // the analytics page (see nav-bar `handleSegmentClick`), so this segment
    // replaces the former ad-hoc `ANALYTICS_NAV_ITEM`.
    value: MODALS.EDIT_MENTOR.tabs.analytics,
    label: 'Analytics',
    labelKey: 'analytics',
    icon: LineChart,
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN],
    rbacResource: (mentorDbId) => `/mentors/${mentorDbId}/#view_analytics`,
    permissionFieldsCheck: [],
    mentorVisibility: [
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
    ],
    navCategory: 'runtime',
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

  // NOTE: no ClawMentorConfig fetch here. The Sandbox and Skills tabs stopped
  // gating on claw state (they're always reachable for their user types, with
  // any "connect a sandbox" messaging inline in the tab content), so fetching
  // `.../claw-config/` from this hook — which runs on every page for the
  // nav-bar — was a wasted request on every chat load. Surfaces that truly
  // need the config (Sandbox tab's SandboxConfig, Prompts tab) fetch it
  // themselves while mounted.

  const isMemoryComponentEnabled =
    // @ts-ignore - enable_memory_component exists on API but not typed
    mentorSettings?.enable_memory_component ?? false;
  const isPrivacyEnabled =
    // @ts-ignore - enable_privacy_router exists on API but not typed
    mentorSettings?.enable_privacy_router ?? false;

  // CallConfiguration is embedded directly in the mentor-settings response.
  // The host gates the Screen share tab on `enable_video` so it only shows
  // up after an admin flips the toggle in Settings.
  // @ts-ignore - call_configuration exists on API but not typed
  const isScreenshareEnabled: boolean =
    // @ts-ignore - call_configuration exists on API but not typed
    mentorSettings?.call_configuration?.enable_video ?? false;

  // The Voice tab is gated on "Enable voice calls". Default to true to match
  // the Settings form (`show_voice_call ?? true`) so a mentor that never
  // explicitly set the flag still surfaces the tab.
  const isVoiceCallEnabled: boolean =
    // @ts-ignore - show_voice_call exists on API but not typed
    mentorSettings?.show_voice_call ?? true;

  // Base-agent detection for the Skills tab. `template_mentor` is untyped on
  // the settings response, so resolution is best-effort and fails open.
  const isBaseAgent = resolveIsBaseAgentMentor(mentorSettings);

  const { isUserTypeAllowed, userType } = useUserType(mentorSettings);

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
        isPrivacyEnabled,
        isScreenshareEnabled,
        isVoiceCallEnabled,
        isBaseAgent,
      },
      isUserTypeAllowed: (segment) => isUserTypeAllowedRef.current(segment),
    }),
    [
      isAdmin,
      tenantKey,
      mentorSettings,
      rbacPermissions,
      userType,
      isMemsearchEnabled,
      isMemoryComponentEnabled,
      isPrivacyEnabled,
      isScreenshareEnabled,
      isVoiceCallEnabled,
      isBaseAgent,
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
