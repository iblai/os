'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsAuditLogStats } from '@iblai/iblai-js/web-containers';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectSelectedMentor } from '@/features/analytics/slice';
import { useUsername } from '@/hooks/use-user';
import { WithPermissions } from '@/hoc/withPermissions';
import { ANONYMOUS_USERNAME } from '@/lib/constants';

export default function AuditLogPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();
  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;
  const username = useUsername();

  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore userId is not part of the query definition
      userId: ANONYMOUS_USERNAME,
    },
    {
      skip: !mentorId || !tenantKey,
    },
  );

  const mentorDbId = mentorPublicSettings?.mentor_id;

  if (!mentorDbId) {
    return null;
  }

  return (
    <WithPermissions rbacResource={`/mentors/${mentorDbId}/#view_audit_logs`}>
      {({ hasPermission }) =>
        hasPermission ? (
          <AnalyticsAuditLogStats
            tenantKey={tenantKey}
            mentorId={mentorId}
            userId={username ?? ''}
            selectedMentorId={selectedMentorId}
          />
        ) : null
      }
    </WithPermissions>
  );
}
