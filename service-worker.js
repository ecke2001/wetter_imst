const CACHE_NAME = 'agrarwetter-imst-v1';
const ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // For Open-Meteo API requests, use Network-First strategy (with offline fallback)
  if (url.hostname.includes('open-meteo.com')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Cache successful API responses
          if (response.status === 200) {
            const clone = response.clone();
            caches.open('agrarwetter-api-cache').then((cache) => {
              cache.put(e.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network is unavailable
          return caches.match(e.request);
        })
    );
  } else {
    // For static assets, use Stale-While-Revalidate
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, networkResponse);
              });
            }
            return networkResponse.clone();
          })
          .catch(() => {
            // Ignore network errors for background revalidation
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});
