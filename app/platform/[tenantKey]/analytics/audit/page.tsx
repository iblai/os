'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsAuditLogStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';

// Empty mentor id: the log covers every agent in the tenant. The per-agent page
// gates on `/mentors/{id}/#view_audit_logs`, which has no tenant-wide
// counterpart, so authorization is left to the API — `AnalyticsAuditLogStats`
// renders a "no permission" card when the request comes back 403.
export default function TenantAuditLogPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();
  const username = useUsername();

  return (
    <AnalyticsAuditLogStats
      tenantKey={tenantKey}
      mentorId=""
      userId={username ?? ''}
    />
  );
}
