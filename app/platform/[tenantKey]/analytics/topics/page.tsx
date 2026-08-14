'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsTopicsStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

export default function TenantTopicsPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsTopicsStats tenantKey={tenantKey} mentorId="" />;
}
