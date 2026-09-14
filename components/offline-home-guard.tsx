'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { isTauriApp } from '@/types/tauri';
import { getLastMentorRoute } from '@/hooks/use-tauri-offline';
import { useServiceWorker } from '@/components/service-worker-provider';

/**
 * Keeps the desktop (Tauri) app on the cached mentor home when the network drops.
 *
 * The offline app can only serve routes that were cached while online, so
 * navigating anywhere else offline would hit the service worker's "You're
 * offline" fallback. Instead, while offline we redirect any off-home navigation
 * back to the last cached mentor route and show a brief toast.
 *
 * Web builds and the online desktop app are unaffected — this only acts when
 * running in Tauri AND the live network status (from the SW provider's Tauri
 * network poll) reports offline.
 */
export function OfflineHomeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useServiceWorker();

  const offline = isTauriApp() && !status.isOnline;
  // Show the "you're offline" toast once per offline episode, not on every
  // blocked navigation; reset when connectivity returns.
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!offline) {
      toastShownRef.current = false;
      return;
    }

    const home = getLastMentorRoute();
    // Nothing was cached to fall back to — leave the user where they are rather
    // than bouncing to a route that can't load either.
    if (!home || !pathname) return;

    if (pathname !== home) {
      if (!toastShownRef.current) {
        toast.info("You're offline", {
          description:
            'Returning to your home page — it stays available offline.',
        });
        toastShownRef.current = true;
      }
      router.replace(home);
    }
  }, [offline, pathname, router]);

  return null;
}
