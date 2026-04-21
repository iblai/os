/**
 * Tauri API Cache
 *
 * Provides localStorage-based caching for API responses when running in Tauri.
 * In offline mode, cached responses are returned instead of making network requests.
 */

import { isTauriApp } from '@/types/tauri';

const CACHE_PREFIX = 'tauri_api_cache_';
const CACHE_EXPIRY_KEY = 'tauri_api_cache_expiry_';
const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if we're in Tauri offline mode
 */
export function isTauriOfflineMode(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return false;
  if (!isTauriApp()) return false;
  return localStorage.getItem('tauri_offline_mode') === 'true';
}

/**
 * Generate a cache key from endpoint and params
 */
function getCacheKey(
  endpoint: string,
  params?: Record<string, unknown>,
): string {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${CACHE_PREFIX}${endpoint}_${paramStr}`;
}

/**
 * Get cached API response
 */
export function getCachedApiResponse<T>(
  endpoint: string,
  params?: Record<string, unknown>,
): T | null {
  if (typeof window === 'undefined') return null;
  if (!isTauriApp()) return null;

  const key = getCacheKey(endpoint, params);
  const expiryKey = `${CACHE_EXPIRY_KEY}${endpoint}_${params ? JSON.stringify(params) : ''}`;

  try {
    const cached = localStorage.getItem(key);
    const expiry = localStorage.getItem(expiryKey);

    if (!cached) return null;

    // Check if cache has expired (only when online)
    if (expiry && !isTauriOfflineMode()) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() > expiryTime) {
        // Cache expired, remove it
        localStorage.removeItem(key);
        localStorage.removeItem(expiryKey);
        return null;
      }
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('[TauriApiCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Set cached API response
 */
export function setCachedApiResponse<T>(
  endpoint: string,
  data: T,
  params?: Record<string, unknown>,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
): void {
  if (typeof window === 'undefined') return;
  if (!isTauriApp()) return;

  const key = getCacheKey(endpoint, params);
  const expiryKey = `${CACHE_EXPIRY_KEY}${endpoint}_${params ? JSON.stringify(params) : ''}`;

  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(expiryKey, String(Date.now() + ttlMs));
    console.log('[TauriApiCache] Cached response for:', endpoint);
  } catch (error) {
    console.error('[TauriApiCache] Error caching response:', error);
    // If storage is full, try to clear old cache entries
    clearOldCacheEntries();
  }
}

/**
 * Clear old cache entries when storage is full
 */
function clearOldCacheEntries(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(CACHE_EXPIRY_KEY)) {
        // Check if this entry is expired
        if (key.startsWith(CACHE_EXPIRY_KEY)) {
          const expiry = localStorage.getItem(key);
          if (expiry && Date.now() > parseInt(expiry, 10)) {
            keysToRemove.push(key);
            // Also remove the corresponding data key
            const dataKey = key.replace(CACHE_EXPIRY_KEY, CACHE_PREFIX);
            keysToRemove.push(dataKey);
          }
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log(
      '[TauriApiCache] Cleared',
      keysToRemove.length,
      'old cache entries',
    );
  } catch (error) {
    console.error('[TauriApiCache] Error clearing old cache:', error);
  }
}

/**
 * Clear all API cache
 */
export function clearApiCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(CACHE_EXPIRY_KEY)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    console.log('[TauriApiCache] Cleared all cache entries');
  } catch (error) {
    console.error('[TauriApiCache] Error clearing cache:', error);
  }
}

/**
 * Wrapper to fetch with caching for Tauri
 * When online: fetches from network and caches response
 * When offline: returns cached response
 */
export async function fetchWithCache<T>(
  endpoint: string,
  fetchFn: () => Promise<T>,
  params?: Record<string, unknown>,
  ttlMs?: number,
): Promise<T> {
  // If offline, return cached data
  if (isTauriOfflineMode()) {
    const cached = getCachedApiResponse<T>(endpoint, params);
    if (cached !== null) {
      console.log('[TauriApiCache] Returning cached response for:', endpoint);
      return cached;
    }
    throw new Error(`No cached data available for ${endpoint} in offline mode`);
  }

  // If online, fetch and cache
  try {
    const data = await fetchFn();
    setCachedApiResponse(endpoint, data, params, ttlMs);
    return data;
  } catch (error) {
    // If fetch fails, try to return cached data
    const cached = getCachedApiResponse<T>(endpoint, params);
    if (cached !== null) {
      console.log(
        '[TauriApiCache] Fetch failed, returning cached response for:',
        endpoint,
      );
      return cached;
    }
    throw error;
  }
}

/**
 * Cache key generators for common API endpoints
 */
export const CacheKeys = {
  mentorSettings: (org: string, mentor: string, userId: string) =>
    `mentor_settings_${org}_${mentor}_${userId}`,

  mentorPublicSettings: (org: string, mentor: string) =>
    `mentor_public_settings_${org}_${mentor}`,

  tenantMetadata: (org: string) => `tenant_metadata_${org}`,

  userTenants: (userId: string) => `user_tenants_${userId}`,

  sessionChats: (sessionId: string) => `session_chats_${sessionId}`,
} as const;

/**
 * Pre-cache common data for a mentor route
 * Call this when online to ensure data is available offline
 */
export async function preCacheMentorData(
  org: string,
  mentorId: string,
  userId: string,
  fetchMentorSettings: () => Promise<unknown>,
  fetchTenantMetadata: () => Promise<unknown>,
): Promise<void> {
  if (!isTauriApp()) return;

  console.log('[TauriApiCache] Pre-caching mentor data for:', {
    org,
    mentorId,
    userId,
  });

  try {
    // Cache in parallel
    await Promise.all([
      fetchWithCache(
        CacheKeys.mentorSettings(org, mentorId, userId),
        fetchMentorSettings,
        {
          org,
          mentor: mentorId,
          userId,
        },
      ).catch((e) =>
        console.warn('[TauriApiCache] Failed to cache mentor settings:', e),
      ),

      fetchWithCache(CacheKeys.tenantMetadata(org), fetchTenantMetadata, {
        org,
      }).catch((e) =>
        console.warn('[TauriApiCache] Failed to cache tenant metadata:', e),
      ),
    ]);

    console.log('[TauriApiCache] Pre-caching complete');
  } catch (error) {
    console.error('[TauriApiCache] Pre-caching failed:', error);
  }
}
