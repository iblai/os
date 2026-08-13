'use client';

import type React from 'react';
import { AnalyticsLayout } from '@iblai/iblai-js/web-containers';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { useUsername } from '@/hooks/use-user';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { AnalyticsScopeSwitch } from './_components/analytics-scope-switch';

// Tabs that exist under both `/{mentorId}/analytics` and the tenant-wide
// `/analytics`. Anything else (courses, programs — excluded here, no route
// behind them) falls back to the tenant overview rather than a 404.
const SHARED_TABS = [
  'users',
  'topics',
  'transcripts',
  'memory',
  'financial',
  'audit',
  'reports',
];

export default function AnalyticsLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  const basePath = `/platform/${tenantKey}/${mentorId}/analytics`;

  const handleTabChange = (tabValue: string) => {
    const newPath = tabValue ? `${basePath}/${tabValue}` : basePath;
    router.push(newPath);
  };

  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const username = useUsername();
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore userId is not part of the query definition
      userId: username ?? ANONYMOUS_USERNAME,
    },
    {
      skip: !mentorId || !tenantKey,
    },
  );

  const mentorDbId = mentorPublicSettings?.mentor_id;
  const canViewAuditLogs =
    !!mentorDbId &&
    checkRbacPermission(
      rbacPermissions,
      `/mentors/${mentorDbId}/#view_audit_logs`,
    );

  const excludeTabs = ['courses', 'programs'];
  if (!canViewAuditLogs) {
    excludeTabs.push('audit');
  }

  // Carry the open tab across to the tenant-wide section, so switching scope
  // doesn't also throw the viewer back to the overview.
  const currentTab = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length + 1).split('/')[0]
    : '';
  const tenantTab = SHARED_TABS.includes(currentTab) ? currentTab : '';

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <AnalyticsLayout
        excludeTabs={excludeTabs}
        currentPath={pathname}
        basePath={basePath}
        onTabChange={handleTabChange}
      >
        {children}
      </AnalyticsLayout>
      {/* Floated over the tab strip's centre line: the strip is a single
          justify-between row owned by the SDK, so there is no slot between the
          tabs and Data Reports to render into. `pointer-events-none` keeps the
          overlay from swallowing tab clicks either side of the pill. */}
      <div className="pointer-events-none absolute inset-x-0 top-6 z-10 flex h-9 items-center justify-center px-6">
        <AnalyticsScopeSwitch
          tenantKey={tenantKey}
          tab={tenantTab}
          className="pointer-events-auto"
        />
      </div>
    </div>
  );
}
