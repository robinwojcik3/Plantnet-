const CACHE    = "plantid-v1";
const ASSETS   = ["./", "./index.html", "./app.js", "./manifest.json", "./taxref.json"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener("fetch",e=>{
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
