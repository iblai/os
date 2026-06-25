'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { NotificationDisplay } from '@iblai/iblai-js/web-containers';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { hideInitialLoader } from '@/lib/initial-loader';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  const params = useParams<{ tenantKey: string; notificationId: string }>();
  const username = useUsername();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    hideInitialLoader();
  }, []);

  const rbacPermissions = useAppSelector(selectRbacPermissions);

  return (
    <div className="h-full">
      <NotificationDisplay
        org={params.tenantKey}
        userId={username ?? ''}
        isAdmin={isAdmin}
        selectedNotificationId={params.notificationId}
        enableRbac={config.enableRBAC()}
        rbacPermissions={rbacPermissions}
        className="h-full"
      />
    </div>
  );
}
