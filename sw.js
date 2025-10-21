/* TheBukitBesi PWA SW (classic) — GitHub Pages safe, no external imports */
const VERSION = 'v1.0.3';
const STATIC_CACHE = `tbb-static-${VERSION}`;
const RUNTIME_CACHE = `tbb-runtime-${VERSION}`;
const OFFLINE_URL = './offline.html';
const PRECACHE_URLS = [
  './',                      // root of the SW scope (e.g. /on/)
  './index.html',
  './offline.html',
  './manifest.json',
  './pwa-assets/src/icon-192.png',   // optional
  './pwa-assets/src/icon-512.png'    // optional
];

// ---- Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate (cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (![STATIC_CACHE, RUNTIME_CACHE].includes(key)) {
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Same-origin HTML: Network-first with offline fallback
  if (url.origin === self.location.origin && req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Same-origin assets: Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(req, resClone));
        return res;
      }))
    );
    return;
  }

  // Cross-origin (CDN/fonts/api): Network-first with fallback to cache
  event.respondWith(
    fetch(req).then((res) => {
      const resClone = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, resClone));
      return res;
    }).catch(() => caches.match(req))
  );
});

// ---- Optional: message to force update
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
