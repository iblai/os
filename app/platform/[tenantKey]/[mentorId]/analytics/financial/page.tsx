'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsFinancialStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { selectSelectedMentor } from '@/features/analytics/slice';

export default function FinancialPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();
  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;

  return (
    <AnalyticsFinancialStats
      tenantKey={tenantKey}
      mentorId={mentorId}
      selectedMentorId={selectedMentorId}
    />
  );
}
