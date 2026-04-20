'use client';

import { useParams } from 'next/navigation';
import { ClawConfigContent } from '@iblai/web-containers';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function ClawTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId) return null;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">CLAW</h3>
          <p className="text-xs text-gray-700">
            Configure CLAW agent settings for your mentor.
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 px-3 pt-3 pb-3 lg:px-4 lg:pt-4 lg:pb-4"
        style={{ overflowY: 'auto', overflowX: 'hidden' }}
      >
        <ClawConfigContent
          platformKey={tenantKey}
          mentorUniqueId={activeMentorId}
        />
      </div>
    </>
  );
}
