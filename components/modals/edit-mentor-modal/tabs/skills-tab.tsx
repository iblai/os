'use client';

import { useParams } from 'next/navigation';
import { AgentSkills } from '@iblai/web-containers';

import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function SkillsTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId) return null;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Skills</h3>
          <p className="text-xs text-gray-700">
            Manage agent skill assignments for your mentor.
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{ overflowY: 'auto', overflowX: 'hidden' }}
      >
        <AgentSkills platformKey={tenantKey} mentorUniqueId={activeMentorId} />
      </div>
    </>
  );
}
