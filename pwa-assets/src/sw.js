// Define a cache name for versioning
const CACHE_NAME = 'thebukitbesi-cache-v1';

// List of files to cache on install
const urlsToCache = [
  '/',
  '/offline.html'
  // Add any other core assets you want to pre-cache, like a logo
  // '/https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEihLzpisEb1eD_aGOTNa0B9tfBk1k2iwOfDnl_gp66G6zuU2IWBdLbtzpy4ZkmefyVvan-ZbbAmiuPn4tkHEA4HjELHqQmdfQGV02ujPjAdTKBAlHnhOmEQ132AgV98tfDvXAym_5tnYnb0A1ACiA5MNjaxUoE_Po40U0cva4OqLsoBvyj7-GoTBW9pfJlU/s1600/1000041895.png'
];

// Install event: fires when the service worker is first installed
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: fires for every network request
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response from cache
        if (response) {
          return response;
        }

        // Not in cache - fetch from network, cache it, and then return it
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response because it's a stream and can only be consumed once
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
      .catch(() => {
        // If both cache and network fail (e.g., offline), show the offline page
        return caches.match('/offline.html');
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
