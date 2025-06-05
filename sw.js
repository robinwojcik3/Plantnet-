/* ================================================================
   Service-Worker – PlantID PWA
   ================================================================ */
const CACHE  = "plantid-v11";       // ← incrémentez à chaque déploiement si ASSETS change
const API_ENDPOINT_PATH = "/v2/identify/"; // Chemin de l'API d'identification

const ASSETS = [
  "./",
  "./index.html",
  "./organ.html",
  "./app.js",
  "./manifest.json",
  "./taxref.json",
  "./ecology.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "assets/Bandeau.jpg"
];

/* ---------------- phase INSTALL ---------------- */
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log('Service Worker: Mise en cache des assets');
      return cache.addAll(ASSETS);
    })
  );
});

/* ---------------- phase ACTIVATE --------------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE)
          .map(k => {
            console.log(`Service Worker: Suppression de l'ancien cache ${k}`);
            return caches.delete(k);
          })
      );
    }).then(() => {
      console.log('Service Worker: Activation terminée, contrôle des clients.');
      return self.clients.claim(); // Contrôle immédiat des clients non contrôlés
    })
  );
});

/* ---------------- interceptions FETCH ---------- */
self.addEventListener("fetch", event => {
  const requestUrl = new URL(event.request.url);

  // Si la requête est une requête POST vers l'API d'identification PlantNet,
  // aller directement au réseau et ne pas utiliser le cache pour la réponse.
  if (requestUrl.pathname.includes(API_ENDPOINT_PATH) && event.request.method === 'POST') {
    console.log('Service Worker: Requête POST API détectée, fetch direct depuis le réseau:', event.request.url);
    event.respondWith(fetch(event.request));
    return;
  }

  // Pour toutes les autres requêtes (GET, assets, etc.), utiliser la stratégie cache-first.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('Service Worker: Ressource trouvée dans le cache:', event.request.url);
          return cachedResponse;
        }
        console.log('Service Worker: Ressource non trouvée dans le cache, fetch depuis le réseau:', event.request.url);
        return fetch(event.request).then(networkResponse => {
          // Optionnel: Mettre en cache les nouvelles ressources GET si besoin
          // if (event.request.method === 'GET') {
          //   return caches.open(CACHE).then(cache => {
          //     cache.put(event.request, networkResponse.clone());
          //     return networkResponse;
          //   });
          // }
          return networkResponse;
        });
      }).catch(error => {
        console.error('Service Worker: Erreur de fetch ou de cache:', error);
        // Optionnel: retourner une page hors-ligne générique si le fetch échoue
      })
  );
});
