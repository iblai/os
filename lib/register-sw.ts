/**
 * Service Worker Registration Helper
 *
 * Handles registration, updates, and communication with the service worker.
 */

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

type UpdateCallback = (registration: ServiceWorkerRegistration) => void;
type StatusChangeCallback = (status: ServiceWorkerStatus) => void;

let swRegistration: ServiceWorkerRegistration | null = null;
let updateAvailable = false;
const updateCallbacks: UpdateCallback[] = [];
const statusChangeCallbacks: StatusChangeCallback[] = [];

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Get current service worker status
 */
export function getServiceWorkerStatus(): ServiceWorkerStatus {
  return {
    isSupported: isServiceWorkerSupported(),
    isRegistered: swRegistration !== null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    registration: swRegistration,
    updateAvailable,
  };
}

/**
 * Notify all status change listeners
 */
function notifyStatusChange(): void {
  const status = getServiceWorkerStatus();
  statusChangeCallbacks.forEach((callback) => callback(status));
}

/**
 * Wait for the page to reach a fully loaded state.
 * Returns immediately if the page is already loaded.
 */
function waitForPageLoad(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

/**
 * Register the service worker.
 * Defers registration until the page is fully loaded to avoid
 * interfering with chunk loading — especially in WebKit/Safari where
 * early SW registration can cause ChunkLoadError timeouts.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.log('[SW Registration] Service workers not supported');
    return null;
  }

  // Wait for the page to be fully loaded before registering.
  // This prevents the service worker from intercepting in-flight
  // chunk requests during initial page load.
  await waitForPageLoad();

  try {
    // Get the base path from environment or default to empty
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const swUrl = `${basePath}/sw.js`;

    console.log('[SW Registration] Registering service worker:', swUrl);

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: basePath || '/',
    });

    swRegistration = registration;
    console.log('[SW Registration] Service worker registered successfully');

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New service worker is installed but waiting
            console.log('[SW Registration] New service worker available');
            updateAvailable = true;
            notifyStatusChange();
            updateCallbacks.forEach((callback) => callback(registration));
          }
        });
      }
    });

    // Check for updates periodically (every 1 hour)
    setInterval(
      () => {
        registration.update();
      },
      60 * 60 * 1000,
    );

    notifyStatusChange();
    return registration;
  } catch (error) {
    console.error('[SW Registration] Registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  try {
    const success = await swRegistration.unregister();
    if (success) {
      swRegistration = null;
      updateAvailable = false;
      notifyStatusChange();
      console.log('[SW Registration] Service worker unregistered');
    }
    return success;
  } catch (error) {
    console.error('[SW Registration] Unregistration failed:', error);
    return false;
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

/**
 * Tell service worker we're running in Tauri
 */
export function setTauriMode(isTauri: boolean): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_TAURI',
      data: isTauri,
    });
    console.log('[SW Registration] Set Tauri mode:', isTauri);
  }
}

/**
 * Tell service worker about offline status (from Tauri)
 */
export function setOfflineStatus(isOffline: boolean): void {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SET_OFFLINE',
      data: isOffline,
    });
    console.log('[SW Registration] Set offline status:', isOffline);
  }
}

/**
 * Request cache status from service worker
 */
export async function getCacheStatus(): Promise<Record<string, number> | null> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker.controller) {
      resolve(null);
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_STATUS') {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        resolve(event.data.status);
      }
    };

    navigator.serviceWorker.addEventListener('message', messageHandler);
    navigator.serviceWorker.controller.postMessage({
      type: 'GET_CACHE_STATUS',
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
      resolve(null);
    }, 5000);
  });
}

/**
 * Subscribe to service worker updates
 */
export function onUpdate(callback: UpdateCallback): () => void {
  updateCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = updateCallbacks.indexOf(callback);
    if (index > -1) {
      updateCallbacks.splice(index, 1);
    }
  };
}

/**
 * Subscribe to status changes (online/offline, registration, updates)
 */
export function onStatusChange(callback: StatusChangeCallback): () => void {
  statusChangeCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = statusChangeCallbacks.indexOf(callback);
    if (index > -1) {
      statusChangeCallbacks.splice(index, 1);
    }
  };
}

/**
 * Setup online/offline listeners
 */
export function setupNetworkListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    console.log('[SW Registration] Back online');
    notifyStatusChange();
  };

  const handleOffline = () => {
    console.log('[SW Registration] Gone offline');
    notifyStatusChange();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Initialize service worker and network listeners
 * Call this once when app loads
 */
export async function initServiceWorker(): Promise<ServiceWorkerStatus> {
  // Setup network listeners (cleanup is handled elsewhere)
  setupNetworkListeners();

  // Register service worker
  await registerServiceWorker();

  // Listen for controller changes (new SW activated)
  if (isServiceWorkerSupported()) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Registration] Controller changed, reloading...');
      window.location.reload();
    });
  }

  return getServiceWorkerStatus();
}
