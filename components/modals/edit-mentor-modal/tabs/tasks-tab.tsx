'use client';

import { useParams } from 'next/navigation';
import {
  AgentSettingsProvider,
  AgentTasksTab,
} from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function TasksTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  // AgentTasksTab reads tenant/mentor/username from the nearest
  // AgentSettingsProvider (it has no direct props for them) and throws when
  // rendered outside one, so the provider is required here.
  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
    >
      <AgentTasksTab />
    </AgentSettingsProvider>
  );
}
