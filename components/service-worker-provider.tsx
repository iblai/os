'use client';

import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
} from 'react';
import { toast } from 'sonner';
import {
  initServiceWorker,
  onUpdate,
  onStatusChange,
  skipWaiting,
  clearAllCaches,
  getCacheStatus,
  getServiceWorkerStatus,
  setTauriMode,
  setOfflineStatus,
  type ServiceWorkerStatus,
} from '@/lib/register-sw';
import { isTauriApp, TAURI_COMMANDS } from '@/types/tauri';
// CRITICAL: Eagerly import Tauri API to bundle it inline instead of lazy-loading
// webpackMode: "eager" prevents creating a separate chunk (7427.js)
// This ensures the code is in the main bundle and always available offline
let tauriInvoke: ((cmd: string) => Promise<boolean>) | null = null;
if (typeof window !== 'undefined' && isTauriApp()) {
  import(/* webpackMode: "eager" */ '@tauri-apps/api/core')
    .then((tauriCore) => {
      tauriInvoke = tauriCore.invoke;
      console.log(
        '[ServiceWorkerProvider] Tauri API loaded eagerly (bundled inline)',
      );
    })
    .catch((e) => {
      console.warn('[ServiceWorkerProvider] Failed to load Tauri API:', e);
    });
}

// localStorage key set by the Tauri offline shell
const TAURI_OFFLINE_MODE_KEY = 'tauri_offline_mode';

/**
 * Check if the shell has marked us as offline
 */
function isShellOfflineMode(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return false;
  return localStorage.getItem(TAURI_OFFLINE_MODE_KEY) === 'true';
}

interface ServiceWorkerContextValue {
  status: ServiceWorkerStatus;
  applyUpdate: () => void;
  clearCache: () => void;
  refreshCacheStatus: () => Promise<Record<string, number> | null>;
  checkNetworkNow: () => Promise<boolean>;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextValue | null>(
  null,
);

export function useServiceWorker() {
  const context = useContext(ServiceWorkerContext);
  if (!context) {
    throw new Error(
      'useServiceWorker must be used within ServiceWorkerProvider',
    );
  }
  return context;
}

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
}

