'use client';

import { useParams } from 'next/navigation';
import { AgentScreenShareTab } from '@iblai/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function ScreenShareTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  return (
    <AgentScreenShareTab
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
    />
  );
}
