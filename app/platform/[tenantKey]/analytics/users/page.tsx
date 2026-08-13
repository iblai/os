'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsUsersStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

// Empty mentor id — tenant-wide user stats, see the overview page.
export default function TenantUsersPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsUsersStats tenantKey={tenantKey} mentorId="" />;
}
