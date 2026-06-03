'use client';

import { useParams } from 'next/navigation';

import { ProjectsPage } from '@iblai/iblai-js/web-containers';
import type { Project } from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { TenantKeyMentorIdParams } from '@/lib/types';

export default function ProjectsRoute() {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { navigateToProject, navigateToMentorInProject } = useNavigate();
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  const handleOpenProject = (project: Project) => {
    const firstMentor = project.mentors?.[0];
    navigateToProject(String(project.id), firstMentor?.unique_id ?? '');
  };

  return (
    <ProjectsPage
      tenantKey={tenantKey ?? ''}
      username={username ?? ''}
      onOpenProject={handleOpenProject}
      navigateToMentorInProject={navigateToMentorInProject}
      executeWithTrialCheck={executeWithTrialCheck}
    />
  );
}
