/* ================================================================
   Service-Worker – PlantID PWA
   ================================================================ */
const CACHE  = "plantid-v11";       // ← incrémentez à chaque déploiement
const ASSETS = [
  "./",
  "./index.html",
  "./organ.html",
  "./app.js",
  "./manifest.json",
  "./taxref.json",
  "./ecology.json",                // ← nouvelle base écologie
  "icons/icon-192.png",
  "icons/icon-512.png",
  "assets/Bandeau.jpg"             // ← image de fond (facultatif hors-ligne)
];

/* ---------------- phase INSTALL ---------------- */
self.addEventListener("install", event => {
  self.skipWaiting();                              // prend la place de suite
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

/* ---------------- phase ACTIVATE --------------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE)               // supprime anciens caches
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();                           // contrôle immédiat
});

/* ---------------- interceptions FETCH ---------- */
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(resp => resp || fetch(event.request))
  );
});
