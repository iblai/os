'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AgentSkills } from '@iblai/iblai-js/web-containers';
import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function SkillsTab() {
  const t = useTranslations('tabsSkillsTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  // The mentor DB id keys the RBAC grants (`/mentors/{dbId}/`) the SDK panel
  // gates its skill-assignment reads/writes on. Same query + args as
  // `useMentorSegments` (which the hosting modal always runs to render its
  // tabs) and GraderTab, so this is an RTK cache read — no extra request.
  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the typed args but the API accepts it
      userId: username ?? '',
    },
    { skip: !activeMentorId || !tenantKey || !username },
  );
  // @ts-ignore mentor_id exists on the settings response but isn't typed
  const mentorDbId = mentorSettings?.mentor_id as number | undefined;

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
        <div
          className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
          data-testid="skills-info-box"
        >
          {t('infoBox')}
        </div>
        <AgentSkills
          platformKey={tenantKey}
          mentorUniqueId={activeMentorId}
          // @ts-ignore mentorDbId ships in @iblai/web-containers > 1.19.0
          mentorDbId={mentorDbId}
        />
      </div>
    </>
  );
}
