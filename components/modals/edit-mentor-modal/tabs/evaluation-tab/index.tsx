'use client';

import { useParams } from 'next/navigation';

import {
  AgentEvaluationTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';

import IblPagination from '@/components/ibl-pagination';
import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { getLLMProviderDetails } from '@/lib/utils';

export function EvaluationTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the typed args but the API accepts it
      userId: username ?? '',
    },
    { skip: !mentorId || !tenantKey || !username },
  );

  // AgentEvaluationTab filters runs by `meta.mentor_unique_id === mentorId`,
  // so the provider's mentorId must be the mentor's unique_id (not the slug).
  const mentorUniqueId = mentorSettings?.mentor_unique_id ?? mentorId ?? '';

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey ?? ''}
      mentorId={mentorUniqueId}
      username={username ?? ''}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={executeWithTrialCheck}
    >
      <AgentEvaluationTab
        getLLMProviderDetails={getLLMProviderDetails}
        PaginationComponent={IblPagination}
      />
    </AgentSettingsProvider>
  );
}
