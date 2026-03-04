'use client';

import { useParams } from 'next/navigation';
import { NotificationDisplay } from '@iblai/iblai-js/web-containers';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { config } from '@/lib/config';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  const params = useParams<{ tenantKey: string; notificationId: string }>();
  const username = useUsername();
  const isAdmin = useIsAdmin();

  const rbacPermissions = useAppSelector(selectRbacPermissions);

  return (
    <div className="h-full">
      <NotificationDisplay
        org={params.tenantKey}
        userId={username ?? ''}
        isAdmin={isAdmin}
        enableRbac={config.enableRBAC()}
        rbacPermissions={rbacPermissions}
        selectedNotificationId={params.notificationId}
        className="h-full"
      />
    </div>
  );
}
