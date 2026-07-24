'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SandboxConfig } from '@iblai/iblai-js/web-containers';
import {
  useGetMentorSettingsQuery,
  useEditMentorMutation,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { CapabilityGate } from '../capability-gate';

export function SandboxTab() {
  const t = useTranslations('tabsSandboxTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentor } = useGetMentorSettingsQuery(
    // @ts-ignore userId is accepted at runtime
    { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
    { skip: !activeMentorId || !tenantKey || !username },
  );

  const [editMentor] = useEditMentorMutation();

  // "Dedicated sandbox" master toggle (`enable_claw`), moved here from
  // Settings → Capabilities. Optimistic local mirror so the switch responds
  // instantly. The SandboxConfig UI below handles connecting to an instance.
  // @ts-ignore enable_claw exists on the API response but isn't typed
  const serverClawEnabled: boolean = mentor?.enable_claw ?? false;
  const [clawEnabled, setClawEnabled] = useState(serverClawEnabled);
  const [isToggling, setIsToggling] = useState(false);
  useEffect(() => {
    setClawEnabled(serverClawEnabled);
  }, [serverClawEnabled]);

  const handleToggleClaw = async (checked: boolean) => {
    setClawEnabled(checked); // optimistic
    setIsToggling(true);
    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore userId is accepted at runtime
        userId: username ?? '',
        // @ts-ignore - enable_claw exists on API but not typed
        formData: { enable_claw: checked },
      }).unwrap();
      toast.success(t('toggleSuccess'));
    } catch {
      setClawEnabled(!checked); // roll back
      toast.error(t('toggleError'));
    } finally {
      setIsToggling(false);
    }
  };

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
        <CapabilityGate
          title={t('capabilityTitle')}
          description={t('capabilityDescription')}
          offHint={t('capabilityOffHint')}
          enabled={clawEnabled}
          onToggle={handleToggleClaw}
          disabled={isToggling}
          ariaLabel={t('capabilityTitle')}
          toggleTestId="sandbox-capability-toggle"
        >
          <SandboxConfig
            platformKey={tenantKey}
            mentorUniqueId={activeMentorId}
          />
        </CapabilityGate>
      </div>
    </>
  );
}
