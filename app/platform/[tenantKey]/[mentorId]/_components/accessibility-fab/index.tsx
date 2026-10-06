'use client';

import { useParams, usePathname } from 'next/navigation';

import { AccessibilityFab as SdkAccessibilityFab } from '@iblai/iblai-js/web-containers/next';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useAppSelector } from '@/lib/hooks';
import { selectActiveTab, selectChats } from '@iblai/iblai-js/web-utils';
import { cn } from '@/lib/utils';

export function AccessibilityFab() {
  const pathname = usePathname();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { metadata } = useTenantMetadata({ org: tenantKey });
  const isEmbedMode = useEmbedMode();
  const chats = useAppSelector(selectChats);
  const activeTab = useAppSelector(selectActiveTab);
  const messages = chats?.[activeTab] ?? [];

  const isAnalyticsPage = pathname?.includes('/analytics');
  const isAccessibilityMenuEnabled = metadata?.accessibility_menu;

  if (isEmbedMode) return null;

  if (!isAccessibilityMenuEnabled) return null;

  if (isAnalyticsPage) return null;

  return (
    <SdkAccessibilityFab
      defaultPositionClassName={cn(
        'fixed right-4 z-50 mb-10 flex flex-col gap-3',
        {
          'bottom-4': messages.length === 0,
          'bottom-[21rem]': messages.length > 0,
        },
      )}
    />
  );
}
