'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { NotificationDisplay } from '@iblai/iblai-js/web-containers';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';

// Prevent static generation - this page uses browser APIs
export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  const params = useParams<{ tenantKey: string }>();
  const searchParams = useSearchParams();
  const username = useUsername();
  const isAdmin = useIsAdmin();

  const notificationId = searchParams.get('notificationId') || undefined;
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  return (
    <div className="h-full">
      <NotificationDisplay
        org={params.tenantKey}
        userId={username ?? ''}
        isAdmin={isAdmin}
        selectedNotificationId={notificationId}
        enableRbac={config.enableRBAC()}
        rbacPermissions={rbacPermissions}
        className="h-full"
      />
    </div>
  );
}
