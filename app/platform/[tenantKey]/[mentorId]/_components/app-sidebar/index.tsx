'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { Globe2, LineChart, Workflow } from 'lucide-react';

import {
  PlatformAccountSheet,
  PlatformSidebar,
  useSidebar,
} from '@iblai/iblai-js/web-containers/next';
import type {
  PlatformAccountTab,
  PlatformSidebarFooterActionId,
  PlatformSidebarMenu,
  PlatformSidebarMenuItem,
  PlatformSidebarSectionConfig,
} from '@iblai/iblai-js/web-containers/next';

import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { chatActions, clearFiles } from '@iblai/iblai-js/web-utils';

import { useNavigate } from '@/hooks/user-navigate';
import {
  useUsername,
  useIsAdmin,
  useCurrentTenant,
  useUserIsStudent,
} from '@/hooks/use-user';
import { useUserType } from '@/hooks/use-user-type';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { isLoggedIn } from '@/lib/utils';
import { config } from '@/lib/config';
import { ANONYMOUS_USERNAME, UserType } from '@/lib/constants';
import { TenantKeyMentorIdParams, ProjectPageParams } from '@/lib/types';
import { getUserEmail } from '@/features/utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import Logo from '@/components/logo';

import { SidebarChatsSection } from './chats-section';
import { SidebarProjectsSection } from './projects-section';
import { redirectToLogin } from './redirect-to-login';

// Per-item permission specs that mirror the OLD `useSidebarNavigation`
// contentItems / footerItems contract (hooks/user-navigate.ts). Each is
// fed to `isUserTypeAllowed()` from `useUserType` — the live signal that
// re-evaluates on the User/Admin toggle in the nav-bar.
type PermissionSpec = {
  userTypes: UserType[];
  permissionFieldsCheck: string[];
  rbacResource?: (mentorDbId: number) => string;
};

const PERMISSION_GATES = {
  agentsNew: {
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
    rbacResource: (_: number) => '/mentors/#create',
    permissionFieldsCheck: [],
  },
  agentsMy: {
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
    permissionFieldsCheck: [],
  },
  agentsExplore: {
    userTypes: [
      UserType.STUDENT,
      UserType.FREE_TRIAL,
      UserType.ADMIN,
      UserType.ANONYMOUS,
      UserType.VISITING,
    ],
    permissionFieldsCheck: [],
  },
  workflows: {
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
    permissionFieldsCheck: [],
  },
  analytics: {
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
    rbacResource: (mentorDbId: number) =>
      `/mentors/${mentorDbId}/#view_analytics`,
    permissionFieldsCheck: [],
  },
  notifications: {
    userTypes: [UserType.STUDENT, UserType.FREE_TRIAL, UserType.ADMIN],
    permissionFieldsCheck: [],
  },
  invites: {
    userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
    permissionFieldsCheck: [],
  },
} satisfies Record<string, PermissionSpec>;

