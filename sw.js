const CACHE = "plantid-v2";   // incrémentez à chaque release
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./taxref.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();                               // ⚠️ 1
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {            // ⚠️ 2
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();                             // ⚠️ 3
});

self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
