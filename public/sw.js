/**
 * Service Worker for IBL Mentor App
 *
 * Strategy:
 * - Always cache responses in the background
 * - Only serve from cache when running in Tauri AND offline
 * - Tauri detection via custom header or message from app
 */

const CACHE_VERSION = 'v13';
const CACHE_NAME = `mentor-cache-${CACHE_VERSION}`;

// Track if we're running in Tauri (set via message from app)
let isTauri = false;
let isOffline = false;

/**
 * Install event
 */
self.addEventListener('install', () => {
  console.log('[SW] Installing v13...');
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v13...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('mentor-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

/**
 * Fetch event
 * - Always cache in background
 * - Only intercept and serve from cache if in Tauri AND offline
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  // Only intercept if we're in Tauri AND offline
  if (isTauri && isOffline) {
    console.log('[SW] Tauri offline mode - intercepting:', request.url);

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Try cache first when offline in Tauri
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          console.log('[SW] Serving from cache:', request.url);
          return cachedResponse;
        }

        // Try network as fallback (might work for some requests)
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          console.log('[SW] Network failed, no cache:', request.url);
          return getOfflineFallback(request);
        }
      }),
    );
    return;
  }

  // Not in Tauri offline mode - don't intercept, let the browser handle normally
});

/**
 * Get offline fallback response
 */
function getOfflineFallback(request) {
  const url = request.url;

  // API request
  if (url.includes('/api/') || url.includes('api-ai.') || url.includes('api-core.')) {
    return new Response(JSON.stringify({ error: 'Offline - data not cached', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Image
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url)) {
    return new Response(
      Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        ),
        (c) => c.charCodeAt(0),
      ),
      { status: 200, headers: { 'Content-Type': 'image/png' } },
    );
  }

  // Page/navigation
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Offline - IBL Mentor</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; }
            h1 { font-size: 2rem; margin-bottom: 1rem; }
            p { color: #666; margin-bottom: 1.5rem; }
            button { background: linear-gradient(to right, #2563EB, #93C5FD); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Offline</h1>
            <p>Please check your internet connection.</p>
            <button onclick="window.location.reload()">Try Again</button>
          </div>
        </body>
      </html>`,
      { status: 503, headers: { 'Content-Type': 'text/html' } },
    );
  }

  return new Response('Offline', { status: 503 });
}

/**
 * Message handler - receives Tauri status and online/offline state from app
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SET_TAURI':
      isTauri = !!data;
      console.log('[SW] Tauri mode:', isTauri);
      break;

    case 'SET_OFFLINE':
      isOffline = !!data;
      console.log('[SW] Offline status:', isOffline);
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        names.filter((n) => n.startsWith('mentor-')).forEach((n) => caches.delete(n));
      });
      break;

    case 'GET_CACHE_STATUS':
      caches.open(CACHE_NAME).then(async (cache) => {
        const keys = await cache.keys();
        event.source.postMessage({
          type: 'CACHE_STATUS',
          status: { [CACHE_NAME]: keys.length },
        });
      });
      break;
  }
});
