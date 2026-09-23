'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsOverview } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

export default function TenantAnalyticsPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsOverview tenantKey={tenantKey} mentorId="" />;
}
