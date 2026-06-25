'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsUsersStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectSelectedMentor } from '@/features/analytics/slice';

export default function UsersPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();
  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;

  return (
    <AnalyticsUsersStats
      tenantKey={tenantKey}
      mentorId={mentorId}
      selectedMentorId={selectedMentorId}
    />
  );
}
