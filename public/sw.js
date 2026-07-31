// Minimal, hand-rolled service worker (no Workbox) — runtime caching only,
// since Next.js build asset filenames are content-hashed and unknown ahead
// of time. After one successful visit, the app shell (HTML navigation +
// same-origin scripts/styles/fonts) is cached, so a later offline load of
// "/" serves from cache. Notes themselves live in localStorage, not here —
// this only makes the editor's own code/markup available offline.

const CACHE_NAME = "notex-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["/"]).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations (loading/reloading the app): network first, so edits ship
  // immediately when online; fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached ?? caches.match(request)))
    );
    return;
  }

  // Same-origin static assets (JS/CSS/fonts/icons): cache-first, filling the
  // cache as pages are visited — this is what makes a later offline load of
  // the editor actually work, without precaching hashed build filenames.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
