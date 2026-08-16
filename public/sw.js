const CACHE_NAME = "sarraf-v2";
const API_CACHE_NAME = "sarraf-api-v2";

const STATIC_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Auth and user data must never be served stale.
  if (
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/api/portfolio") ||
    url.pathname.startsWith("/api/savings") ||
    url.pathname.startsWith("/api/viewers")
  ) {
    return;
  }

  if (url.pathname.startsWith("/api/market")) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  if (event.request.method === "GET") {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

async function networkFirstStrategy(request) {
  const cache = await caches.open(API_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}
