'use client';

import type React from 'react';
import { AnalyticsLayout } from '@iblai/iblai-js/web-containers';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';

export default function AnalyticsLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  const basePath = `/platform/${tenantKey}/${mentorId}/analytics`;

  const handleTabChange = (tabValue: string) => {
    const newPath = tabValue ? `${basePath}/${tabValue}` : basePath;
    router.push(newPath);
  };

  return (
    <AnalyticsLayout excludeTabs={['courses', 'programs']} currentPath={pathname} basePath={basePath} onTabChange={handleTabChange}>
      {children}
    </AnalyticsLayout>
  );
}
