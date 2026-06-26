'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ProjectsPage } from '@iblai/iblai-js/web-containers';
import type { Project } from '@iblai/iblai-js/data-layer';
import { useLazyGetUserProjectDetailsQuery } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { TenantKeyMentorIdParams } from '@/lib/types';

export default function ProjectsRoute() {
  const t = useTranslations('projectsPage');
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { navigateToProject, navigateToMentorInProject } = useNavigate();
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const [getProjectDetails] = useLazyGetUserProjectDetailsQuery();

  const handleOpenProject = async (project: Project) => {
    if (project.mentor_count === 0) {
      toast.error(t('projectHasNoAgents'));
      return;
    }

    let firstMentorId = project.mentors?.[0]?.unique_id ?? '';

    if (!firstMentorId) {
      try {
        const details = await getProjectDetails({
          tenantKey: tenantKey ?? '',
          username: username ?? '',
          id: project.id,
        }).unwrap();
        firstMentorId = details.mentors?.[0]?.unique_id ?? '';
      } catch {
        firstMentorId = '';
      }
    }

    if (!firstMentorId) {
      toast.error(t('couldNotOpenProject'));
      return;
    }

    navigateToProject(String(project.id), firstMentorId);
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
