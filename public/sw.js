/**
 * Undercover Service Worker (PWA / WebAPK)
 * Provides offline shell caching and lightning-fast loading while preserving
 * real-time WebSocket communication for party multiplayer.
 */

const CACHE_NAME = 'undercover-pwa-v1.1';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/audio.js',
  '/js/gameUI.js',
  '/js/screens.js',
  '/js/socketClient.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-icon-512.png',
  '/icons/icon.svg'
];

// Install: Cache critical game shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static shell assets');
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old versions and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-only for localhost and navigation, cache only static assets in production
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Strictly bypass localhost, real-time socket connections, and API endpoints
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/health') ||
    event.request.method !== 'GET'
  ) {
    return; // Let browser handle request via normal network
  }

  // 2. Navigation requests: Network-only (never serve offline mock shell for multiplayer game)
  if (event.request.mode === 'navigate') {
    return;
  }

  // 3. Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
