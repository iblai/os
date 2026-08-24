'use client';

import { AnalyticsAuditLogStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function AuditLogTab() {
  const t = useTranslations('tabsAuditLogTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const currentMentorId = getMentorId() || mentorId;

  return (
    <div className="flex h-full flex-col">
      <div className="hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:flex">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('heading')}
          </h3>
          <p className="text-xs text-gray-700">{t('description')}</p>
        </div>
      </div>
      <div className="scrollbar-hide flex-1 overflow-y-auto p-4">
        <div
          className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
          data-testid="audit-info-box"
        >
          {t('infoBox')}
        </div>
        <AnalyticsAuditLogStats
          tenantKey={tenantKey}
          mentorId={currentMentorId}
          userId={username ?? ''}
          selectedMentorId={currentMentorId}
        />
      </div>
    </div>
  );
}
