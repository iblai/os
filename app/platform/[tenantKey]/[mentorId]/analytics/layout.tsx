'use client';

import type React from 'react';
import { AnalyticsLayout } from '@iblai/iblai-js/web-containers';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';

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
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-ignore userId is not part of the query definition
      userId: ANONYMOUS_USERNAME,
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

  return (
    <AnalyticsLayout
      excludeTabs={excludeTabs}
      currentPath={pathname}
      basePath={basePath}
      onTabChange={handleTabChange}
    >
      {children}
    </AnalyticsLayout>
  );
}
