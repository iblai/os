'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isTauriApp } from '@/types/tauri';

// localStorage keys for Tauri offline mode
const LAST_MENTOR_ROUTE_KEY = 'tauri_last_mentor_route';
const OFFLINE_MODE_KEY = 'tauri_offline_mode';
const CACHED_API_RESPONSES_KEY = 'tauri_cached_api_responses';

// Pattern to match mentor routes: /platform/<tenant>/<mentorId>
const MENTOR_ROUTE_PATTERN = /^\/platform\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;

export interface TauriOfflineState {
  isOffline: boolean;
  lastMentorRoute: string | null;
  isOnMentorRoute: boolean;
  currentTenantKey: string | null;
  currentMentorId: string | null;
}

/**
 * Hook to manage Tauri offline mode state
 * - Tracks the current mentor route in localStorage
 * - Detects offline mode from the shell
 * - Provides helpers for caching API responses
 */
export function useTauriOffline(): TauriOfflineState & {
  saveCurrentRoute: () => void;
  getCachedApiResponse: (key: string) => unknown | null;
  setCachedApiResponse: (key: string, data: unknown) => void;
  clearCachedApiResponses: () => void;
} {
  const pathname = usePathname();
  const isTauri = isTauriApp();

  // Check if we're in offline mode (set by the shell)
  const isOffline =
    isTauri &&
    typeof window !== 'undefined' &&
    localStorage.getItem(OFFLINE_MODE_KEY) === 'true';

  // Parse mentor route
  const routeMatch = pathname?.match(MENTOR_ROUTE_PATTERN);
  const isOnMentorRoute = !!routeMatch;
  const currentTenantKey = routeMatch ? routeMatch[1] : null;
  const currentMentorId = routeMatch ? routeMatch[2] : null;

  // Track if we've already saved this route to avoid repeated writes
  const lastSavedRoute = useRef<string | null>(null);

  // Get the last saved mentor route
  const lastMentorRoute =
    typeof window !== 'undefined'
      ? localStorage.getItem(LAST_MENTOR_ROUTE_KEY)
      : null;

  // Save the current route to localStorage (for offline mode to use)
  const saveCurrentRoute = useCallback(() => {
    if (!isTauri || typeof window === 'undefined') return;

    if (isOnMentorRoute && pathname) {
      // Only save if the route has changed
      if (lastSavedRoute.current !== pathname) {
        console.log('[TauriOffline] Saving mentor route:', pathname);
        localStorage.setItem(LAST_MENTOR_ROUTE_KEY, pathname);
        lastSavedRoute.current = pathname;

        // Trigger pre-caching via Tauri command
        triggerPrecache(pathname);
      }
    }
  }, [isTauri, isOnMentorRoute, pathname]);

  // Auto-save route when on mentor routes
  useEffect(() => {
    if (isTauri && isOnMentorRoute && pathname) {
      saveCurrentRoute();
    }
  }, [isTauri, isOnMentorRoute, pathname, saveCurrentRoute]);

  // Get a cached API response
  const getCachedApiResponse = useCallback(
    (key: string): unknown | null => {
      if (!isTauri || typeof window === 'undefined') return null;

      try {
        const cached = localStorage.getItem(CACHED_API_RESPONSES_KEY);
        if (!cached) return null;

        const responses = JSON.parse(cached) as Record<string, unknown>;
        return responses[key] ?? null;
      } catch (error) {
        console.error(
          '[TauriOffline] Error reading cached API response:',
          error,
        );
        return null;
      }
    },
    [isTauri],
  );

  // Cache an API response
  const setCachedApiResponse = useCallback(
    (key: string, data: unknown): void => {
      if (!isTauri || typeof window === 'undefined') return;

      try {
        const cached = localStorage.getItem(CACHED_API_RESPONSES_KEY);
        const responses = cached
          ? (JSON.parse(cached) as Record<string, unknown>)
          : {};

        responses[key] = data;

        // Limit cache size (keep last 100 entries)
        const keys = Object.keys(responses);
        if (keys.length > 100) {
          const keysToRemove = keys.slice(0, keys.length - 100);
          keysToRemove.forEach((k) => delete responses[k]);
        }

        localStorage.setItem(
          CACHED_API_RESPONSES_KEY,
          JSON.stringify(responses),
        );
      } catch (error) {
        console.error('[TauriOffline] Error caching API response:', error);
      }
    },
    [isTauri],
  );

  // Clear all cached API responses
  const clearCachedApiResponses = useCallback((): void => {
    if (!isTauri || typeof window === 'undefined') return;
    localStorage.removeItem(CACHED_API_RESPONSES_KEY);
  }, [isTauri]);

  return {
    isOffline,
    lastMentorRoute,
    isOnMentorRoute,
    currentTenantKey,
    currentMentorId,
    saveCurrentRoute,
    getCachedApiResponse,
    setCachedApiResponse,
    clearCachedApiResponses,
  };
}

