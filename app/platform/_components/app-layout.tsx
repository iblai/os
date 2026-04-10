'use client';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ModalContainer } from '@/components/modals/modal-container';
import { SubscriptionWrapper } from '../[tenantKey]/[mentorId]/_components/subscription-wrapper';
import { MonetizationWrapper } from '../[tenantKey]/[mentorId]/_components/monetization-wrapper';
import { HotKeysWrapper } from '../[tenantKey]/[mentorId]/_components/hot-keys-wrapper';
import { AppSidebar } from '../[tenantKey]/[mentorId]/_components/app-sidebar';
import { NavBar } from '../[tenantKey]/[mentorId]/_components/nav-bar';
import { AccessibilityProvider } from '@/contexts/accessibility-contexts';
import { AccessibilityFab } from '../[tenantKey]/[mentorId]/_components/accessibility-fab';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { useParams, useSearchParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { isTauriApp } from '@/types/tauri';
import {
  isTauriOfflineMode,
  isOfflineServerOrigin,
} from '@/hooks/use-tauri-offline';

import '../../accessibility.css';

interface AppLayoutProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function AppLayout({ children, defaultOpen }: AppLayoutProps) {
  const { mentorId: mentorIdFromParams, tenantKey: tenantKeyFromParams } =
    useParams<TenantKeyMentorIdParams>();
  const searchParams = useSearchParams();

  // Check if we're in compact mode (e.g., PIP window or embedded view)
  const isCompactMode = searchParams.get('compact') === 'true';

  // Check if we're in Tauri offline mode - hide sidebar and navbar
  const isTauriOffline =
    isOfflineServerOrigin() || (isTauriApp() && isTauriOfflineMode());

  const { isLoading: isMentorSettingsLoading } = useMentorSettings({
    mentorId: mentorIdFromParams,
    tenantKey: tenantKeyFromParams,
  });

  // CRITICAL: Don't block rendering in Tauri offline mode even if settings are loading
  // In offline mode, the page components handle missing data gracefully
  // Blocking here causes blank screen when cached data isn't available
  if (isMentorSettingsLoading && !isTauriOffline && !isCompactMode) {
    return null;
  }

  // In compact mode, render only the main content without sidebar, navbar, etc.
  // This is used for PIP windows and embedded views
  if (isCompactMode) {
    return (
      <main
        id="main-content-container"
        className="flex h-dvh flex-col overflow-hidden"
      >
        {children}
      </main>
    );
  }

  return (
    <>
      {/* Skip SubscriptionWrapper and MonetizationWrapper in offline mode - requires API calls */}
      {!isTauriOffline && <SubscriptionWrapper />}
      {!isTauriOffline && <MonetizationWrapper />}
      <SidebarProvider defaultOpen={defaultOpen}>
        <HotKeysWrapper />
        <AppSidebar />
        <SidebarInset asChild className="flex h-dvh flex-col overflow-hidden">
          <div>
            <NavBar />
            <main
              id="main-content-container"
              className="flex min-h-0 flex-1 flex-col"
            >
              {children}
            </main>
            <ModalContainer />
            <AccessibilityProvider>
              <AccessibilityFab />
            </AccessibilityProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
