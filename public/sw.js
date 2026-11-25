// Retire the previous app's service worker so installed copies stop serving
// cached pages from the old implementation after the replacement is deployed.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("sarraf-")).map((name) => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
