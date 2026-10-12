'use client';

import { useParams } from 'next/navigation';
import {
  AgentMemoryTab,
  AgentSettingsProvider,
} from '@iblai/iblai-js/web-containers/next';
import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';

import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * OS wiring for the SDK's `AgentMemoryTab`. Copy comes from the SDK's own
 * i18n catalog (bridged via WebContainersLocaleProvider), so no labels are
 * passed.
 */
export function MemoryTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
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

  // The shared-memory endpoints (`/mentors/{id}/agent-memories/…`) are keyed
  // by the mentor's UUID, so the provider's mentorId must be the unique_id, not
  // the slug — the settings lookup covers mentors reached by slug.
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
    >
      <AgentMemoryTab />
    </AgentSettingsProvider>
  );
}
