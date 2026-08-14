'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsReports } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

import { config } from '@/lib/config';

// Empty mentor id: `useReports` drops the `mentor_id` filter, so the list is
// the tenant's reports rather than one agent's.
export default function TenantReportsPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  const disabledAnalyticsReports = (
    config.disabledAnalyticsReports() || ''
  ).split('|');

  return (
    <AnalyticsReports
      tenantKey={tenantKey}
      selectedMentorId=""
      disabledReports={disabledAnalyticsReports}
    />
  );
}
