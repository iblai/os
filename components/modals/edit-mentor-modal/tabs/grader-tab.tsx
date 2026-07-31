'use client';

import { useParams } from 'next/navigation';

import {
  AgentGraderTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';

import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function GraderTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the typed args but the API accepts it
      userId: username ?? '',
    },
    { skip: !activeMentorId || !tenantKey || !username },
  );

  // The grader endpoints (`/mentors/{id}/grader-config/…`) are keyed by the
  // mentor's UUID, so the provider's mentorId must be the mentor's unique_id
  // (not the slug). The URL param already is the unique_id in the standard
  // navigation flow — the settings lookup covers mentors reached otherwise.
  const mentorUniqueId =
    mentorSettings?.mentor_unique_id ?? activeMentorId ?? '';

  if (!tenantKey || !activeMentorId || !username) return null;

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={mentorUniqueId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={executeWithTrialCheck}
    >
      {/*
       * The backend does not expose the grader RBAC resources yet
       * (graderconfigurations / gradercriteria), so the permission tree has
       * no entries for them and the SDK's in-tab checks would read every
       * absence as a denial — hiding all affordances and rendering the
       * denied state for everyone. Force the checks off until the
       * permissions land; the tab itself is admin-only via its segment
       * (see hooks/use-mentor-segments.ts), and a server 403 still renders
       * the SDK's graceful denied state independent of this flag.
       */}
      <AgentGraderTab enableRBAC={false} />
    </AgentSettingsProvider>
  );
}
