 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/sw.js b/sw.js
index 9b9ce478b54d9d57c4c9f6cc9ad31f7565b7b549..471c5ec739680d3a952c0135958916c4399fc743 100644
--- a/sw.js
+++ b/sw.js
@@ -1,32 +1,33 @@
 /* ================================================================
    Service-Worker – PlantID PWA
    ================================================================ */
-const CACHE  = "plantid-v10";       // ← incrémentez à chaque déploiement
+const CACHE  = "plantid-v11";       // ← incrémentez à chaque déploiement
 const ASSETS = [
   "./",
   "./index.html",
+  "./organ.html",
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
 
EOF
)
