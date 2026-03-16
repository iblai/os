'use client';

import { useParams, usePathname } from 'next/navigation';

import { FloatingAccessibilityButton } from '@/components/accessibility/floating-accessibility-button';
import { AccessibilityToolbar } from '@/components/accessibility/accessibility-toolbar';
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
    <>
      <div
        className={cn('fixed right-4 flex flex-col gap-3 z-50 mb-10', {
          'bottom-4': messages.length === 0,
          'bottom-[21rem]': messages.length > 0,
        })}
      >
        {/* <FloatingMicrophoneButton /> */}
        <FloatingAccessibilityButton />
      </div>
      <AccessibilityToolbar />
    </>
  );
}
