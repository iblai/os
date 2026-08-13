'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsFinancialStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';

// Empty mentor id — tenant-wide costs, see the overview page.
export default function TenantFinancialPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();

  return <AnalyticsFinancialStats tenantKey={tenantKey} mentorId="" />;
}
