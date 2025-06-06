/* ================================================================
   Service-Worker – PlantID PWA (v2 - Stratégie de cache améliorée)
   ================================================================ */

// Changez ce nom de version à chaque fois que vous mettez à jour les fichiers de l'application
// Cela forcera le service worker à se mettre à jour et à récupérer les nouveaux fichiers.
const CACHE_NAME = "plantid-v13";

// Fichiers essentiels pour le fonctionnement de base de l'application (le "coeur")
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./organ.html",
  "./viewer.html",                 // Ajout de la nouvelle page du lecteur PDF
  "./app.js",
  "./assets/viewer_app.js",        // Ajout du script du lecteur PDF
  "./manifest.json",
  "./assets/flora_gallica_toc.json", // Ajout de l'index des PDF
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/Bandeau.jpg",
  // Fichiers essentiels de la bibliothèque PDF.js
  "./pdfjs/build/pdf.js",
  "./pdfjs/build/pdf.worker.js"
];

// Fichiers de données qui seront aussi pré-cachés
const DATA_ASSETS = [
    "./taxref.json",
    "./ecology.json"
];


/* ---------------- phase INSTALL ---------------- */
// Cette étape met en cache tous les fichiers de base de l'application
self.addEventListener("install", event => {
  self.skipWaiting(); // Force le nouveau service worker à s'activer immédiatement
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Mise en cache des assets de base et des données.');
      return cache.addAll(CORE_ASSETS.concat(DATA_ASSETS));
    })
  );
});

/* ---------------- phase ACTIVATE --------------- */
// Cette étape supprime les anciens caches qui ne sont plus utilisés
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // Ne garde que le cache actuel
          .map(key => {
            console.log(`Service Worker: Suppression de l'ancien cache ${key}`);
            return caches.delete(key);
          })
      );
    }).then(() => {
        console.log('Service Worker: Activation terminée, contrôle des clients.');
        return self.clients.claim(); // Prend le contrôle des pages ouvertes
    })
  );
});

/* ---------------- interceptions FETCH ---------- */
// Cette étape intercepte toutes les requêtes réseau et applique des stratégies de cache intelligentes
self.addEventListener("fetch", event => {
    const { request } = event;
    const url = new URL(request.url);

    // Ne pas mettre en cache les requêtes vers l'API PlantNet pour toujours avoir des résultats à jour
    if (request.url.includes("my-api.plantnet.org")) {
        event.respondWith(fetch(request));
        return;
    }

    // Stratégie "Network First, then Cache" pour les pages HTML et les scripts principaux.
    // Cela garantit que les utilisateurs ont toujours la dernière version du code s'ils sont en ligne.
    if (request.destination === 'document' || request.destination === 'script') {
        event.respondWith(
            fetch(request)
                .then(networkResponse => {
                    // Si on a une réponse du réseau, on la met en cache pour le hors-ligne
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Si le réseau échoue (mode hors-ligne), on cherche dans le cache
                    return caches.match(request).then(cachedResponse => {
                        return cachedResponse || caches.match('./index.html'); // Page de secours si non trouvée
                    });
                })
        );
        return;
    }

    // Stratégie "Cache First, then Network" pour toutes les autres ressources (CSS, images, polices, JSON, PDF...).
    // C'est très rapide car on sert depuis le cache si disponible.
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse; // Servir depuis le cache
                }
                
                // Si la ressource n'est pas dans le cache, aller la chercher sur le réseau
                return fetch(request).then(networkResponse => {
                    // Et la mettre en cache pour les prochaines fois (ex: les gros PDF)
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
    );
});
