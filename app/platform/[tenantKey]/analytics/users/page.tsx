'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsUsersStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

export default function TenantUsersPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsUsersStats tenantKey={tenantKey} mentorId="" />;
}
