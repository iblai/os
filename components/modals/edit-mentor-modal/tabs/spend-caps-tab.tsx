'use client';

import { useParams } from 'next/navigation';
import { AgentSpendCapsTab } from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function SpendCapsTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId) return null;

  return <AgentSpendCapsTab tenantKey={tenantKey} mentorId={activeMentorId} />;
}
