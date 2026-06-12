'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner';
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Coins,
  Download,
  Folder,
  FolderPlus,
  KeyRound,
  LineChart,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Settings,
  SquarePen,
  Trash2,
  Users,
  Workflow,
  Globe2,
} from 'lucide-react';
import { exportMessagesToXlsx } from './export-messages';

import { Sidebar, useSidebar } from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  chatApiSlice,
  useAddPinnedMessageMutation,
  useDeleteMessageMutation,
  useGetMentorPublicSettingsQuery,
  useGetPinnedMessagesQuery,
  useGetRecentMessageQuery,
  useGetUserProjectsQuery,
  useUnPinMessageMutation,
} from '@iblai/iblai-js/data-layer';
import {
  chatActions,
  clearFiles,
  selectSessionId,
} from '@iblai/iblai-js/web-utils';
import {
  Admin,
  IntegrationsTab,
  BillingTab,
  MonetizationTab,
  AdvancedTab,
} from '@iblai/iblai-js/web-containers';

import { useNavigate } from '@/hooks/user-navigate';
import {
  useUsername,
  useIsAdmin,
  useCurrentTenant,
  useUserIsStudent,
} from '@/hooks/use-user';
import { useUserType } from '@/hooks/use-user-type';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import {
  cn,
  getCurrentArtifactTitle,
  getFirstMessageWithContent,
  isLoggedIn,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
} from '@/lib/utils';
import { config } from '@/lib/config';
import { useLocalStorage } from '@/hooks/use-local-storage';
import {
  ANONYMOUS_USERNAME,
  LOCAL_STORAGE_KEYS,
  UserType,
} from '@/lib/constants';
import { TenantKeyMentorIdParams, ProjectPageParams } from '@/lib/types';
import { getUserEmail, getUserName } from '@/features/utils';
import Markdown from '@/components/markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import Logo from '@/components/logo';

const CreateProjectModal = dynamic(
  () =>
    import('@/components/projects/create-project-modal').then(
      (mod) => mod.CreateProjectModal,
    ),
  { ssr: false },
);

const RenameProjectModal = dynamic(
  () =>
    import('@/components/projects/rename-project-modal').then(
      (mod) => mod.RenameProjectModal,
    ),
  { ssr: false },
);

const DeleteProjectModal = dynamic(
  () =>
    import('@/components/projects/delete-project-modal').then(
      (mod) => mod.DeleteProjectModal,
    ),
  { ssr: false },
);

const NAV_MUTED = '#5f5f61';
const FLYOUT_TITLE_COLOR = '#646676';
const FLYOUT_ITEM_COLOR = '#1f1f20';
const NAV_ACTIVE_BG_OPEN =
  'data-[state=open]:bg-[#cfe8fa]/40 data-[state=open]:hover:bg-[#cfe8fa]/50';

type NavIcon = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

type NavMenuItem = {
  id: string;
  label: string;
  href?: string;
  exact?: boolean;
  emptyState?: boolean;
};

type NavMenuConfig = {
  id: string;
  label: string;
  icon: NavIcon;
  items: readonly NavMenuItem[];
};

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

const DOCUMENTATION_MENU = {
  id: 'documentation',
  label: 'Support',
  icon: BookOpen,
} as const;

type FooterAction = { id: string; label: string; icon: NavIcon };

const SidebarNavCallbackContext = React.createContext<{
  onAfterNav?: () => void;
}>({});

function useSidebarNavCallback() {
  return React.useContext(SidebarNavCallbackContext);
}

function SidebarCollapsedLabelFlyout({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        className="z-[200] w-max max-w-[280px] min-w-[120px] rounded-2xl border border-[#e6e6e8] bg-white px-3 py-2.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
      >
        <span
          className="text-[13px] leading-tight font-medium"
          style={{ color: FLYOUT_TITLE_COLOR }}
        >
          {label}
        </span>
      </HoverCardContent>
    </HoverCard>
  );
}

function SidebarNavDivider() {
  return (
    <div
      role="separator"
      className="my-2.5 h-px w-full shrink-0 bg-[#e9e9ea]"
      aria-hidden
    />
  );
}

