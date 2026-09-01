'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

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
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { cn, isLoggedIn, redirectToLogin } from '@/lib/utils';

import { SdkProject, useSidebarProjects } from './use-sidebar-projects';

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

export function SidebarProjectsSection({
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

  const { projects, isFetching, hasMore, scrollRef, onScroll } =
    useSidebarProjects({ tenantKey, username, open, collapsed });

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

  const t = useTranslations('appSidebarIndex');

  const openProject = (projectId: string) => {
    const href = projectHref(projectId);
    if (!href) {
      toast(t('addAgentToProjectFirst'));
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
            <span className="min-w-0 flex-1 truncate">{t('projects')}</span>
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
                  <span className="min-w-0 flex-1 truncate">
                    {t('newProject')}
                  </span>
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
            </ul>
            {projects.length === 0 ? (
              <span className="block px-2 py-1.5 text-[13px] text-[#94a3b8] italic">
                {t('noProjectsYet')}
              </span>
            ) : (
              <ul
                ref={scrollRef}
                className="scrollbar-thin flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto"
                role="list"
                onScroll={onScroll}
                data-testid="sidebar-projects-scroll"
              >
                {projects.map((p) => {
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
                          title={p.name ?? t('untitledProject')}
                        >
                          <Folder
                            className="size-3.5 shrink-0 opacity-70"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {p.name ?? t('untitledProject')}
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
                              aria-label={t('projectActions')}
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
                              {t('rename')}
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
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  );
                })}
                {isFetching && hasMore && (
                  <li
                    role="status"
                    aria-label={t('loadingMoreProjects')}
                    className="flex items-center justify-center py-2"
                  >
                    <Loader2
                      className="size-3.5 shrink-0 animate-spin text-[#7d7e82]"
                      aria-hidden
                    />
                  </li>
                )}
              </ul>
            )}
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
  const t = useTranslations('appSidebarIndex');
  return (
    <HoverCard openDelay={180} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={onIconClick}
          className="text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] transition-colors outline-none hover:bg-[#f0f0f0] focus-visible:ring-2 focus-visible:ring-[#c4c4c8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
          aria-label={t('projects')}
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
            {t('projects')}
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
              {t('newProject')}
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
                {t('noProjectsYet')}
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
                    title={p.name ?? t('untitledProject')}
                  >
                    <Folder
                      className="size-3.5 shrink-0 opacity-70"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {p.name ?? t('untitledProject')}
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
