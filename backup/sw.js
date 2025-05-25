const CACHE_NAME = 'word-闖關-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/audio.js',
  '/js/main.js',
  '/screens/admin_config.html',
  '/screens/admin_login.html',
  '/screens/info_input.html',
  '/screens/level1.html',
  '/screens/level2.html',
  '/screens/level3.html',
  '/screens/result_failure.html',
  '/screens/result_success.html',
  '/screens/result.html',
  '/screens/welcome.html',
  '/audio/cancel.wav',
  '/audio/challenge_lose.wav',
  '/audio/challenge_win.wav',
  '/audio/click.wav',
  '/audio/confirm.wav',
  '/audio/correct.wav',
  '/audio/error.wav',
  '/audio/incorrect_final.wav',
  '/audio/incorrect.wav',
  '/audio/level_lose.wav',
  '/audio/level_win.wav',
  '/audio/login.wav',
  '/audio/select.wav',
  '/audio/success.wav',
  '/audio/timeout.wav',
  '/audio/timer_end.wav',
  '/audio/timer_tick_warn.wav',
  '/audio/typing.wav',
  '/data/人教版/grade3.json',
  '/data/人教版/grade4.json',
  '/data/人教版/grade5.json',
  '/data/人教版/grade6.json',
  '/data/人教版/grade7.json',
  '/data/人教版/grade8.json',
  '/data/人教版/grade9.json',
  '/data/人教版/highschool_all.json',
  '/data/人教版/highschool_high_freq.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event: cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event started.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache opened:', CACHE_NAME);
        console.log('[Service Worker] Caching core assets:', urlsToCache);
        return cache.addAll(urlsToCache)
          .then(() => {
            console.log('[Service Worker] All core assets successfully cached.');
          })
          .catch(error => {
            console.error('[Service Worker] Failed to cache one or more core assets during addAll:', error);
            // Rethrow the error to ensure the install event fails if addAll fails.
            throw error;
          });
      })
      .then(() => {
        console.log('[Service Worker] Core assets caching process complete, proceeding to skipWaiting.');
        return self.skipWaiting(); // Ensure new service worker activates immediately
      })
      .catch(error => {
        console.error('[Service Worker] Error during install event, installation failed:', error);
        // Rethrow to ensure event.waitUntil's promise rejects, failing the install.
        throw error;
      })
  );
});

// Activate event: clean up old caches and take control
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event started.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Old caches cleaned up.');
      return self.clients.claim(); // Ensure new service worker takes control immediately
    })
    .then(() => {
      console.log('[Service Worker] Clients claimed, activation complete.');
    })
    .catch(error => {
      console.error('[Service Worker] Error during activate event:', error);
    })
  );
});

// Fetch event: serve cached content or fetch from network
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    console.log('[Service Worker] Fetch event for non-GET request, skipping cache:', event.request.method, event.request.url);
    // For non-GET requests, just fetch from network without caching.
    // Or, if you don't want the service worker to handle them at all:
    // return; // This would let the browser handle it directly.
    return; // Let browser handle non-GET requests
  }

  const requestUrl = new URL(event.request.url);

  // Special handling for JSON data files to observe their caching behavior
  if (requestUrl.pathname.endsWith('.json')) {
    console.log('[Service Worker] Fetching JSON data:', requestUrl.pathname);
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            console.log('[Service Worker] JSON data found in cache:', requestUrl.pathname);
            return cachedResponse;
          }
          console.log('[Service Worker] JSON data not in cache, fetching from network:', requestUrl.pathname);
          return fetch(event.request).then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              console.error('[Service Worker] Network fetch for JSON failed or not OK:', requestUrl.pathname, 'Status:', networkResponse ? networkResponse.status : 'No response');
              // Return the problematic networkResponse so the app can see the error
              return networkResponse;
            }
            console.log('[Service Worker] JSON data fetched from network, caching:', requestUrl.pathname);
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
              console.log('[Service Worker] JSON data cached:', requestUrl.pathname);
            });
            return networkResponse;
          }).catch(error => {
            console.error('[Service Worker] Network fetch for JSON failed catastrophically:', requestUrl.pathname, error);
            // Propagate the error so the application can handle it
            // This could be a generic offline response or just let the fetch fail
            throw error;
          });
        })
    );
  } else {
    // Standard caching strategy for other assets
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // console.log('[Service Worker] Asset found in cache:', requestUrl.pathname);
            return response; // Cache hit
          }
          // console.log('[Service Worker] Asset not in cache, fetching from network:', requestUrl.pathname);
          return fetch(event.request).then(
            networkResponse => {
              if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                // console.log('[Service Worker] Asset network fetch not cacheable:', requestUrl.pathname, 'Status:', networkResponse ? networkResponse.status : 'No response', 'Type:', networkResponse ? networkResponse.type : 'N/A');
                return networkResponse; // Not a cacheable response
              }
              // console.log('[Service Worker] Asset fetched from network, caching:', requestUrl.pathname);
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                  // console.log('[Service Worker] Asset cached:', requestUrl.pathname);
                });
              return networkResponse;
            }
          ).catch(error => {
            console.error('[Service Worker] Asset fetching failed:', requestUrl.pathname, error);
            // Propagate the error. For assets, you might return a fallback if available.
            // e.g., return caches.match('/offline-placeholder.png');
            throw error; // Or rethrow to let the browser handle the failed fetch
          });
        })
    );
  }
});