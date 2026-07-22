'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useGetMentorSettingsQuery,
  useEditMentorMutation,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';

import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { CapabilityGate } from '../../capability-gate';
import { ManageMemories } from './manage-memories';

export function MemoryTab() {
  const t = useTranslations('memoryTabIndex');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentor } = useGetMentorSettingsQuery(
    // @ts-ignore userId is accepted at runtime
    { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
    { skip: !activeMentorId || !tenantKey || !username },
  );

  const [editMentor] = useEditMentorMutation();

  // "Remember past conversations" master toggle (`enable_memory_component`),
  // moved here from Settings → Capabilities. Optimistic local mirror so the
  // switch responds instantly.
  // @ts-ignore enable_memory_component exists on the API response but isn't typed
  const serverMemoryEnabled: boolean = mentor?.enable_memory_component ?? false;
  const [memoryEnabled, setMemoryEnabled] = useState(serverMemoryEnabled);
  const [isToggling, setIsToggling] = useState(false);
  useEffect(() => {
    setMemoryEnabled(serverMemoryEnabled);
  }, [serverMemoryEnabled]);

  const handleToggleMemory = async (checked: boolean) => {
    setMemoryEnabled(checked); // optimistic
    setIsToggling(true);
    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore userId is accepted at runtime
        userId: username ?? '',
        // @ts-ignore enable_memory_component is accepted at runtime but was dropped from MentorSettingsRequest in @iblai/iblai-js 1.26.x
        formData: { enable_memory_component: checked },
      }).unwrap();
      toast.success(t('toggleSuccess'));
    } catch {
      setMemoryEnabled(!checked); // roll back
      toast.error(t('toggleError'));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      <div className="flex h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('heading')}
          </h3>
          <p className="text-xs text-gray-600">{t('description')}</p>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-3 lg:p-4">
        <CapabilityGate
          title={t('capabilityTitle')}
          description={t('capabilityDescription')}
          offHint={t('capabilityOffHint')}
          enabled={memoryEnabled}
          onToggle={handleToggleMemory}
          disabled={isToggling}
          ariaLabel={t('capabilityTitle')}
          toggleTestId="memory-capability-toggle"
        >
          <div className="space-y-8">
            <ManageMemories
              tenantKey={tenantKey}
              username={username}
              mentorId={activeMentorId}
            />
          </div>
        </CapabilityGate>
      </div>
    </>
  );
}
