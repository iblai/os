'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsOverview } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

// An empty mentor id is the containers' tenant-wide mode: the analytics hooks
// drop the `mentor_unique_id` filter, so the overview covers every agent.
export default function TenantAnalyticsPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsOverview tenantKey={tenantKey} mentorId="" />;
}
