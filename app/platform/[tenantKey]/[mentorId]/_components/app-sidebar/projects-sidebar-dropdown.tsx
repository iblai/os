'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useUsername, useUserData } from '@/hooks/use-user';
import { useGetUserProjectsQuery } from '@iblai/iblai-js/data-layer';
import { ProjectPageParams } from '@/lib/types';
import { AuthPopover } from '@/components/auth-popover';
import { ProjectItem } from './project-item';
import { ProjectChatItem } from './project-chat-item';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';

const CreateProjectModal = dynamic(
  () => import('@/components/projects/create-project-modal').then((mod) => mod.CreateProjectModal),
  {
    ssr: false,
  },
);

const RenameProjectModal = dynamic(
  () => import('@/components/projects/rename-project-modal').then((mod) => mod.RenameProjectModal),
  {
    ssr: false,
  },
);

const DeleteProjectModal = dynamic(
  () => import('@/components/projects/delete-project-modal').then((mod) => mod.DeleteProjectModal),
  {
    ssr: false,
  },
);

export function ProjectsSidebarDropdown() {
  const { navigateToProject } = useNavigate();
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = React.useState(false);
  const [renameModalData, setRenameModalData] = React.useState<{
    isOpen: boolean;
    projectId: string;
    currentName: string;
  }>({ isOpen: false, projectId: '', currentName: '' });

  const [deleteModalData, setDeleteModalData] = React.useState<{
    isOpen: boolean;
    projectId: string;
    projectName: string;
  }>({ isOpen: false, projectId: '', projectName: '' });

  const { tenantKey, projectId, mentorId } = useParams<ProjectPageParams>();
  const username = useUsername();
  const userData = useUserData();
  const isLoggedIn = !!userData;

  const { data: projectsData } = useGetUserProjectsQuery(
    {
      tenantKey: tenantKey!,
      username: username!,
      params: {
        limit: 50,
      },
    },
    {
      skip: !username || !tenantKey,
    },
  );

  const projects = projectsData?.results || [];

  const handleSelectProject = (projectId: string, mentorUniqueId: string) => {
    navigateToProject(projectId, mentorUniqueId);
  };

  const handleRenameProject = (projectId: string, currentName: string) => {
    setRenameModalData({
      isOpen: true,
      projectId,
      currentName,
    });
  };

  const handleCloseRenameModal = () => {
    setRenameModalData({ isOpen: false, projectId: '', currentName: '' });
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setDeleteModalData({
      isOpen: true,
      projectId,
      projectName,
    });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalData({ isOpen: false, projectId: '', projectName: '' });
  };

  return (
    <>
      <div>
        {isLoggedIn ? (
          <Button
            variant="ghost"
            className={cn(
              'w-full gap-2 text-gray-700 hover:bg-[#c9d8f8] justify-start px-2 h-8',
              false && 'bg-blue-50 text-blue-600',
            )}
            onClick={() => executeWithTrialCheck(() => setIsCreateProjectModalOpen(true))}
          >
            <div className="flex items-center gap-2.5">
              <Image
                src="/icons/new-project.svg"
                alt="New Project"
                width={18}
                height={18}
                className="flex-shrink-0"
              />
              <span className="flex-1 text-left">New Project</span>
            </div>
          </Button>
        ) : (
          <AuthPopover tenantKey={tenantKey}>
            <Button
              variant="ghost"
              className={cn('w-full gap-2 text-gray-700 hover:bg-[#c9d8f8] justify-start px-2 h-8')}
            >
              <div className="flex items-center gap-2.5">
                <Image
                  src="/icons/new-project.svg"
                  alt="New Project"
                  width={18}
                  height={18}
                  className="flex-shrink-0"
                />
                <span className="flex-1 text-left">New Project</span>
              </div>
            </Button>
          </AuthPopover>
        )}
        <div className="ml-4 border-l border-[#D0E0FF] space-y-1">
          {projects.map((project) => (
            <div key={project.id}>
              <ProjectItem
                project={{ id: String(project.id), title: project.name }}
                isActive={projectId === String(project.id)}
                onClick={() =>
                  executeWithTrialCheck(() =>
                    handleSelectProject(String(project.id), project.mentors[0].unique_id),
                  )
                }
                isOpen={projectId === String(project.id)}
                onRename={(projectId, currentName) => {
                  executeWithTrialCheck(() => handleRenameProject(projectId, currentName));
                }}
                onDelete={(projectId, projectName) => {
                  executeWithTrialCheck(() => handleDeleteProject(projectId, projectName));
                }}
              />
              {projectId === String(project.id) && (
                <div className="ml-4 space-y-1 mt-1">
                  {project.mentors.map((mentor) => (
                    <ProjectChatItem
                      key={mentor.id}
                      title={mentor.name}
                      onClick={() =>
                        executeWithTrialCheck(() =>
                          handleSelectProject(String(project.id), mentor.unique_id),
                        )
                      }
                      isActive={mentor.unique_id === mentorId}
                      // @ts-ignore - profile_image is not in the Mentor type
                      avatar={mentor.profile_image}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {isCreateProjectModalOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
        />
      )}

      {renameModalData.isOpen && (
        <RenameProjectModal
          isOpen={renameModalData.isOpen}
          onClose={handleCloseRenameModal}
          projectId={renameModalData.projectId}
          currentName={renameModalData.currentName}
        />
      )}

      {deleteModalData.isOpen && (
        <DeleteProjectModal
          isOpen={deleteModalData.isOpen}
          onClose={handleCloseDeleteModal}
          projectId={deleteModalData.projectId}
          projectName={deleteModalData.projectName}
        />
      )}
    </>
  );
}
