// Whales Records Admin — minimal Service Worker (PWA install + offline fallback)
const CACHE_NAME = 'wr-admin-v1';
const ASSETS = ['/dashboard', '/icon.svg', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only cache GET HTML/JS/CSS/img — never POST or API calls (admin token in headers)
  if (req.method !== 'GET' || req.url.includes('/api/')) return;
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((res) => {
          if (!res.ok || res.type !== 'basic') return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('/dashboard')),
    ),
  );
});
