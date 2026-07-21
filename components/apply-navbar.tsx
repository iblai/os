'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { NotificationDropdown } from '@iblai/iblai-js/web-containers';
import { UserProfile } from '@/app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile';
import { useCurrentTenant, useIsAdmin, useUsername } from '@/hooks/use-user';

/**
 * Top navigation bar for the standalone /apply flow. Shows the tenant name
 * (text, NOT the tenant logo) on the left, and the notification bell + profile
 * dropdown from the ibl.ai SDK on the right. Tenant/user context comes from
 * local storage, so it renders on a top-level route with no tenant/mentor
 * URL segments.
 */
export function ApplyNavbar() {
    const t = useTranslations('componentsApplyNavbar');
    const router = useRouter();
    const username = useUsername();
    const isAdmin = useIsAdmin();
    const { currentTenant } = useCurrentTenant();
    const tenantKey = currentTenant?.key ?? '';
    const orgName =
        currentTenant?.platform_name ||
        currentTenant?.name ||
        'American Faith Academy';

    const handleViewNotifications = useCallback(
        (notificationId?: string) => {
            if (!tenantKey) return;
            router.push(
                `/platform/${tenantKey}/notifications/${notificationId ?? ''}`,
            );
        },
        [router, tenantKey],
    );

    return (
        <header className="h-16 flex-shrink-0 border-b border-[var(--border-color,#d1d5db)] bg-[var(--navbar-bg,#fff)] md:h-20">
            <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Left: tenant name + context (no logo) */}
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-base font-semibold text-gray-900 md:text-lg">
                        {orgName}
                    </span>
                    <span className="shrink-0 text-sm text-gray-500">{t('application')}</span>
                </div>

                {/* Right: notification bell + profile dropdown */}
                <div className="flex items-center space-x-4">
                    {username && (
                        <NotificationDropdown
                            org={tenantKey}
                            userId={username}
                            isAdmin={isAdmin}
                            onViewNotifications={handleViewNotifications}
                        />
                    )}
                    <UserProfile />
                </div>
            </div>
        </header>
    );
}
