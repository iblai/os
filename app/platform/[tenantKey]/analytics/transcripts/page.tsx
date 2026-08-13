'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsTranscriptsStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

// Empty mentor id — tenant-wide transcripts, see the overview page.
export default function TenantTranscriptsPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsTranscriptsStats tenantKey={tenantKey} mentorId="" />;
}
