'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SandboxConfig } from '@iblai/iblai-js/web-containers';
import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function SandboxTab() {
  const t = useTranslations('tabsSandboxTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId) return null;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('heading')}
          </h3>
          <p className="text-xs text-gray-700">{t('description')}</p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{ overflowY: 'auto', overflowX: 'hidden' }}
      >
        {/* The SDK component owns sandbox-kind selection (computational
            runtime / virtual machine / claw, with claw superseding the other
            two) and the claw connection flow, persisting flags itself. */}
        <SandboxConfig
          platformKey={tenantKey}
          mentorUniqueId={activeMentorId}
          username={username}
        />
      </div>
    </>
  );
}
