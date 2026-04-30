'use client';

import { useParams } from 'next/navigation';

import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { ManageMemories } from './manage-memories';

export function MemoryTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  return (
    <>
      <div className="flex h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Memory</h3>
          <p className="text-xs text-gray-600">
            Configure memory settings for your agent.
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-3 lg:p-4">
        <div className="space-y-8">
          <ManageMemories
            tenantKey={tenantKey}
            username={username}
            mentorId={activeMentorId}
          />
        </div>
      </div>
    </>
  );
}