type SidebarOpenSection =
  | 'workflows'
  | 'chats'
  | 'projects'
  | 'agents'
  | 'analytics';

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const t = useTranslations('appSidebarIndex');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { projectId } = useParams<ProjectPageParams>();
  const username = useUsername();
  const embedMode = useEmbedMode();
  const isAdmin = useIsAdmin();
  // `userIsStudent` is the LIVE inverse-admin signal — reacts to the
  // User/Admin toggle in the nav-bar (backed by the Redux user slice).
  // `isAdmin` alone reads `currentTenant.is_admin` from localStorage and
  // does NOT re-evaluate on toggle, so the admin-only sidebar items
  // gate on `!userIsStudent` (i.e. "admin and currently in admin mode").
  const userIsStudent = useUserIsStudent();
  const isLiveAdmin = isAdmin && !userIsStudent;
  const { currentTenant } = useCurrentTenant();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const userEmail = getUserEmail();

  // The same per-item permission predicate the OLD sidebar used —
  // composes userType (live), RBAC, and per-mentor permission fields.
  // We pass `mentorPublicSettings` so `rbacResource(mentor_id)` resolves
  // to a real id (analytics / new-chat checks use it).
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore — userId is required at the URL path level
      userId: username ?? ANONYMOUS_USERNAME,
    },
    { skip: !mentorId || !tenantKey },
  );
  const { isUserTypeAllowed } = useUserType(mentorPublicSettings);

  const hideSidebarRaw = searchParams.get('hide-sidebar');
  const hideSidebar = hideSidebarRaw === '1' || hideSidebarRaw === 'true';

  const [accountDialogTab, setAccountDialogTab] =
    React.useState<PlatformAccountTab | null>(null);

  const {
    openCreateMentorModal,
    openInviteUserModal,
    openSettingsModal,
    openNoMentorSelectedModal,
    navigateToHome,
    navigateToExplore,
    navigateToWorkflows,
    navigateToNotifications,
  } = useNavigate();

  const {
    executeWithTrialCheck,
    FreeTrialDialog,
    closeModal,
    isModalOpen,
    isNewlyUserOnPreFreeOrAdvertisingMode,
  } = useShowFreeTrialDialog();

  // A non-admin user in the MAIN tenant OR an ADVERTISING tenant should
  // see the FULL admin sidebar — agents, workflows, analytics, and every
  // footer action — but each entry routes to the free-trial upgrade dialog
  // (Stripe) instead of the real action. We mirror the trial gate's OWN
  // predicate (`isNewlyUserOnPreFreeOrAdvertisingMode`, which already
  // requires stripe-activated + non-admin + main-OR-advertising tenant)
  // 1:1, so an item is only ever shown when clicking it will actually pop
  // the dialog — the handlers all wrap their work in `executeWithTrialCheck`.
  // When the gate wouldn't fire we fall back to the OLD `isLiveAdmin`
  // hiding, so a real admin action never leaks to a student, and non-admins
  // in ordinary (non-main, non-advertising) tenants stay hidden as before.
  const showTrialGatedAdminMenu = !!isNewlyUserOnPreFreeOrAdvertisingMode(true);

  // "Student Mentor Creation" (Advanced tenant settings →
  // `allow_students_to_create_mentors`) adds the tenant's students group
  // to the mentor-creators RBAC policy, i.e. it grants `/mentors/#create`.
  // Honor that here so a GENUINE non-admin (`is_admin === false`) in such
  // a tenant sees New Agent / My Agents and can actually create + manage
  // mentors. We require `!isAdmin` so an admin toggled into learner mode —
  // who holds the permission via their admin role — stays excluded, which
  // keeps the `isLiveAdmin` learner-mode fix below intact.
  // `checkRbacPermission` already factors in `config.enableRBAC()`, so
  // this is inert when RBAC is disabled. (`/mentors/#create` mirrors
  // `PERMISSION_GATES.agentsNew.rbacResource`.)
  const studentCanCreateMentors =
    !isAdmin && checkRbacPermission(rbacPermissions, '/mentors/#create');

  // Original behavior: a NOT-logged-in (anonymous) user SEES the admin
  // sidebar items in every tenant; clicking any of them routes to the auth
  // SPA login (handled by `runAdminAction`). Mirrors the old sidebar where
  // `isUserTypeAllowed` admitted the ANONYMOUS user type and admin actions
  // were wrapped in AuthPopover. Embed mode still hides everything (its own
  // `!embedMode` gates short-circuit first), so this only affects the normal
  // sidebar.
  const showAnonymousAdminMenu = !isLoggedIn();

  const { isMobile, setOpenMobile } = useSidebar();

  const isChatPage =
    (pathname && /\/platform\/[^/]+\/[^/]+$/.test(pathname)) || !!projectId;

  const onAfterNav = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  const [openNavSection, setOpenNavSection] =
    React.useState<SidebarOpenSection | null>(null);

  React.useEffect(() => {
    if (pathname?.includes('/analytics')) {
      setOpenNavSection('analytics');
    }
  }, [pathname]);

  const startNewChat = React.useCallback(() => {
    dispatch(clearFiles(undefined));
    if (!mentorId) {
      openNoMentorSelectedModal();
    } else if (isChatPage) {
      eventBus.emit(RemoteEvents.newChat);
      dispatch(chatActions.setShouldStartNewChat(true));
    } else {
      navigateToHome();
      dispatch(chatActions.setShouldStartNewChat(true));
    }
    onAfterNav();
  }, [
    dispatch,
    mentorId,
    isChatPage,
    openNoMentorSelectedModal,
    navigateToHome,
    onAfterNav,
  ]);

  // Mirrors the ORIGINAL `AuthPopover` affordance: a NOT-logged-in user can
  // only reach these admin actions via the trial-gated menu in a main/
  // advertising tenant — for them, prompt LOGIN (instead of the trial /
  // upgrade dialog they can't act on without an account), matching the old
  // sidebar's anonymous "click → log in" behavior. Logged-in users keep the
  // existing trial-check behavior unchanged. Returns the trial-check result
  // (or null when we redirect) so href-driven rows can swallow navigation.
  const runAdminAction = React.useCallback(
    (action: () => void): unknown => {
      if (!isLoggedIn()) {
        redirectToLogin(tenantKey);
        return null;
      }
      return executeWithTrialCheck(action);
    },
    [executeWithTrialCheck, tenantKey],
  );

  const handleAgentMenuSelect = React.useCallback(
    (itemId: string): boolean | void => {
      if (itemId === 'agents-new') {
        runAdminAction(() => openCreateMentorModal());
        onAfterNav();
        return;
      }
      if (itemId === 'agents-my') {
        runAdminAction(() => openSettingsModal());
        onAfterNav();
        return;
      }
      if (itemId === 'agents-explore') {
        navigateToExplore();
        onAfterNav();
        return;
      }
    },
    [
      runAdminAction,
      openCreateMentorModal,
      openSettingsModal,
      navigateToExplore,
      onAfterNav,
    ],
  );

  const handleWorkflowMenuSelect = React.useCallback(
    (itemId: string): boolean | void => {
      if (itemId === 'workflows-create' || itemId === 'workflows-my') {
        if (!mentorId) {
          openNoMentorSelectedModal();
          return;
        }
        runAdminAction(() => navigateToWorkflows());
        onAfterNav();
        return;
      }
    },
    [
      mentorId,
      runAdminAction,
      navigateToWorkflows,
      openNoMentorSelectedModal,
      onAfterNav,
    ],
  );

  const analyticsBasePath = React.useMemo(() => {
    if (!tenantKey) return null;
    return mentorId
      ? `/platform/${tenantKey}/${mentorId}/analytics`
      : `/platform/${tenantKey}/analytics`;
  }, [tenantKey, mentorId]);

  const analyticsMenu = React.useMemo<PlatformSidebarMenu>(() => {
    const base = analyticsBasePath ?? '/analytics';
    return {
      id: 'analytics',
      label: t('analytics'),
      icon: LineChart,
      items: [
        {
          id: 'analytics-overview',
          label: t('analyticsOverview'),
          href: base,
          exact: true,
        },
        {
          id: 'analytics-users',
          label: t('analyticsUsers'),
          href: `${base}/users`,
        },
        {
          id: 'analytics-topics',
          label: t('analyticsTopics'),
          href: `${base}/topics`,
        },
        {
          id: 'analytics-transcripts',
          label: t('analyticsTranscripts'),
          href: `${base}/transcripts`,
        },
        {
          id: 'analytics-costs',
          label: t('analyticsCosts'),
          href: `${base}/financial`,
        },
        {
          id: 'analytics-audit',
          label: t('analyticsAudit'),
          href: `${base}/audit`,
        },
        {
          id: 'analytics-reports',
          label: t('analyticsDataReports'),
          href: `${base}/reports`,
        },
      ],
    };
  }, [analyticsBasePath]);

  const handleAnalyticsMenuSelect = React.useCallback(
    (_itemId: string): boolean | void => {
      // Items carry their own `href`; the row navigates on its own when
      // we return `undefined`. The trial gate runs first and returns
      // `null` when it has blocked the action — in that case we return
      // `false` so the SDK's sub-nav item swallows the nav and the
      // trial modal opens instead.
      const result = runAdminAction(() => {});
      if (result === null) return false;
      onAfterNav();
    },
    [runAdminAction, onAfterNav],
  );

  // Filter per-item visibility — admin-only items combine `isLiveAdmin`
  // (live signal from the User/Admin nav-bar toggle) AND the OLD
  // `isUserTypeAllowed` predicate so RBAC still narrows admin users.
  //
  // The reason we gate on `isLiveAdmin` is that `isUserTypeAllowed` has
  // an OR-fallback: if RBAC is enabled and the user happens to hold the
  // resource permission, it returns true even when their CURRENT user
  // type is STUDENT (i.e. an admin in learner mode). Without the
  // `isLiveAdmin` guard, "New Agent" / "My Agents" / Analytics would
  // stay visible after toggling into learner mode — which is the bug
  // the user called out.
  const agentsMenu: PlatformSidebarMenu = React.useMemo(() => {
    const items: PlatformSidebarMenuItem[] = [];
    // Embed mode shows a minimal sidebar (New Chat + chat history only),
    // mirroring the pre-rewrite behavior — no Agents section at all.
    if (embedMode)
      return { id: 'agents', label: t('agents'), icon: Globe2, items };
    // New Agent / My Agents are shown when ANY of:
    //  - `showTrialGatedAdminMenu`: main-tenant non-admins (trial-gated
    //    on click),
    //  - `studentCanCreateMentors`: genuine students in a tenant where
    //    "Student Mentor Creation" is enabled (real create flow on click),
    //  - `showAnonymousAdminMenu`: anonymous users (click → auth SPA login),
    //  - the OLD live-admin + RBAC gate (real admins).
    if (
      showTrialGatedAdminMenu ||
      studentCanCreateMentors ||
      showAnonymousAdminMenu ||
      (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.agentsNew))
    )
      items.push({ id: 'agents-new', label: t('newAgent') });
    if (
      showTrialGatedAdminMenu ||
      studentCanCreateMentors ||
      showAnonymousAdminMenu ||
      (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.agentsMy))
    )
      items.push({ id: 'agents-my', label: t('myAgents') });
    // Explore is open to STUDENT/VISITING too, so it doesn't need the
    // live-admin guard — `isUserTypeAllowed` is sufficient.
    if (isUserTypeAllowed(PERMISSION_GATES.agentsExplore))
      items.push({ id: 'agents-explore', label: t('explore') });
    return { id: 'agents', label: t('agents'), icon: Globe2, items };
  }, [
    embedMode,
    isLiveAdmin,
    isUserTypeAllowed,
    showTrialGatedAdminMenu,
    studentCanCreateMentors,
    showAnonymousAdminMenu,
  ]);

  const workflowsMenu: PlatformSidebarMenu = React.useMemo(() => {
    // Hidden entirely in embed mode (minimal sidebar).
    const allowed =
      !embedMode &&
      (showTrialGatedAdminMenu ||
        showAnonymousAdminMenu ||
        (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.workflows)));
    return {
      id: 'workflows',
      label: t('workflows'),
      icon: Workflow,
      items: allowed
        ? [
            { id: 'workflows-create', label: t('newWorkflow') },
            { id: 'workflows-my', label: t('myWorkflows') },
          ]
        : [],
    };
  }, [
    embedMode,
    isLiveAdmin,
    isUserTypeAllowed,
    showTrialGatedAdminMenu,
    showAnonymousAdminMenu,
  ]);

  // When "Student Mentor Creation" is on, a student also gets Analytics —
  // but ONLY for the mentor currently opened, and only when that mentor is
  // theirs (`created_by === username`) OR they hold the per-mentor
  // `/mentors/{id}/#view_analytics` permission (the RBAC branch of
  // `isUserTypeAllowed`). With no mentor open, or someone else's mentor and
  // no permission, Analytics stays hidden exactly as before.
  const studentOwnsOpenedMentor =
    !!username && !!mentorId && mentorPublicSettings?.created_by === username;
  const studentCanViewOpenedMentorAnalytics =
    studentCanCreateMentors &&
    (studentOwnsOpenedMentor || isUserTypeAllowed(PERMISSION_GATES.analytics));

  // A genuine non-admin who holds the per-mentor `/mentors/{id}/#view_analytics`
  // RBAC permission can see Analytics — restoring the ORIGINAL behavior, where
  // the sidebar/footer gated Analytics on `isUserTypeAllowed` ALONE (which
  // includes the view_analytics RBAC check) with no admin requirement. We gate
  // on `!isAdmin` so an admin-in-learner-mode stays excluded (preserving the
  // `isLiveAdmin` learner-mode guard); for a non-admin, `isUserTypeAllowed`
  // returns true here only via the RBAC view_analytics check, since STUDENT is
  // not in the analytics `userTypes`.
  const nonAdminCanViewAnalytics =
    !isAdmin && isUserTypeAllowed(PERMISSION_GATES.analytics);

  const analyticsAllowed =
    !embedMode &&
    config.hideAnalytics() !== 'true' &&
    (showTrialGatedAdminMenu ||
      showAnonymousAdminMenu ||
      studentCanViewOpenedMentorAnalytics ||
      nonAdminCanViewAnalytics ||
      (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.analytics)));

  // Projects are part of the full sidebar and hidden in embed mode. Shown
  // to logged-in users (who have projects) AND to anonymous users — for
  // anonymous, "New Project" routes to the auth SPA login (mirrors the
  // original ProjectsSidebarDropdown's AuthPopover affordance).
  const projectsAllowed = !embedMode && (!!username || showAnonymousAdminMenu);

  // In embed mode the Chats history (and its divider) is only shown to a
  // logged-in user — anonymous embed viewers get just the New Chat button.
  // We key on `isLoggedIn()` (the axd_token) — the canonical "logged in"
  // signal the rest of the sidebar uses — NOT `username` (user_nicename),
  // which is a separate localStorage key that can diverge. Outside embed
  // mode the Chats section is always available, as before.
  const showChats = !embedMode || isLoggedIn();

  // New Chat mirrors the ORIGINAL `/mentors/{mentor_id}/#chat` gate: an
  // anonymous user bypasses RBAC (shown); a logged-in user must hold chat
  // permission on the opened mentor. No-op when not logged in, when no
  // mentor is open, or when RBAC is disabled (`checkRbacPermission` already
  // factors `config.enableRBAC()`).
  const newChatAllowed =
    !isLoggedIn() ||
    !mentorId ||
    checkRbacPermission(
      rbacPermissions,
      `/mentors/${mentorPublicSettings?.mentor_id}/#chat`,
    );

  const openAccountTab = React.useCallback(
    (tab: PlatformAccountTab) => {
      const result = runAdminAction(() => {
        setAccountDialogTab(tab);
      });
      if (result !== null) onAfterNav();
    },
    [runAdminAction, onAfterNav],
  );

  const handleFooterAction = React.useCallback(
    (actionId: PlatformSidebarFooterActionId) => {
      switch (actionId) {
        case 'notifications':
          navigateToNotifications();
          onAfterNav();
          return;
        case 'invites':
          runAdminAction(() => openInviteUserModal());
          onAfterNav();
          return;
        case 'management':
          openAccountTab('management');
          return;
        case 'integrations':
          openAccountTab('integrations');
          return;
        case 'monetization':
          openAccountTab('monetization');
          return;
        case 'advanced':
          openAccountTab('advanced');
          return;
      }
    },
    [
      runAdminAction,
      navigateToNotifications,
      openAccountTab,
      openInviteUserModal,
      onAfterNav,
    ],
  );

  // The VARIABLE part of the sidebar (per-SPA): declarative menus for
  // Agents / Workflows / Analytics, plus fully custom sections for the
  // data-driven Chats and Projects lists. The SDK shell renders them in
  // order and drives the accordion + rail-flyout behavior through the
  // section context.
  const sections = React.useMemo<PlatformSidebarSectionConfig[]>(() => {
    const list: PlatformSidebarSectionConfig[] = [
      { type: 'menu', menu: agentsMenu, onItemSelect: handleAgentMenuSelect },
      {
        type: 'menu',
        menu: workflowsMenu,
        onItemSelect: handleWorkflowMenuSelect,
      },
    ];
    if (showChats) {
      list.push({ type: 'divider', id: 'chats-divider' });
      list.push({
        type: 'custom',
        id: 'chats',
        render: (ctx) => (
          <SidebarChatsSection
            collapsed={ctx.collapsed}
            open={ctx.open}
            onOpenChange={ctx.onOpenChange}
            onCollapsedIconClick={ctx.expandFromRail}
            tenantKey={tenantKey}
            mentorId={mentorId}
            username={username}
          />
        ),
      });
    }
    if (projectsAllowed) {
      list.push({
        type: 'custom',
        id: 'projects',
        render: (ctx) => (
          <SidebarProjectsSection
            collapsed={ctx.collapsed}
            tenantKey={tenantKey}
            username={username}
            open={ctx.open}
            onOpenChange={ctx.onOpenChange}
            onNavigate={ctx.onAfterNav}
            onCollapsedIconClick={ctx.expandFromRail}
          />
        ),
      });
    }
    if (analyticsAllowed) {
      list.push({
        type: 'menu',
        menu: analyticsMenu,
        onItemSelect: handleAnalyticsMenuSelect,
      });
    }
    return list;
  }, [
    agentsMenu,
    workflowsMenu,
    analyticsMenu,
    handleAgentMenuSelect,
    handleWorkflowMenuSelect,
    handleAnalyticsMenuSelect,
    showChats,
    projectsAllowed,
    analyticsAllowed,
    tenantKey,
    mentorId,
    username,
  ]);

  if (hideSidebar) {
    return <></>;
  }

  return (
    <>
      <PlatformSidebar
        logo={
          <Logo className="h-[51px] max-h-none w-auto max-w-full object-contain" />
        }
        primaryAction={
          newChatAllowed ? { label: t('newChat'), onClick: startNewChat } : null
        }
        sections={sections}
        openSectionId={openNavSection}
        onOpenSectionChange={(id) =>
          setOpenNavSection(id as SidebarOpenSection | null)
        }
        // Footer — the INVARIANT cluster. Hidden entirely in embed mode
        // (minimal sidebar: only New Chat + chat history, matching the
        // pre-rewrite UI). Visibility rules live in the SDK; we feed it
        // the primitive signals it needs.
        footer={
          embedMode
            ? null
            : {
                isAdmin,
                isLiveAdmin,
                showTrialGatedAdminMenu,
                showAnonymousAdminMenu,
                enableRbac: config.enableRBAC(),
                rbacPermissions,
                tenantKey,
                currentTenant,
                notificationsAllowed: isUserTypeAllowed(
                  PERMISSION_GATES.notifications,
                ),
                invitesUserTypeAllowed: isUserTypeAllowed(
                  PERMISSION_GATES.invites,
                ),
                onAction: handleFooterAction,
              }
        }
      />

      <PlatformAccountSheet
        tab={accountDialogTab}
        onClose={() => setAccountDialogTab(null)}
        tenantKey={tenantKey}
        username={username ?? ''}
        email={userEmail}
        onInviteClick={() => {
          // Don't close the Users popup. The SDK's InviteUserDialog
          // renders via its own Radix Portal, so it layers on top; when
          // the user closes it, the Users popup is still visible — a
          // single continuous experience instead of one popup closing
          // before another opens.
          openInviteUserModal();
        }}
        mainPlatformKey={config.mainTenantKey()}
        authUrl={config.authUrl()}
        currentSpa={config.iblPlatform() || 'mentor'}
        platformBaseDomain={config.platformBaseDomain()}
      />

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
      )}
    </>
  );
}
