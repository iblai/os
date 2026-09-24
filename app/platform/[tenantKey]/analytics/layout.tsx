'use client';

import type React from 'react';
import { AnalyticsLayout } from '@iblai/iblai-js/web-containers';
import { useParams, usePathname, useRouter } from 'next/navigation';

import PlatformLayout from '../../_components/platform-layout';

/**
 * Tenant-wide analytics — the same tabs as the per-agent
 * `[mentorId]/analytics` section, but with no agent in the URL, so every
 * container queries the whole tenant (the analytics hooks drop the
 * `mentor_unique_id` filter when no mentor id is passed).
 *
 * Unlike the per-agent section, nothing above this route supplies the platform
 * shell — the sibling top-level routes (explore, projects, notifications) each
 * re-export it as their own layout — so it wraps the tab strip here.
 */
export default function TenantAnalyticsLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantKey } = useParams<{ tenantKey: string }>();

  const basePath = `/platform/${tenantKey}/analytics`;

  const handleTabChange = (tabValue: string) => {
    const newPath = tabValue ? `${basePath}/${tabValue}` : basePath;
    router.push(newPath);
  };

  // Courses and programs have no route behind them in this SPA, same as the
  // per-agent section. Audit stays in: the mentor-scoped `view_audit_logs`
  // check has no mentor to run against here, so the API is the authority —
  // `AnalyticsAuditLogStats` renders its own "no permission" card on a 403.
  const excludeTabs = ['courses', 'programs'];

  return (
    <PlatformLayout>
      <AnalyticsLayout
        excludeTabs={excludeTabs}
        currentPath={pathname}
        basePath={basePath}
        onTabChange={handleTabChange}
        showPicker={true}
        tenantKey={tenantKey}
      >
        {children}
      </AnalyticsLayout>
    </PlatformLayout>
  );
}
