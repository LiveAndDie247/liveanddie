/* live.and.die portal service worker: network-first (always fresh online), cache fallback offline. */
var CACHE = "lad-portal-v7";
var CORE = ["/", "/index.html", "/portal.js", "/gate/fonts/Web437_IBM_VGA_8x16.woff", "/archive/index.json", "/img/wm.svg", "/favicon.png", "/manifest.json"];
self.addEventListener("install", function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) { if (r && r.status === 200 && e.request.url.indexOf("http") === 0) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp).catch(function () {}); }); } return r; }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match("/"); }); }));
});
