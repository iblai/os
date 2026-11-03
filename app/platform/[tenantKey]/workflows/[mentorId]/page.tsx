'use client';

import { useParams, useRouter } from 'next/navigation';

import { WorkflowsList } from '@iblai/iblai-js/web-containers/next';
import { TenantKeyMentorIdParams } from '@/lib/types';

export default function WorkflowsPage() {
  const router = useRouter();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  return (
    <WorkflowsList
      tenantKey={tenantKey}
      mentorId={mentorId}
      onOpenWorkflow={(workflow) =>
        router.push(
          `/platform/${tenantKey}/workflows/${workflow.entry_mentor_id}/${workflow.unique_id}?listMentorId=${mentorId}`,
        )
      }
    />
  );
}