function CollapsibleSubNavItem({
  id,
  label,
  href,
  exact,
  emptyState,
  onItemSelect,
}: NavMenuItem & {
  onItemSelect?: (itemId: string) => boolean | void;
}) {
  const { onAfterNav } = useSidebarNavCallback();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();

  const active = React.useMemo(() => {
    if (!href || !pathname) return false;
    if (href === '/') return pathname === '/';
    const normalizedHref = href.endsWith('/') ? href.slice(0, -1) : href;
    const normalizedPath = pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;
    if (exact) return normalizedPath === normalizedHref;
    return (
      normalizedPath === normalizedHref ||
      normalizedPath.startsWith(`${normalizedHref}/`)
    );
  }, [href, pathname, exact]);

  return (
    <button
      type="button"
      disabled={isPending || emptyState}
      aria-busy={isPending}
      className={cn(
        'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] font-normal transition-colors',
        emptyState
          ? 'cursor-default text-[#94a3b8] italic hover:bg-transparent'
          : active
            ? 'bg-[#eef6fc] text-[#1e40af]'
            : 'text-[#4a5568] hover:bg-[#f4f4f4]',
        isPending && 'opacity-70',
      )}
      onClick={() => {
        if (emptyState) return;
        const result = onItemSelect?.(id);
        if (result === false) return;
        if (href) {
          if (/^https?:\/\//i.test(href)) {
            window.open(href, '_blank', 'noopener,noreferrer');
          } else {
            startTransition(() => {
              router.push(href);
            });
          }
        }
        onAfterNav?.();
      }}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {isPending && (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-[#7d7e82]"
          aria-hidden
        />
      )}
    </button>
  );
}

function CollapsedNavFlyout({
  icon: Icon,
  label,
  items,
  onIconClick,
  onItemSelect,
}: {
  icon: NavIcon;
  label: string;
  items: readonly NavMenuItem[];
  onIconClick?: () => void;
  onItemSelect?: (itemId: string) => boolean | void;
}) {
  const router = useRouter();
  const { onAfterNav } = useSidebarNavCallback();
  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onIconClick}
          className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#c4c4c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
          aria-label={label}
        >
          <Icon
            className="size-4 shrink-0"
            style={{ color: NAV_MUTED }}
            strokeWidth={1.5}
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        className="z-[200] flex max-h-[70vh] w-max max-w-[280px] min-w-[200px] flex-col rounded-2xl border border-[#e6e6e8] bg-white px-3 py-2.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
      >
        <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-2">
          <span
            className="text-[13px] leading-tight font-medium"
            style={{ color: FLYOUT_TITLE_COLOR }}
          >
            {label}
          </span>
        </div>
        <ul className="scrollbar-thin m-0 min-h-0 list-none space-y-0 overflow-y-auto p-0 pr-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (onItemSelect?.(item.id) === false) return;
                  if (item.href) router.push(item.href);
                  onAfterNav?.();
                }}
                className={cn(
                  'flex w-full cursor-pointer rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors',
                  item.emptyState
                    ? 'cursor-default text-[#94a3b8] italic hover:bg-transparent'
                    : 'hover:bg-[#f4f4f4]',
                )}
                style={
                  item.emptyState ? undefined : { color: FLYOUT_ITEM_COLOR }
                }
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function SidebarNavCollapsibleSection({
  collapsed,
  menu,
  open,
  onOpenChange,
  onCollapsedIconClick,
  onItemSelect,
}: {
  collapsed: boolean;
  menu: NavMenuConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollapsedIconClick?: () => void;
  onItemSelect?: (itemId: string) => boolean | void;
}) {
  const Icon = menu.icon;

  if (collapsed) {
    return (
      <CollapsedNavFlyout
        icon={Icon}
        label={menu.label}
        items={menu.items}
        onIconClick={onCollapsedIconClick}
        onItemSelect={onItemSelect}
      />
    );
  }

  const triggerClassName = cn(
    'flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] outline-none transition-colors hover:bg-[#f4f4f4] focus-visible:ring-2 focus-visible:ring-[#cfe8fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]',
    NAV_ACTIVE_BG_OPEN,
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <CollapsibleTrigger asChild>
        <button type="button" className={triggerClassName}>
          <Icon
            className="size-4 shrink-0"
            style={{ color: NAV_MUTED }}
            strokeWidth={1.5}
          />
          <span className="min-w-0 flex-1 truncate">{menu.label}</span>
          {open ? (
            <ChevronDown
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          ) : (
            <ChevronRight
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="mt-0.5 mr-1 ml-1.5 border-l-2 border-[#e2e8f0] pb-0.5 pl-2.5">
          <ul className="flex flex-col gap-0.5" role="list">
            {menu.items.map((item) => (
              <li key={item.id}>
                <CollapsibleSubNavItem {...item} onItemSelect={onItemSelect} />
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Mirrors the original `AuthPopover.handleLogin`: send a not-logged-in
// (anonymous) user to the auth SPA when they trigger a gated action.
function redirectToLogin(tenantKey: string | undefined) {
  if (!tenantKey) {
    redirectToAuthSpa('/', tenantKey, undefined, true, true);
    return;
  }
  redirectToAuthSpaJoinTenant(tenantKey, undefined, true);
}

type SdkProject = {
  id: number | string;
  name?: string | null;
  mentors?: Array<{ unique_id?: string | null; name?: string | null }> | null;
};

function SidebarProjectsSection({
  collapsed,
  tenantKey,
  username,
  open,
  onOpenChange,
  onNavigate,
  onCollapsedIconClick,
}: {
  collapsed: boolean;
  tenantKey: string;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
  onCollapsedIconClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  const { data: projectsQueryData } = useGetUserProjectsQuery(
    {
      tenantKey,
      username,
      params: { limit: 50 },
    } as never,
    { skip: !tenantKey || !username },
  );

  const projects = React.useMemo<SdkProject[]>(() => {
    return (
      (projectsQueryData as { results?: SdkProject[] } | undefined)?.results ??
      []
    );
  }, [projectsQueryData]);

  const projectDefaultMentor = React.useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of projects) {
      const first = (p.mentors ?? []).find(
        (m) => typeof m.unique_id === 'string' && m.unique_id,
      );
      if (first?.unique_id) map[String(p.id)] = first.unique_id;
    }
    return map;
  }, [projects]);

  const projectHref = (projectId: string): string | null => {
    const mentor = projectDefaultMentor[projectId];
    if (!tenantKey || !mentor) return null;
    return `/platform/${tenantKey}/projects/${projectId}/${mentor}`;
  };

  const isProjectActive = (projectId: string): boolean => {
    if (!pathname || !tenantKey) return false;
    return pathname.includes(`/projects/${projectId}`);
  };

  const [createOpen, setCreateOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const openProject = (projectId: string) => {
    const href = projectHref(projectId);
    if (!href) {
      toast('Add an agent to this project first.');
      return;
    }
    router.push(href);
    onNavigate?.();
  };

  // Mirrors the original ProjectsSidebarDropdown: an anonymous user sees
  // the Projects section, but "New Project" routes to the auth SPA login
  // instead of opening the create modal.
  const handleCreateClick = () => {
    if (!isLoggedIn()) {
      redirectToLogin(tenantKey);
      return;
    }
    executeWithTrialCheck(() => setCreateOpen(true));
  };

  // Navigates to the dedicated Projects index page
  // (/platform/<tenant>/projects), mirroring "My Workflows".
  const openProjectsIndex = () => {
    if (!tenantKey) return;
    router.push(`/platform/${tenantKey}/projects`);
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <>
        <CollapsedProjectsFlyout
          projects={projects}
          isProjectActive={isProjectActive}
          openProject={openProject}
          onIconClick={onCollapsedIconClick}
          onCreateClick={handleCreateClick}
          onMyProjectsClick={openProjectsIndex}
        />
        <ProjectDialogs
          createOpen={createOpen}
          setCreateOpen={setCreateOpen}
          renameTarget={renameTarget}
          setRenameTarget={setRenameTarget}
          deleteTarget={deleteTarget}
          setDeleteTarget={setDeleteTarget}
        />
      </>
    );
  }

  const triggerClassName = cn(
    'flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] outline-none transition-colors hover:bg-[#f4f4f4] focus-visible:ring-2 focus-visible:ring-[#cfe8fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]',
    NAV_ACTIVE_BG_OPEN,
  );

  return (
    <>
      <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
        <CollapsibleTrigger asChild>
          <button type="button" className={triggerClassName}>
            <Folder
              className="size-4 shrink-0"
              style={{ color: NAV_MUTED }}
              strokeWidth={1.5}
            />
            <span className="min-w-0 flex-1 truncate">Projects</span>
            {open ? (
              <ChevronDown
                className="size-4 shrink-0 text-[#7d7e82]"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="size-4 shrink-0 text-[#7d7e82]"
                aria-hidden
              />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden">
          <div className="mt-0.5 mr-1 ml-1.5 border-l-2 border-[#e2e8f0] pb-0.5 pl-2.5">
            <ul className="flex flex-col gap-0.5" role="list">
              <li>
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] font-normal text-[#4a5568] transition-colors hover:bg-[#f4f4f4]"
                >
                  <FolderPlus
                    className="size-3.5 shrink-0 text-[#7d7e82]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">New Project</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={openProjectsIndex}
                  className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] font-normal text-[#4a5568] transition-colors hover:bg-[#f4f4f4]"
                >
                  <Folder
                    className="size-3.5 shrink-0 text-[#7d7e82]"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">My Projects</span>
                </button>
              </li>
              {projects.length === 0 ? (
                <li>
                  <span className="block px-2 py-1.5 text-[13px] text-[#94a3b8] italic">
                    No projects yet
                  </span>
                </li>
              ) : (
                projects.map((p) => {
                  const id = String(p.id);
                  const active = isProjectActive(id);
                  return (
                    <li key={id} className="group">
                      <div
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-[14px] font-normal transition-colors',
                          active
                            ? 'bg-[#eef6fc] text-[#1e40af]'
                            : 'text-[#4a5568] hover:bg-[#f4f4f4]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openProject(id)}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left"
                          title={p.name ?? 'Untitled project'}
                        >
                          <Folder
                            className="size-3.5 shrink-0 opacity-70"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {p.name ?? 'Untitled project'}
                          </span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#7d7e82] transition-opacity hover:bg-[#eef0f3] hover:text-[#1f2937]',
                                'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100',
                              )}
                              aria-label="Project actions"
                            >
                              <MoreVertical
                                className="size-3.5"
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onSelect={() =>
                                setRenameTarget({
                                  id,
                                  name: p.name ?? '',
                                })
                              }
                              className="gap-2"
                            >
                              <Pencil
                                className="size-3.5 shrink-0"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                setDeleteTarget({
                                  id,
                                  name: p.name ?? '',
                                })
                              }
                              className="gap-2 text-red-600 focus:text-red-700"
                            >
                              <Trash2
                                className="size-3.5 shrink-0"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <ProjectDialogs
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        renameTarget={renameTarget}
        setRenameTarget={setRenameTarget}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
      />
    </>
  );
}

function CollapsedProjectsFlyout({
  projects,
  isProjectActive,
  openProject,
  onIconClick,
  onCreateClick,
  onMyProjectsClick,
}: {
  projects: SdkProject[];
  isProjectActive: (projectId: string) => boolean;
  openProject: (projectId: string) => void;
  onIconClick?: () => void;
  onCreateClick: () => void;
  onMyProjectsClick: () => void;
}) {
  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onIconClick}
          className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#c4c4c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
          aria-label="Projects"
        >
          <Folder
            className="size-4 shrink-0"
            style={{ color: NAV_MUTED }}
            strokeWidth={1.5}
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        className="z-[200] flex max-h-[70vh] w-max max-w-[300px] min-w-[220px] flex-col rounded-2xl border border-[#e6e6e8] bg-white px-3 py-2.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
      >
        <div className="mb-1.5 flex shrink-0 items-center gap-2">
          <span
            className="text-[13px] leading-tight font-medium"
            style={{ color: FLYOUT_TITLE_COLOR }}
          >
            Projects
          </span>
        </div>
        <ul className="scrollbar-thin m-0 min-h-0 list-none space-y-0 overflow-y-auto p-0 pr-1">
          <li>
            <button
              type="button"
              onClick={onCreateClick}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
              style={{ color: FLYOUT_ITEM_COLOR }}
            >
              <Plus
                className="size-3.5 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              New Project
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={onMyProjectsClick}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
              style={{ color: FLYOUT_ITEM_COLOR }}
            >
              <Folder
                className="size-3.5 shrink-0"
                strokeWidth={1.5}
                aria-hidden
              />
              My Projects
            </button>
          </li>
          {projects.length === 0 ? (
            <li>
              <span className="block rounded-md px-1.5 py-1.5 text-[14px] text-[#94a3b8] italic">
                No projects yet
              </span>
            </li>
          ) : (
            projects.map((p) => {
              const id = String(p.id);
              const active = isProjectActive(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => openProject(id)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]',
                      active && 'bg-[#eef6fc] text-[#1e40af]',
                    )}
                    style={active ? undefined : { color: FLYOUT_ITEM_COLOR }}
                    title={p.name ?? 'Untitled project'}
                  >
                    <Folder
                      className="size-3.5 shrink-0 opacity-70"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name ?? 'Untitled project'}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function ProjectDialogs({
  createOpen,
  setCreateOpen,
  renameTarget,
  setRenameTarget,
  deleteTarget,
  setDeleteTarget,
}: {
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  renameTarget: { id: string; name: string } | null;
  setRenameTarget: (target: { id: string; name: string } | null) => void;
  deleteTarget: { id: string; name: string } | null;
  setDeleteTarget: (target: { id: string; name: string } | null) => void;
}) {
  return (
    <>
      {createOpen && (
        <CreateProjectModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {renameTarget && (
        <RenameProjectModal
          isOpen={renameTarget !== null}
          onClose={() => setRenameTarget(null)}
          projectId={renameTarget.id}
          currentName={renameTarget.name}
        />
      )}
      {deleteTarget && (
        <DeleteProjectModal
          isOpen={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
        />
      )}
    </>
  );
}

// =============================================================================
// Chats section — Pinned + Recent with per-row three-dot menu (Pin/Unpin,
// Export, Delete). Port of the OLD `recent-messages.tsx` + `pinned-messages.tsx`
// pair onto the new sidebar's visual style. Renders both a rail-mode flyout
// and an expanded-mode collapsible.
// =============================================================================

type ChatRow = {
  session_id: string;
  mentor?: { unique_id?: string | null; profile_image?: string | null } | null;
  messages?: unknown;
};

function chatRowLabel(row: ChatRow): React.ReactNode {
  const messages = (row.messages as unknown[]) ?? [];
  const content = getFirstMessageWithContent(messages as never);
  if (content) {
    return (
      <Markdown className="!space-y-0 [&_*]:!my-0 [&_*]:!text-[14px] [&_*]:!leading-snug [&_*]:!font-normal [&_*]:!text-inherit [&_h2]:!border-0">
        {content}
      </Markdown>
    );
  }
  const artifactTitle = getCurrentArtifactTitle(messages as never);
  return artifactTitle || 'No content';
}

function ChatThreeDotMenu({
  isPinned,
  isLoading,
  onPinToggle,
  onExport,
  onDelete,
}: {
  isPinned: boolean;
  isLoading: boolean;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isLoading}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
          // `MoreVertical` matches the per-project three-dot trigger in
          // `SidebarProjectsSection` so both lists feel consistent. While
          // an action on THIS row is in flight, the icon is swapped for
          // a spinner — the user knows exactly which row is processing.
          className={cn(
            'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#7d7e82] transition-opacity hover:bg-[#eef0f3] hover:text-[#1f2937] data-[state=open]:opacity-100',
            isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          aria-label="Chat actions"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <Loader2
              className="size-3.5 animate-spin"
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <MoreVertical className="size-3.5" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem className="gap-2" onSelect={onPinToggle}>
          {isPinned ? (
            <PinOff
              className="size-3.5 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
          ) : (
            <Pin className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          )}
          {isPinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={onExport}>
          <Download
            className="size-3.5 shrink-0"
            strokeWidth={1.5}
            aria-hidden
          />
          Export
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 text-red-600 focus:text-red-700"
          onSelect={onDelete}
        >
          <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChatRowItem({
  row,
  active,
  onSelect,
  isPinned,
  isLoading,
  onPinToggle,
  onExport,
  onDelete,
}: {
  row: ChatRow;
  active: boolean;
  onSelect: () => void;
  isPinned: boolean;
  isLoading: boolean;
  onPinToggle: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-2 pr-8 text-left text-[14px] font-normal transition-colors',
          active
            ? 'bg-[#eef6fc] text-[#1e40af]'
            : 'text-[#4a5568] hover:bg-[#f4f4f4]',
        )}
      >
        <span className="line-clamp-1 min-w-0 flex-1 overflow-hidden">
          {chatRowLabel(row)}
        </span>
      </button>
      <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
        <ChatThreeDotMenu
          isPinned={isPinned}
          isLoading={isLoading}
          onPinToggle={onPinToggle}
          onExport={onExport}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function SidebarChatsSection({
  collapsed,
  open,
  onOpenChange,
  onCollapsedIconClick,
  tenantKey,
  mentorId,
  username,
}: {
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollapsedIconClick?: () => void;
  tenantKey: string;
  mentorId: string | undefined;
  username: string | null;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { onAfterNav } = useSidebarNavCallback();
  const appSessionId = useAppSelector(selectSessionId);
  const resolvedUserId = username ?? getUserName();
  // The message-loader effect in `useAdvancedChat` keys EXCLUSIVELY on
  // `cachedSessionId[mentorId]` (backed by localStorage `session_id`). Row
  // clicks must write this value or the panel never repopulates — selecting
  // an existing chat would otherwise only update the URL (issue #1881).
  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<
    Record<string, string>
  >(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    /* istanbul ignore next -- @preserve localStorage deserializer */
    { deserializer: (value) => JSON.parse(value) },
  );

  const [pinMessage] = useAddPinnedMessageMutation();
  const [unpinMessage] = useUnPinMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  // Tracks the row whose pin/unpin/delete is currently in flight, so we
  // can render a spinner in its three-dot trigger slot — visual feedback
  // anchored to the exact row the user clicked.
  const [actingSessionId, setActingSessionId] = React.useState<string | null>(
    null,
  );

  // RTK Query's `Recipe<...>` type is too narrow for the SDK-typed
  // chat queries (it resolves to `InfiniteData<never, never>`). The
  // actual runtime payload is `{ results: ChatRow[] }`. Cast once via
  // `unknown` so each call site stays readable.
  type ChatCacheDraft = { results?: ChatRow[] };
  const updateChatCache = chatApiSlice.util.updateQueryData as unknown as <
    K extends 'getRecentMessage' | 'getPinnedMessages',
  >(
    endpoint: K,
    args: object,
    recipe: (draft: ChatCacheDraft) => void,
  ) => unknown;

  // Recent — scoped to the current mentor in the cache selector so we
  // don't paint rows from other agents. `refetch` is invoked after
  // pin/unpin so the lists reflect server truth (no stale optimistic
  // state if the server transitions the row in unexpected ways).
  const { data: recentMessages, refetch: refetchRecent } =
    useGetRecentMessageQuery(
      {
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
      },
      {
        skip: !tenantKey || !resolvedUserId,
        selectFromResult: (state) => ({
          ...state,
          data: {
            ...state.data,
            results: ((state.data as { results?: ChatRow[] } | undefined)
              ?.results ?? []) as ChatRow[],
          },
        }),
      },
    );

  // Pinned — same shape; `sessionId` arg is the cache key the SDK uses
  // for invalidation, not a row filter.
  const { data: pinnedMessages, refetch: refetchPinned } =
    useGetPinnedMessagesQuery(
      {
        org: tenantKey,
        sessionId: appSessionId,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
      },
      {
        skip: !tenantKey || !resolvedUserId,
        selectFromResult: (state) => ({
          ...state,
          data: {
            ...state.data,
            results: ((state.data as { results?: ChatRow[] } | undefined)
              ?.results ?? []) as ChatRow[],
          },
        }),
      },
    );

  const filterByMentor = React.useCallback(
    (list: ChatRow[]) =>
      list.filter(
        (r) =>
          !mentorId || !r.mentor?.unique_id || r.mentor.unique_id === mentorId,
      ),
    [mentorId],
  );

  // SDK types `pinnedMessages` as `PinnedMessageGet[]`, but the API
  // actually returns `{ results: [...] }`. We rebuilt that shape inside
  // `selectFromResult`, so the runtime is correct — cast through unknown.
  const pinned = React.useMemo(
    () =>
      filterByMentor(
        (pinnedMessages as unknown as { results?: ChatRow[] } | undefined)
          ?.results ?? [],
      ),
    [pinnedMessages, filterByMentor],
  );
  // Recent must EXCLUDE rows that are also in Pinned — the API returns
  // every session under recent regardless of pin state, so without this
  // dedup a pinned chat would appear in both sections (confusing UX
  // the user explicitly called out). Computing pinned first lets us
  // filter recent against it.
  const pinnedSessionIds = React.useMemo(
    () => new Set(pinned.map((p) => p.session_id)),
    [pinned],
  );
  const recent = React.useMemo(
    () =>
      filterByMentor(
        (recentMessages as unknown as { results?: ChatRow[] } | undefined)
          ?.results ?? [],
      ).filter((r) => !pinnedSessionIds.has(r.session_id)),
    [recentMessages, filterByMentor, pinnedSessionIds],
  );

  // Helpers shared by both lists ---------------------------------------

  const navHrefFor = (row: ChatRow): string | undefined => {
    const m = row.mentor?.unique_id;
    if (!m || !tenantKey) return undefined;
    return `/platform/${tenantKey}/${m}?session=${encodeURIComponent(
      String(row.session_id),
    )}`;
  };

  // Selecting an existing chat. Navigating (`router.push(?session=...)`) is
  // NOT enough on its own — nothing reads the query param back into state.
  // We must also point the chat slice + the cached session id at the picked
  // session so the loader effect re-fires and repaints the message panel.
  // Clicking the already-active chat is a no-op for state (we only navigate /
  // close the flyout) to avoid thrashing the in-flight session.
  const handleSelectRow = (row: ChatRow) => {
    const href = navHrefFor(row);
    if (!href) return;

    if (row.session_id !== appSessionId) {
      // Different session: tear down any in-flight streaming/typing state and
      // file context from the previous chat before pointing everything at the
      // newly selected session.
      dispatch(clearFiles(undefined));
      eventBus.emit(RemoteEvents.stopChatGenerating);
      dispatch(chatActions.resetIsTyping(undefined));
      dispatch(chatActions.setStreaming(false));
      dispatch(chatActions.resetCurrentStreamingMessage(undefined));
      dispatch(chatActions.setActiveTab('chat'));
      dispatch(chatActions.updateSessionIds(row.session_id));
      dispatch(chatActions.setShouldStartNewChat(false));

      // The localStorage `session_id` value the loader effect watches. This
      // is the dependency that triggers getChats() → setNewMessages.
      if (mentorId) {
        saveCachedSessionId({
          ...cachedSessionId,
          [mentorId]: row.session_id,
        });
      }
    }

    router.push(href);
    onAfterNav?.();
  };

  const handlePin = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      const result = await pinMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        requestBody: { session_id: row.session_id },
      }).unwrap();
      // Optimistic patch so the row appears in Pinned immediately. The
      // `Promise.all` refetch right after is the source of truth — if the
      // server transforms the row (e.g. adds a title, timestamp) we want
      // to see those properties on the next render. Recent cache is NOT
      // mutated here so the UI's `pinnedSessionIds` dedup is the single
      // signal hiding the row from Recent until it's unpinned.
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = draft.results ?? [];
            draft.results.push((result ?? row) as ChatRow);
          },
        ) as never,
      );
      await Promise.all([refetchRecent(), refetchPinned()]);
    } catch (err) {
      console.error('Failed to pin message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleUnpin = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      // Same shape as `pinMessage` — `requestBody: { session_id }` is
      // what the backend's DELETE handler expects. SDK service signature
      // needs to declare `requestBody: PinnedMessageRequest` for this
      // to typecheck cleanly (see note below).
      await unpinMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        // @ts-ignore — requestBody not yet declared on the SDK's
        // `aiMentorOrgsUsersPinMessageDestroy` service signature.
        requestBody: { session_id: row.session_id },
      }).unwrap();
      // Optimistic: pop out of Pinned. The dedup in `recent` then
      // re-includes the row on next render. Refetch in parallel so we
      // converge on server truth without an extra round-trip.
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
      await Promise.all([refetchRecent(), refetchPinned()]);
    } catch (err) {
      console.error('Failed to unpin message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleDelete = async (row: ChatRow) => {
    if (!tenantKey || !resolvedUserId) return;
    setActingSessionId(row.session_id);
    try {
      await deleteMessage({
        org: tenantKey,
        // @ts-ignore — userId is required at the URL path level
        userId: resolvedUserId,
        sessionId: row.session_id,
      }).unwrap();
      dispatch(
        updateChatCache(
          'getRecentMessage',
          { org: tenantKey, userId: resolvedUserId },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
      dispatch(
        updateChatCache(
          'getPinnedMessages',
          {
            org: tenantKey,
            sessionId: appSessionId,
            userId: resolvedUserId,
          },
          (draft) => {
            draft.results = (draft.results ?? []).filter(
              (m) => m.session_id !== row.session_id,
            );
          },
        ) as never,
      );
      // Active-session safety: clear file context and start a new chat
      // so the canvas/composer doesn't keep pointing at a deleted session.
      if (row.session_id === appSessionId) {
        dispatch(clearFiles(undefined));
        eventBus.emit(RemoteEvents.newChat);
        dispatch(chatActions.setShouldStartNewChat(true));
      }
    } catch (err) {
      console.error('Failed to delete message: ', err);
    } finally {
      setActingSessionId(null);
    }
  };

  const handleExport = (row: ChatRow) => {
    // Delegate to the shared sibling helper — it uses `write-excel-file`
    // (already a project dep) and is covered by `export-messages.test.ts`.
    exportMessagesToXlsx(row.messages ?? []);
  };

  // Render helpers -----------------------------------------------------

  const renderRow = (row: ChatRow, kind: 'pinned' | 'recent') => (
    <ChatRowItem
      key={`${kind}-${row.session_id}`}
      row={row}
      active={row.session_id === appSessionId}
      onSelect={() => handleSelectRow(row)}
      isPinned={kind === 'pinned'}
      isLoading={actingSessionId === row.session_id}
      onPinToggle={() =>
        kind === 'pinned' ? handleUnpin(row) : handlePin(row)
      }
      onExport={() => handleExport(row)}
      onDelete={() => handleDelete(row)}
    />
  );

  if (collapsed) {
    return (
      <HoverCard openDelay={180} closeDelay={120}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={onCollapsedIconClick}
            className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#c4c4c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
            aria-label="Chats"
          >
            <MessageSquare
              className="size-4 shrink-0"
              style={{ color: NAV_MUTED }}
              strokeWidth={1.5}
            />
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          className="z-[200] flex max-h-[70vh] w-max max-w-[320px] min-w-[240px] flex-col rounded-2xl border border-[#e6e6e8] bg-white px-3 py-2.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]"
        >
          <span
            className="mb-1.5 shrink-0 text-[13px] leading-tight font-medium"
            style={{ color: FLYOUT_TITLE_COLOR }}
          >
            Chats
          </span>
          <div className="scrollbar-thin min-h-0 overflow-y-auto pr-1">
            {pinned.length > 0 && (
              <>
                <p className="px-1 pb-1 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                  Pinned
                </p>
                {pinned.map((row) => (
                  <button
                    key={`flyout-pinned-${row.session_id}`}
                    type="button"
                    onClick={() => handleSelectRow(row)}
                    className="block w-full truncate rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
                    style={{ color: FLYOUT_ITEM_COLOR }}
                  >
                    {chatRowLabel(row)}
                  </button>
                ))}
              </>
            )}
            <p
              className={cn(
                'px-1 pb-1 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase',
                pinned.length > 0 && 'pt-2',
              )}
            >
              Recent
            </p>
            {recent.length > 0 ? (
              recent.map((row) => (
                <button
                  key={`flyout-recent-${row.session_id}`}
                  type="button"
                  onClick={() => handleSelectRow(row)}
                  className="block w-full truncate rounded-md px-1.5 py-1.5 text-left text-[14px] leading-snug font-medium transition-colors hover:bg-[#f4f4f4]"
                  style={{ color: FLYOUT_ITEM_COLOR }}
                >
                  {chatRowLabel(row)}
                </button>
              ))
            ) : (
              <span className="block rounded-md px-1.5 py-1.5 text-[14px] text-[#94a3b8] italic">
                No recent chats
              </span>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  const triggerClassName = cn(
    'flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] outline-none transition-colors hover:bg-[#f4f4f4] focus-visible:ring-2 focus-visible:ring-[#cfe8fa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]',
    NAV_ACTIVE_BG_OPEN,
  );

  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="w-full">
      <CollapsibleTrigger asChild>
        <button type="button" className={triggerClassName}>
          <MessageSquare
            className="size-4 shrink-0"
            style={{ color: NAV_MUTED }}
            strokeWidth={1.5}
          />
          <span className="min-w-0 flex-1 truncate">Chats</span>
          {open ? (
            <ChevronDown
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          ) : (
            <ChevronRight
              className="size-4 shrink-0 text-[#7d7e82]"
              aria-hidden
            />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <div className="mt-0.5 mr-1 ml-1.5 border-l-2 border-[#e2e8f0] pb-0.5 pl-2.5">
          {pinned.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase">
                Pinned
              </p>
              <ul className="flex flex-col gap-0.5" role="list">
                {pinned.map((row) => (
                  <li key={`pinned-${row.session_id}`}>
                    {renderRow(row, 'pinned')}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p
            className={cn(
              'px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wider text-[#9ca3af] uppercase',
              pinned.length > 0 && 'mt-1',
            )}
          >
            Recent
          </p>
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-0.5" role="list">
              {recent.map((row) => (
                <li key={`recent-${row.session_id}`}>
                  {renderRow(row, 'recent')}
                </li>
              ))}
            </ul>
          ) : (
            <span className="block px-2 py-1.5 text-[13px] text-[#94a3b8] italic">
              No recent chats
            </span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type SidebarOpenSection =
  | 'workflows'
  | 'chats'
  | 'projects'
  | 'agents'
  | 'analytics';

type AccountTab =
  | 'organization'
  | 'management'
  | 'integrations'
  | 'monetization'
  | 'advanced'
  | 'billing';

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
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
    React.useState<AccountTab | null>(null);

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

  const { state, open, openMobile, setOpenMobile, toggleSidebar, isMobile } =
    useSidebar();

  const isExpanded = isMobile ? openMobile : open;
  const railCollapsed = !isMobile && !open;

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

  const handleNavSectionChange = React.useCallback(
    (id: SidebarOpenSection) => (open: boolean) => {
      setOpenNavSection(open ? id : null);
    },
    [],
  );

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

  const analyticsMenu = React.useMemo<NavMenuConfig>(() => {
    const base = analyticsBasePath ?? '/analytics';
    return {
      id: 'analytics',
      label: 'Analytics',
      icon: LineChart,
      items: [
        {
          id: 'analytics-overview',
          label: 'Overview',
          href: base,
          exact: true,
        },
        { id: 'analytics-users', label: 'Users', href: `${base}/users` },
        { id: 'analytics-topics', label: 'Topics', href: `${base}/topics` },
        {
          id: 'analytics-transcripts',
          label: 'Transcripts',
          href: `${base}/transcripts`,
        },
        { id: 'analytics-costs', label: 'Costs', href: `${base}/financial` },
        { id: 'analytics-audit', label: 'Audit', href: `${base}/audit` },
        {
          id: 'analytics-reports',
          label: 'Data Reports',
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
      // `false` so `CollapsibleSubNavItem` swallows the nav and the
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
  const agentsMenu: NavMenuConfig = React.useMemo(() => {
    const items: NavMenuItem[] = [];
    // Embed mode shows a minimal sidebar (New Chat + chat history only),
    // mirroring the pre-rewrite behavior — no Agents section at all.
    if (embedMode)
      return { id: 'agents', label: 'Agents', icon: Globe2, items };
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
      items.push({ id: 'agents-new', label: 'New Agent' });
    if (
      showTrialGatedAdminMenu ||
      studentCanCreateMentors ||
      showAnonymousAdminMenu ||
      (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.agentsMy))
    )
      items.push({ id: 'agents-my', label: 'My Agents' });
    // Explore is open to STUDENT/VISITING too, so it doesn't need the
    // live-admin guard — `isUserTypeAllowed` is sufficient.
    if (isUserTypeAllowed(PERMISSION_GATES.agentsExplore))
      items.push({ id: 'agents-explore', label: 'Explore' });
    return { id: 'agents', label: 'Agents', icon: Globe2, items };
  }, [
    embedMode,
    isLiveAdmin,
    isUserTypeAllowed,
    showTrialGatedAdminMenu,
    studentCanCreateMentors,
    showAnonymousAdminMenu,
  ]);

  const workflowsMenu: NavMenuConfig = React.useMemo(() => {
    // Hidden entirely in embed mode (minimal sidebar).
    const allowed =
      !embedMode &&
      (showTrialGatedAdminMenu ||
        showAnonymousAdminMenu ||
        (isLiveAdmin && isUserTypeAllowed(PERMISSION_GATES.workflows)));
    return {
      id: 'workflows',
      label: 'Workflows',
      icon: Workflow,
      items: allowed
        ? [
            { id: 'workflows-create', label: 'New Workflow' },
            { id: 'workflows-my', label: 'My Workflows' },
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

  const footerActions = React.useMemo<FooterAction[]>(() => {
    const actions: FooterAction[] = [];
    if (embedMode) return actions;

    // Notifications: gated by its own userTypes — students, free-trial,
    // and admins ALL see it (anonymous/visiting don't). Not gated on the
    // admin toggle since regular users have notifications too.
    if (isUserTypeAllowed(PERMISSION_GATES.notifications)) {
      actions.push({
        id: 'footer-notifications',
        label: 'Notifications',
        icon: Bell,
      });
    }

    // Admin cluster — uses the LIVE admin signal (`!userIsStudent`)
    // rather than the static `useIsAdmin`, so flipping the navbar
    // User/Admin toggle hides/shows these in real time. Mirrors the
    // SDK `Account` component's per-feature gating.
    //
    // The platform-level RBAC permission flags are computed up here (not
    // only inside the `isLiveAdmin` branch) so a GENUINE non-admin who holds
    // them can also see the corresponding footer item — see the
    // `!isAdmin && config.enableRBAC()` branch below.
    const tenantKeyForRbac = currentTenant?.key ?? tenantKey;

    const hasInviteUserPermission = checkRbacPermission(
      rbacPermissions,
      `/platforms/${tenantKeyForRbac}/#can_invite`,
    );

    // Management surfaces a row when ANY of its sub-tab permissions
    // resolves true — matches the SDK's `hasManagementPermissions`.
    const hasManagementPermissions =
      checkRbacPermission(
        rbacPermissions,
        `/platforms/${tenantKeyForRbac}/#can_manage_users`,
      ) ||
      checkRbacPermission(rbacPermissions, `/groups/#list`) ||
      checkRbacPermission(rbacPermissions, `/policies/#list`) ||
      checkRbacPermission(rbacPermissions, `/roles/#list`) ||
      checkRbacPermission(
        rbacPermissions,
        `/usergroups/#list|/platforms/${tenantKeyForRbac}/#can_invite`,
      ) ||
      checkRbacPermission(rbacPermissions, `/watchedgroups/#list`);

    const hasMonetizationPermission = checkRbacPermission(
      rbacPermissions,
      `/platforms/${tenantKeyForRbac}/#can_sell_items`,
    );
    const canMonetize =
      !!currentTenant?.enable_monetization && hasMonetizationPermission;

    if (isLiveAdmin) {
      if (
        hasInviteUserPermission &&
        isUserTypeAllowed(PERMISSION_GATES.invites)
      ) {
        actions.push({ id: 'footer-invites', label: 'Invites', icon: Mail });
      }
      if (hasManagementPermissions) {
        actions.push({
          id: 'footer-users',
          label: 'Management',
          icon: Users,
        });
      }
      actions.push({
        id: 'footer-api',
        label: 'Integrations',
        icon: KeyRound,
      });
      if (canMonetize) {
        actions.push({
          id: 'footer-monetization',
          label: 'Monetization',
          icon: Coins,
        });
      }
      actions.push({
        id: 'footer-settings',
        label: 'Advanced',
        icon: Settings,
      });
    } else if (showTrialGatedAdminMenu || showAnonymousAdminMenu) {
      // Main-tenant non-admins (and anonymous users) get the FULL admin
      // cluster. We skip the RBAC checks the live-admin branch does because
      // these users hold none of those permissions — clicking any of these
      // either opens the upgrade dialog (trial users) or routes to the auth
      // SPA login (anonymous users), via `handleFooterActionClick` →
      // `runAdminAction`, instead of the real surface. Checked BEFORE the
      // permission branch below so a trial/advertising non-admin still gets
      // the full (trial-gated) cluster rather than only their held permissions.
      actions.push({ id: 'footer-invites', label: 'Invites', icon: Mail });
      actions.push({ id: 'footer-users', label: 'Management', icon: Users });
      actions.push({ id: 'footer-api', label: 'Integrations', icon: KeyRound });
      actions.push({
        id: 'footer-monetization',
        label: 'Monetization',
        icon: Coins,
      });
      actions.push({
        id: 'footer-settings',
        label: 'Advanced',
        icon: Settings,
      });
    } else if (!isAdmin && config.enableRBAC()) {
      // A GENUINE non-admin in an RBAC-enabled tenant sees ONLY the footer
      // items whose platform permission they actually hold — mirroring the
      // Analytics permission gate. We MUST guard on `config.enableRBAC()`
      // because `checkRbacPermission` returns true when RBAC is off, which
      // would otherwise expose these to every non-admin. `!isAdmin` keeps an
      // admin-in-learner-mode excluded. Integrations and Advanced have no
      // dedicated RBAC permission, so they stay admin/trial/anonymous-only.
      if (hasInviteUserPermission) {
        actions.push({ id: 'footer-invites', label: 'Invites', icon: Mail });
      }
      if (hasManagementPermissions) {
        actions.push({
          id: 'footer-users',
          label: 'Management',
          icon: Users,
        });
      }
      if (canMonetize) {
        actions.push({
          id: 'footer-monetization',
          label: 'Monetization',
          icon: Coins,
        });
      }
    }
    return actions;
  }, [
    embedMode,
    isAdmin,
    isLiveAdmin,
    showTrialGatedAdminMenu,
    showAnonymousAdminMenu,
    currentTenant,
    tenantKey,
    rbacPermissions,
    isUserTypeAllowed,
  ]);

  const openAccountTab = React.useCallback(
    (tab: AccountTab) => {
      const result = runAdminAction(() => {
        setAccountDialogTab(tab);
      });
      if (result !== null) onAfterNav();
    },
    [runAdminAction, onAfterNav],
  );

  const handleFooterActionClick = React.useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'footer-notifications':
          navigateToNotifications();
          onAfterNav();
          return;
        case 'footer-invites':
          runAdminAction(() => openInviteUserModal());
          onAfterNav();
          return;
        case 'footer-users':
          openAccountTab('management');
          return;
        case 'footer-api':
          openAccountTab('integrations');
          return;
        case 'footer-monetization':
          openAccountTab('monetization');
          return;
        case 'footer-settings':
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

  const expandFromRail = React.useCallback(
    (section: SidebarOpenSection) => {
      toggleSidebar();
      setOpenNavSection(section);
    },
    [toggleSidebar],
  );

  if (hideSidebar) {
    return <></>;
  }

  return (
    <SidebarNavCallbackContext.Provider value={{ onAfterNav }}>
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className="flex flex-col border-r border-[#e9e9ea]"
        sidebarInnerClassName="bg-[#fafafa]"
      >
        <aside
          data-state={state}
          className={cn(
            'flex h-full flex-col',
            railCollapsed ? 'w-[65px]' : 'w-full',
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'shrink-0',
              railCollapsed
                ? 'px-2 pt-[18px] pb-[25px]'
                : 'px-[10px] py-[10px]',
            )}
          >
            <div
              className={cn(
                'flex items-center gap-2 font-sans',
                railCollapsed ? 'justify-center px-0' : 'px-1',
              )}
            >
              {!railCollapsed && (
                <>
                  {/* Spacer matching the collapse button's width so the logo
                      sits at the true horizontal center of the header rather
                      than being pushed left by the button on the right. */}
                  <span className="size-7 shrink-0" aria-hidden />
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <Logo className="h-[51px] max-h-none w-auto max-w-full object-contain" />
                  </div>
                </>
              )}
              <SidebarCollapsedLabelFlyout
                label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md font-sans text-[#7d7e82] transition-colors hover:bg-[#f0f0f0]"
                  aria-label={
                    isExpanded ? 'Collapse sidebar' : 'Expand sidebar'
                  }
                  aria-expanded={isExpanded}
                >
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shrink-0"
                    aria-hidden
                  >
                    <path d="M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z" />
                  </svg>
                </button>
              </SidebarCollapsedLabelFlyout>
            </div>
          </div>

          {/* Body */}
          {railCollapsed ? (
            <nav
              className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-2 pt-1 pb-2"
              aria-label="Main navigation"
            >
              {newChatAllowed && (
                <SidebarCollapsedLabelFlyout label="New Chat">
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-[#e0e0e2] bg-white transition-colors hover:bg-[#f8f8f9]"
                    aria-label="New chat"
                  >
                    <SquarePen className="size-4 shrink-0" strokeWidth={1.5} />
                  </button>
                </SidebarCollapsedLabelFlyout>
              )}

              {agentsMenu.items.length > 0 && (
                <SidebarNavCollapsibleSection
                  collapsed
                  menu={agentsMenu}
                  open={openNavSection === 'agents'}
                  onOpenChange={handleNavSectionChange('agents')}
                  onItemSelect={handleAgentMenuSelect}
                  onCollapsedIconClick={() => expandFromRail('agents')}
                />
              )}
              {workflowsMenu.items.length > 0 && (
                <SidebarNavCollapsibleSection
                  collapsed
                  menu={workflowsMenu}
                  open={openNavSection === 'workflows'}
                  onOpenChange={handleNavSectionChange('workflows')}
                  onItemSelect={handleWorkflowMenuSelect}
                  onCollapsedIconClick={() => expandFromRail('workflows')}
                />
              )}

              {showChats && (
                <>
                  <SidebarNavDivider />

                  <SidebarChatsSection
                    collapsed
                    open={openNavSection === 'chats'}
                    onOpenChange={handleNavSectionChange('chats')}
                    onCollapsedIconClick={() => expandFromRail('chats')}
                    tenantKey={tenantKey}
                    mentorId={mentorId}
                    username={username}
                  />
                </>
              )}

              {projectsAllowed && (
                <SidebarProjectsSection
                  collapsed
                  tenantKey={tenantKey}
                  username={username}
                  open={openNavSection === 'projects'}
                  onOpenChange={handleNavSectionChange('projects')}
                  onNavigate={onAfterNav}
                  onCollapsedIconClick={() => expandFromRail('projects')}
                />
              )}

              {analyticsAllowed && (
                <SidebarNavCollapsibleSection
                  collapsed
                  menu={analyticsMenu}
                  open={openNavSection === 'analytics'}
                  onOpenChange={handleNavSectionChange('analytics')}
                  onItemSelect={handleAnalyticsMenuSelect}
                  onCollapsedIconClick={() => expandFromRail('analytics')}
                />
              )}
            </nav>
          ) : (
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
              <div className="space-y-0.5">
                {newChatAllowed && (
                  <div className="px-0 pb-0.5">
                    <button
                      type="button"
                      onClick={startNewChat}
                      className="inline-flex h-9 w-full cursor-pointer items-center justify-start gap-2 rounded-[8px] border border-[#e0e0e2] bg-white px-2 text-[14px] font-normal text-[#687482] antialiased transition-colors hover:bg-[#f8f8f9] active:bg-[#f2f2f3]"
                    >
                      <SquarePen
                        className="size-4 shrink-0"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <span>New Chat</span>
                    </button>
                  </div>
                )}

                {agentsMenu.items.length > 0 && (
                  <SidebarNavCollapsibleSection
                    collapsed={false}
                    menu={agentsMenu}
                    open={openNavSection === 'agents'}
                    onOpenChange={handleNavSectionChange('agents')}
                    onItemSelect={handleAgentMenuSelect}
                  />
                )}
                {workflowsMenu.items.length > 0 && (
                  <SidebarNavCollapsibleSection
                    collapsed={false}
                    menu={workflowsMenu}
                    open={openNavSection === 'workflows'}
                    onOpenChange={handleNavSectionChange('workflows')}
                    onItemSelect={handleWorkflowMenuSelect}
                  />
                )}

                {showChats && (
                  <>
                    <SidebarNavDivider />

                    <SidebarChatsSection
                      collapsed={false}
                      open={openNavSection === 'chats'}
                      onOpenChange={handleNavSectionChange('chats')}
                      tenantKey={tenantKey}
                      mentorId={mentorId}
                      username={username}
                    />
                  </>
                )}

                {projectsAllowed && (
                  <SidebarProjectsSection
                    collapsed={false}
                    tenantKey={tenantKey}
                    username={username}
                    open={openNavSection === 'projects'}
                    onOpenChange={handleNavSectionChange('projects')}
                    onNavigate={onAfterNav}
                  />
                )}

                {analyticsAllowed && (
                  <SidebarNavCollapsibleSection
                    collapsed={false}
                    menu={analyticsMenu}
                    open={openNavSection === 'analytics'}
                    onOpenChange={handleNavSectionChange('analytics')}
                    onItemSelect={handleAnalyticsMenuSelect}
                  />
                )}
              </div>
            </nav>
          )}

          {/* Footer — fully hidden in embed mode (minimal sidebar:
              only New Chat + chat history, matching the pre-rewrite UI). */}
          {!embedMode &&
            (railCollapsed ? (
              <div className="flex shrink-0 flex-col items-center gap-0.5 border-t border-[#e2e8f0] px-2 py-3">
                {footerActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <SidebarCollapsedLabelFlyout
                      key={action.id}
                      label={action.label}
                    >
                      <button
                        type="button"
                        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-[#5f5f61] transition-colors hover:bg-[#f0f0f0]"
                        aria-label={action.label}
                        onClick={() => handleFooterActionClick(action.id)}
                      >
                        <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                      </button>
                    </SidebarCollapsedLabelFlyout>
                  );
                })}
                <SidebarCollapsedLabelFlyout label={DOCUMENTATION_MENU.label}>
                  <a
                    href="https://ibl.ai/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-10 items-center justify-center rounded-lg text-[#5f5f61] transition-colors hover:bg-[#f0f0f0]"
                    aria-label={DOCUMENTATION_MENU.label}
                  >
                    <DOCUMENTATION_MENU.icon
                      className="size-4 shrink-0"
                      strokeWidth={1.5}
                    />
                  </a>
                </SidebarCollapsedLabelFlyout>
              </div>
            ) : (
              <div className="shrink-0 space-y-0.5 border-t border-[#e2e8f0] px-2 py-2">
                {footerActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] transition-colors hover:bg-[#f4f4f4]"
                      onClick={() => handleFooterActionClick(action.id)}
                    >
                      <Icon
                        className="size-4 shrink-0"
                        style={{ color: NAV_MUTED }}
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {action.label}
                      </span>
                    </button>
                  );
                })}
                <a
                  href="https://ibl.ai/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-[14px] font-normal text-[#5f5f61] transition-colors hover:bg-[#f4f4f4]"
                >
                  <DOCUMENTATION_MENU.icon
                    className="size-4 shrink-0"
                    style={{ color: NAV_MUTED }}
                    strokeWidth={1.5}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {DOCUMENTATION_MENU.label}
                  </span>
                </a>
              </div>
            ))}
        </aside>
      </Sidebar>

      <AccountSheet
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
      />

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
      )}
    </SidebarNavCallbackContext.Provider>
  );
}

const ACCOUNT_TAB_TITLES: Record<AccountTab, string> = {
  organization: 'Organization',
  management: 'Management',
  integrations: 'Integrations',
  monetization: 'Monetization',
  advanced: 'Advanced',
  billing: 'Billing',
};

// Default subtitles the SDK's `Account` component shows under each
// section heading — copied verbatim so the standalone popups feel
// continuous with the SDK profile dialog.
const ACCOUNT_TAB_DESCRIPTIONS: Record<AccountTab, string> = {
  organization: 'Manage your organization settings.',
  management: 'Manage users and their permissions in the system.',
  integrations: 'Manage your integrations with other services.',
  monetization: 'Configure paywalls, pricing, and revenue.',
  advanced: 'Configure advanced organization settings.',
  billing: 'Manage your billing and subscription.',
};

/**
 * Renders one of the SDK's organization-level tab components in its
 * own dialog — `Admin` (Users), `IntegrationsTab` (API), `BillingTab`,
 * `MonetizationTab`, `AdvancedTab` (Settings). Each footer action opens
 * this dialog with a different `tab`; the body switches the SDK
 * component, so there's no shared tab rail and nothing to hide.
 *
 * `organization` doesn't have a sidebar footer entry today, but it's
 * defined for completeness so adding "Organization" later is a one-line
 * change.
 */
function AccountSheet({
  tab,
  onClose,
  tenantKey,
  username,
  email,
  onInviteClick,
}: {
  tab: AccountTab | null;
  onClose: () => void;
  tenantKey: string;
  username: string;
  email: string;
  onInviteClick: () => void;
}) {
  const open = tab !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/*
        Dimensions: width matches the SDK's `InviteUserDialog`
        (`sm:max-w-7xl w-[95vw]`). Height is PINNED to `h-[90vh]`
        (was `max-h-[90vh]`) so the dialog stays the same size as
        the user navigates between sub-tabs inside Management
        (Users → Groups → Roles → Policies) and Integrations. With
        `max-h`, an empty/short sub-tab made the dialog collapse to
        fit, then expand back when content loaded — felt jumpy.
        Pinning the outer height + keeping the inner scroll area
        (`flex-1 overflow-y-auto`) means the chrome is stable and
        all the variation happens inside the scroll region.
      */}
      <DialogContent className="mx-auto my-auto flex h-[90vh] w-[95vw] max-w-none flex-col justify-between gap-0 rounded-lg p-0 sm:max-w-7xl">
        <DialogHeader className="flex-shrink-0 border-b border-gray-200 p-4 pt-[30px]">
          <DialogTitle className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {tab ? ACCOUNT_TAB_TITLES[tab] : ''}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-gray-600">
            {tab ? ACCOUNT_TAB_DESCRIPTIONS[tab] : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === 'management' && (
            <Admin
              tenant={tenantKey}
              onInviteClick={onInviteClick}
              // RBAC is off for this entry point — admin users see every
              // sub-tab. Tenant-level access is already gated by the
              // sidebar (only admins reach the footer actions).
              hasUserTabPermission
              hasGroupsTabPermission
              hasRolesTabPermission
              hasPoliciesTabPermission
              hasTeamsTabPermission
              hasAlertsTabPermission
              hasInviteUserPermission
              hasCreateTeamPermission
              enableRbac={false}
              rbacPermissions={{}}
            />
          )}
          {tab === 'integrations' && (
            <IntegrationsTab tenantKey={tenantKey} username={username} />
          )}
          {tab === 'billing' && (
            <BillingTab
              tenant={tenantKey}
              username={username}
              mainPlatformKey={config.mainTenantKey()}
              currentUserEmail={email}
            />
          )}
          {tab === 'monetization' && (
            <MonetizationTab
              platformKey={tenantKey}
              authURL={config.authUrl()}
            />
          )}
          {tab === 'advanced' && (
            <AdvancedTab
              platformKey={tenantKey}
              username={username}
              currentSPA={config.iblPlatform() || 'mentor'}
              authURL={config.authUrl()}
              currentPlatformBaseDomain={config.platformBaseDomain()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
