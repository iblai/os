'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsMemoryStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectSelectedMentor } from '@/features/analytics/slice';
import { useUsername } from '@/hooks/use-user';

export default function UsersPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();
  const username = useUsername();
  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;

  return (
    <AnalyticsMemoryStats tenantKey={tenantKey} mentorId={selectedMentorId} userId={username} />
  );
}
