'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { WorkflowEditor } from '@iblai/iblai-js/web-containers/next';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAxdToken } from '@/hooks/use-tokens';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import {
  disabledDatasetResourceTypes,
  maxDatasetFileSizeInMegaBytes,
  redirectToAuthSpa,
} from '@/lib/utils';

export default function WorkflowDetailPage() {
  const router = useRouter();
  const { tenantKey, mentorId, id } = useParams<{
    tenantKey: string;
    mentorId: string;
    id: string;
  }>();
  const searchParams = useSearchParams();
  const listMentorId = searchParams.get('listMentorId') || mentorId;
  const username = useUsername();
  const axdToken = useAxdToken();
  const { openEditMentorModal } = useNavigate();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  return (
    <WorkflowEditor
      tenantKey={tenantKey}
      workflowId={id}
      username={username ?? ''}
      axdToken={axdToken ?? ''}
      baseWsUrl={config.baseWsUrl()}
      redirectToAuthSpa={redirectToAuthSpa}
      onBack={() => router.back()}
      onDeleted={() =>
        router.push(`/platform/${tenantKey}/workflows/${listMentorId}`)
      }
      onOpenAgentSettings={(agentId) => openEditMentorModal(undefined, agentId)}
      agentSettings={{
        enableRBAC: config.enableRBAC(),
        rbacPermissions,
        executeGatedAction: executeWithTrialCheck,
        datasetResourceConfig: {
          disabledResourceTypes: disabledDatasetResourceTypes(),
          maxUploadSizeMb: maxDatasetFileSizeInMegaBytes(),
        },
      }}
    />
  );
}