export function ServiceWorkerProvider({
  children,
}: ServiceWorkerProviderProps) {
  // Get initial status, considering the shell's offline flag
  const [status, setStatus] = useState<ServiceWorkerStatus>(() => {
    const baseStatus = getServiceWorkerStatus();
    // If in Tauri and shell says we're offline, use that
    if (isTauriApp() && isShellOfflineMode()) {
      return { ...baseStatus, isOnline: false };
    }
    return baseStatus;
  });

  useEffect(() => {
    // Detect if running in Tauri
    const isTauri = isTauriApp();
    const shellOffline = isShellOfflineMode();

    // Skip service worker registration in Tauri offline mode
    // The offline server handles all requests, SW is not needed and will fail to register
    if (isTauri && shellOffline) {
      console.log(
        '[ServiceWorkerProvider] Skipping SW registration - Tauri offline mode',
      );
      setStatus({
        isSupported: false,
        isRegistered: false,
        isOnline: false,
        registration: null,
        updateAvailable: false,
      });
      return;
    }

    // Initialize service worker
    initServiceWorker().then((initialStatus) => {
      // If shell says offline, override the status
      if (isTauri && shellOffline) {
        setStatus({ ...initialStatus, isOnline: false });
      } else {
        setStatus(initialStatus);
      }

      // After SW is ready, tell it if we're in Tauri
      if (isTauri) {
        // Small delay to ensure SW controller is ready
        setTimeout(() => {
          setTauriMode(true);
          // Set initial offline status from shell flag or navigator
          setOfflineStatus(shellOffline || !navigator.onLine);
        }, 100);
      }
    });

    // Subscribe to updates
    const unsubscribeUpdate = onUpdate(() => {
      toast.info('App update available', {
        description: 'A new version is ready. Click to update.',
        duration: 10000,
        action: {
          label: 'Update',
          onClick: () => {
            skipWaiting();
          },
        },
      });
    });

    // Subscribe to status changes (for state updates only, no toasts)
    const unsubscribeStatus = onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // If in Tauri, use native network check instead of unreliable browser events
    let networkCheckInterval: ReturnType<typeof setInterval> | undefined;
    let offlineHandler: (() => void) | undefined;
    let onlineHandler: (() => void) | undefined;

    if (isTauri) {
      const checkNetworkStatus = async () => {
        try {
          // Use pre-loaded invoke function if available
          if (!tauriInvoke) {
            const tauriCore = await import(
              /* webpackMode: "eager" */ '@tauri-apps/api/core'
            );
            tauriInvoke = tauriCore.invoke;
          }
          const isOnline = (await tauriInvoke(
            TAURI_COMMANDS.CHECK_NETWORK_STATUS,
          )) as boolean;

          setStatus((prev) => {
            if (prev.isOnline !== isOnline) {
              console.log(
                '[ServiceWorkerProvider] Network status changed:',
                isOnline ? 'online' : 'offline',
              );
              // Notify service worker of the change
              setOfflineStatus(!isOnline);
              return { ...prev, isOnline };
            }
            return prev;
          });
        } catch (error) {
          // CRITICAL: Catch chunk load errors silently
          // If we're offline and the Tauri chunk can't load, just skip network checks
          // The error object has a 'name' property for ChunkLoadError
          if (
            error &&
            typeof error === 'object' &&
            'name' in error &&
            error.name === 'ChunkLoadError'
          ) {
            console.warn(
              '[ServiceWorkerProvider] Tauri API chunk not available (offline), disabling network checks',
            );
            // Clear the interval to stop trying
            if (networkCheckInterval) {
              clearInterval(networkCheckInterval);
              networkCheckInterval = undefined;
            }
          } else {
            console.error(
              '[ServiceWorkerProvider] Failed to check network status:',
              error,
            );
          }
        }
      };

      // Don't check immediately - wait for the interval to avoid chunk load issues at startup
      // networkCheckInterval will handle the first check after 3 seconds
      // Poll every 3 seconds for network status changes (faster detection)
      networkCheckInterval = setInterval(checkNetworkStatus, 3000);

      // Also listen to browser offline/online events for immediate feedback
      offlineHandler = () => {
        console.log('[ServiceWorkerProvider] Browser offline event fired');
        setStatus((prev) => {
          if (prev.isOnline) {
            setOfflineStatus(true);
            return { ...prev, isOnline: false };
          }
          return prev;
        });
        // Double-check with Tauri after a short delay
        setTimeout(checkNetworkStatus, 500);
      };

      onlineHandler = () => {
        console.log('[ServiceWorkerProvider] Browser online event fired');
        // Verify with Tauri before marking as online
        checkNetworkStatus();
      };

      window.addEventListener('offline', offlineHandler);
      window.addEventListener('online', onlineHandler);
    }

    return () => {
      unsubscribeUpdate();
      unsubscribeStatus();
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
      }
      if (offlineHandler) {
        window.removeEventListener('offline', offlineHandler);
      }
      if (onlineHandler) {
        window.removeEventListener('online', onlineHandler);
      }
    };
  }, []);

  const applyUpdate = useCallback(() => {
    skipWaiting();
  }, []);

  const clearCache = useCallback(() => {
    clearAllCaches();
    toast.success('Cache cleared', {
      description: 'All cached data has been cleared.',
    });
  }, []);

  const refreshCacheStatus = useCallback(async () => {
    return getCacheStatus();
  }, []);

  const checkNetworkNow = useCallback(async (): Promise<boolean> => {
    if (!isTauriApp()) {
      // In browser, use navigator.onLine (less reliable but it's what we have)
      return navigator.onLine;
    }

    try {
      // Use pre-loaded invoke function if available
      if (!tauriInvoke) {
        const tauriCore = await import(
          /* webpackMode: "eager" */ '@tauri-apps/api/core'
        );
        tauriInvoke = tauriCore.invoke;
      }
      const isOnline = (await tauriInvoke(
        TAURI_COMMANDS.CHECK_NETWORK_STATUS,
      )) as boolean;

      // Update state if changed
      setStatus((prev) => {
        if (prev.isOnline !== isOnline) {
          setOfflineStatus(!isOnline);
          return { ...prev, isOnline };
        }
        return prev;
      });

      return isOnline;
    } catch (error) {
      // CRITICAL: Catch chunk load errors and fall back to navigator.onLine
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ChunkLoadError'
      ) {
        console.warn(
          '[ServiceWorkerProvider] Tauri API chunk not available, using navigator.onLine',
        );
        return navigator.onLine;
      }
      console.error(
        '[ServiceWorkerProvider] Failed to check network status:',
        error,
      );
      return navigator.onLine; // Fallback to browser API
    }
  }, []);

  const value: ServiceWorkerContextValue = {
    status,
    applyUpdate,
    clearCache,
    refreshCacheStatus,
    checkNetworkNow,
  };

  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}
