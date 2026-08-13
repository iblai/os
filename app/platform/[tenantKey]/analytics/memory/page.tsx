'use client';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

import { AnalyticsMemoryStats } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';

// Empty mentor id: the tab opens on global / all-agent memories, and its own
// agent search narrows to a single agent from there.
export default function TenantMemoryPage() {
  const { tenantKey } = useParams<{ tenantKey: string }>();
  const username = useUsername();

  return (
    <AnalyticsMemoryStats
      tenantKey={tenantKey}
      mentorId=""
      userId={username ?? ''}
    />
  );
}