/**
 * Save the mentor route via Tauri (persists across origins)
 */
async function saveMentorRouteToTauri(route: string): Promise<void> {
  if (!isTauriApp()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_last_mentor_route', { route });
    console.log('[TauriOffline] Saved route to Tauri:', route);
  } catch (error) {
    console.error('[TauriOffline] Failed to save route to Tauri:', error);
  }
}

/**
 * Trigger pre-caching of static assets via Tauri
 */
async function triggerPrecache(route: string): Promise<void> {
  if (!isTauriApp()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    // Save the route via Tauri command (persists across origins)
    await saveMentorRouteToTauri(route);

    // Use the current origin for caching (works in both dev and production)
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${appUrl}${route}`;

    console.log('[TauriOffline] Triggering pre-cache for:', fullUrl);

    const result = await invoke<{
      cached_count: number;
      failed_count: number;
      cached_urls: string[];
    }>('precache_app', { url: fullUrl });

    console.log('[TauriOffline] Pre-cache complete:', result);

    // After main precache completes, cache images from API responses
    // This caches external images (S3, Gravatar, etc.) referenced in mentor/user data
    console.log('[TauriOffline] Caching images from API responses...');
    const imageResult = await invoke<{
      cached_count: number;
      failed_count: number;
      cached_urls: string[];
    }>('cache_images');

    console.log(
      `[TauriOffline] Image cache complete: ${imageResult.cached_count} cached, ${imageResult.failed_count} failed`,
    );
  } catch (error) {
    console.error('[TauriOffline] Pre-cache failed:', error);
  }
}

/**
 * Check if we're being served from the offline server (localhost:3456)
 * This is the most reliable way to detect offline mode, as it works even before
 * Tauri initialization scripts run or localStorage is restored
 */
export function isOfflineServerOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin;
  return (
    origin === 'http://127.0.0.1:3456' || origin === 'http://localhost:3456'
  );
}

/**
 * Check if we're in Tauri offline mode
 * This is a simple utility that doesn't use hooks
 * Checks multiple indicators in order of reliability:
 * 1. Origin check (most reliable - works before any scripts run)
 * 2. Global variable (set by Tauri init script)
 * 3. localStorage flag
 */
export function isTauriOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;

  // First check: Are we being served from the offline server?
  // This is the most reliable check as it works before Tauri scripts run
  if (isOfflineServerOrigin()) {
    return true;
  }

  // For production origin, need additional checks
  if (!isTauriApp()) return false;

  // Check global variable (set by Tauri initialization script)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).__TAURI_OFFLINE_MODE__ === true) {
    return true;
  }

  // Fallback to localStorage
  if (typeof localStorage?.getItem !== 'function') return false;
  return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
}

/**
 * Get the last saved mentor route (for use in the shell)
 */
export function getLastMentorRoute(): string | null {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return null;
  return localStorage.getItem(LAST_MENTOR_ROUTE_KEY);
}
