'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { isTauriApp } from '@/types/tauri';
import { useServiceWorker } from '@/components/service-worker-provider';

/**
 * Offline = chat only.
 *
 * When the desktop (Tauri) app loses connectivity, route navigation would hit
 * uncached routes and fail (the service worker's dead-end "offline" page). So we
 * BLOCK navigation entirely while offline and toast the user, keeping them on
 * the current chat page. We do NOT redirect — a redirect is itself a navigation
 * and can cause its own problems; the user simply stays put and can keep
 * chatting.
 *
 * Interception:
 *  - Primary: the Navigation API (`window.navigation` 'navigate' event) cancels
 *    push/replace/back/forward — this catches `router.push` (how the sidebar and
 *    nav bar navigate), plain `<Link>` clicks, and history traversal.
 *  - Fallback (webviews without the Navigation API): a capture-phase click
 *    interceptor blocks in-app `<a href>` navigations. (It cannot see
 *    programmatic `router.push`, which is why the Navigation API is preferred.)
 *
 * Web builds and the online desktop app are unaffected — this only acts when
 * running in Tauri AND the live network status reports offline. Reloads and
 * in-page hash changes are always allowed (reloading the cached page is fine).
 */
type NavigateEventLike = {
  navigationType?: string;
  hashChange?: boolean;
  downloadRequest?: unknown;
  cancelable?: boolean;
  preventDefault?: () => void;
};

type NavigationLike = {
  addEventListener: (
    type: 'navigate',
    cb: (e: NavigateEventLike) => void,
  ) => void;
  removeEventListener: (
    type: 'navigate',
    cb: (e: NavigateEventLike) => void,
  ) => void;
};

export function OfflineNavigationGuard() {
  const { status } = useServiceWorker();

  // Live offline flag read inside the (once-installed) listeners.
  const offlineRef = useRef(false);
  offlineRef.current = isTauriApp() && !status.isOnline;

  // Throttle the toast so a rapid click doesn't stack duplicates.
  const lastToastRef = useRef(0);

  useEffect(() => {
    if (!isTauriApp()) return;

    const notifyOffline = () => {
      const now = Date.now();
      if (now - lastToastRef.current < 3000) return;
      lastToastRef.current = now;
      toast.info("You're offline", {
        description:
          'Navigation is unavailable offline — you can keep chatting.',
      });
    };

    const navigation = (window as unknown as { navigation?: NavigationLike })
      .navigation;

    if (navigation && typeof navigation.addEventListener === 'function') {
      const onNavigate = (event: NavigateEventLike) => {
        if (!offlineRef.current) return;
        // Allow reloading the current (cached) page and in-page hash jumps.
        if (event.navigationType === 'reload' || event.hashChange) return;
        if (event.downloadRequest) return;
        // Cross-document navigations aren't cancelable; SPA route changes are.
        if (
          event.cancelable === false ||
          typeof event.preventDefault !== 'function'
        )
          return;
        event.preventDefault();
        notifyOffline();
      };
      navigation.addEventListener('navigate', onNavigate);
      return () => navigation.removeEventListener('navigate', onNavigate);
    }

    // Fallback: block in-app anchor navigations before the router sees the click.
    const onClickCapture = (event: MouseEvent) => {
      if (!offlineRef.current) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      const href = anchor.getAttribute('href') || '';
      const inApp =
        href.startsWith('/') || href.startsWith(window.location.origin);
      if (!inApp) return;
      event.preventDefault();
      event.stopPropagation();
      notifyOffline();
    };
    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, []);

  return null;
}
