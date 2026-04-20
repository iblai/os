'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsAuditLogStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectSelectedMentor } from '@/features/analytics/slice';
import { useUsername } from '@/hooks/use-user';

export default function AuditLogPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();
  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;
  const username = useUsername();

  return (
    <AnalyticsAuditLogStats
      tenantKey={tenantKey}
      mentorId={mentorId}
      userId={username ?? ''}
      selectedMentorId={selectedMentorId}
    />
  );
}
