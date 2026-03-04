'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsReports } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';

import { selectSelectedMentor } from '@/features/analytics/slice';
import { config } from '@/lib/config';

export default function ReportsPage() {
  const { tenantKey, mentorId } = useParams<{
    tenantKey: string;
    mentorId: string;
  }>();

  const selectedMentorInfo = useSelector(selectSelectedMentor);
  const selectedMentorId = selectedMentorInfo?.unique_id || mentorId;
  const disabledAnalyticsReports = (config.disabledAnalyticsReports() || '').split('|');

  return (
    <AnalyticsReports
      tenantKey={tenantKey}
      selectedMentorId={selectedMentorId}
      disabledReports={disabledAnalyticsReports}
    />
  );
}
