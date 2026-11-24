const shell = "sdbf-shell-__SHELL_VERSION__";
const builtAssets = __BUILT_ASSETS__;
const savedData = "sdbf-public-evidence";
const cachePath = "/api/cache";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(shell);
    const response = await fetch("/", { cache:"reload" });
    if (!response.ok) throw Error("Could not pre-cache Beach Finder");
    const html = await response.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.addAll([...new Set([...builtAssets,...assets,"/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png","/methodology.html"])]);
    await cache.put("/",response);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("sdbf-shell-") && name !== shell).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === cachePath) {
    event.respondWith((async () => {
      const cache = await caches.open(savedData);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(cachePath,response.clone());
          return response;
        }
      } catch { /* The last successful snapshot is useful offline. */ }
      return await cache.match(cachePath) ?? new Response(null,{ status:503 });
    })());
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(shell);
      try {
        return await fetch(request);
      } catch {
        return await cache.match(url.pathname === "/" ? "/" : request) ?? Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(shell);
    const existing = await cache.match(request);
    if (existing) return existing;
    const response = await fetch(request);
    if (response.ok && url.pathname.startsWith("/assets/")) await cache.put(request,response.clone());
    return response;
  })());
});
