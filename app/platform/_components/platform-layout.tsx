'use client';

import { useEffect, useState } from 'react';

import AppLayout from './app-layout';

// CRITICAL: Converted from async server component to client component to fix blank screen in Tauri offline mode
// Server components that await cookies() block indefinitely when offline server can't provide server context
// Client-side cookie reading works in all environments (online, offline, Tauri)
export default function Page({ children }: { children: React.ReactNode }) {
  const [defaultOpen, setDefaultOpen] = useState<boolean>(false);

  useEffect(() => {
    // Read sidebar state from document.cookie on client side
    // This works in Tauri offline mode unlike server-side cookies() API
    const getCookie = (name: string): string | undefined => {
      if (typeof document === 'undefined') return undefined;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return undefined;
    };

    const sidebarState = getCookie('sidebar_state');
    setDefaultOpen(sidebarState === 'true');
  }, []);

  // Render with default state immediately to avoid blocking
  // The sidebar state will update after mount if a cookie exists
  // CRITICAL: Don't block children rendering on mount - this causes blank screen in Tauri offline mode
  return <AppLayout defaultOpen={defaultOpen}>{children}</AppLayout>;
}
