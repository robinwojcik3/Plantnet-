 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..4e9a5018706f4c17a04a7661e02b0ce6d4fdc47d 100644
--- a/app.js
+++ b/app.js
@@ -1,32 +1,33 @@
 /* ================================================================
    CONFIGURATION GÉNÉRALE
    ================================================================ */
 const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";          // clé Pl@ntNet
 const PROJECT  = "all";
 const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
 const MAX_RESULTS = 5;                                // nb lignes tableau/fiches
+let pendingFile = null;
 
 /* ================================================================
    FONCTION DE NORMALISATION (minuscules + pas d’accents + espaces simples)
    ================================================================ */
 function norm(txt){
   return txt
     .normalize("NFD")                 // décomposition accents
     .replace(/[\u0300-\u036f]/g,"")   // retrait diacritiques
     .toLowerCase()
     .trim()
     .replace(/\s+/g," ");             // espaces multiples -> 1
 }
 
 /* ================================================================
    CHARGEMENT DES JSON LOCAUX (taxref + ecology) AVANT IDENTIFICATION
    ================================================================ */
 let taxref   = {};      // { nom latin normalisé -> CD_REF }
 let ecology  = {};      // { nom latin normalisé -> description écologie }
 
 const ready = Promise.all([
   /* TAXREF ------------------------------------------------------ */
   fetch("taxref.json").then(r => r.json()).then(j => {
     Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v);
   }),
   /* ECOLOGY ----------------------------------------------------- */
diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..4e9a5018706f4c17a04a7661e02b0ce6d4fdc47d 100644
--- a/app.js
+++ b/app.js
@@ -36,58 +37,58 @@ const ready = Promise.all([
   })
 ]).catch(err => {
   alert("Erreur chargement des fichiers locaux : " + err);
 });
 
 /* ================================================================
    HELPERS URLS
    ================================================================ */
 const cdRef      = n => taxref[norm(n)];            // CD_REF ou undefined
 const ecolOf     = n => ecology[norm(n)] || "—";    // description ou tiret
 const slug       = n => norm(n).replace(/ /g,"-");
 
 const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
 const inpnCarte  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
 const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
 const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
 const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`;
 
 /* proxies Netlify Functions (fragments INPN) */
 const proxyCarte  = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=carte`;
 const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;
 
 /* ================================================================
    FONCTION PRINCIPALE : IDENTIFICATION Pl@ntNet
    ================================================================ */
-async function identify(file){
+async function identify(file, organ){
   /* On attend que taxref + ecology soient chargés */
   await ready;
 
   /* Requête API Pl@ntNet */
   const fd = new FormData();
   fd.append("images", file, "photo.jpg");
-  fd.append("organs", "auto");
+  fd.append("organs", organ || "auto");
 
   const res = await fetch(ENDPOINT, { method:"POST", body:fd });
   if(!res.ok){ alert("Erreur API Pl@ntNet"); return; }
 
   const results = (await res.json()).results.slice(0, MAX_RESULTS);
 
   /* Retire le bandeau de fond */
   document.body.classList.remove("home");
 
   /* Affichage */
   buildTable(results);
   buildCards(results);
 }
 
 /* ================================================================
    CONSTRUCTION DU TABLEAU DE RÉSULTATS
    ================================================================ */
 function buildTable(items){
   const wrap = document.getElementById("results");
   wrap.innerHTML = "";
 
   const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN carte","INPN statut","Biodiv'AURA","OpenObs"];
   const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";
 
   const rows = items.map(({score,species}) => {
diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..4e9a5018706f4c17a04a7661e02b0ce6d4fdc47d 100644
--- a/app.js
+++ b/app.js
@@ -121,29 +122,42 @@ function buildCards(items){
   const zone = document.getElementById("cards");
   zone.innerHTML = "";
 
   items.forEach(({score,species}) => {
     const sci = species.scientificNameWithoutAuthor;
     const cd  = cdRef(sci); if(!cd) return;     // skip si pas de cd_ref
     const pct = Math.round(score * 100);
 
     const details = document.createElement("details");
     details.innerHTML = `
       <summary>${sci} — ${pct}%</summary>
       <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>
       <div class="iframe-grid">
         <iframe src="${proxyCarte(cd)}"  title="Carte INPN"></iframe>
         <iframe src="${proxyStatut(cd)}" title="Statut INPN"></iframe>
         <iframe src="${aura(cd)}"        title="Biodiv'AURA"></iframe>
         <iframe src="${openObs(cd)}"     title="OpenObs"></iframe>
       </div>`;
     zone.appendChild(details);
   });
 }
 
 /* ================================================================
    LISTENER SUR L’INPUT FILE
    ================================================================ */
+const organBox = document.getElementById("organ-choice");
 document.getElementById("file")
   .addEventListener("change", e => {
-    if(e.target.files[0]) identify(e.target.files[0]);
+    if(e.target.files[0]){
+      pendingFile = e.target.files[0];
+      organBox.classList.remove("hidden");
+    }
   });
+
+document.querySelectorAll("#organ-choice button").forEach(btn =>
+  btn.addEventListener("click", () => {
+    organBox.classList.add("hidden");
+    if(pendingFile) identify(pendingFile, btn.dataset.organ);
+    pendingFile = null;
+  })
+);
+
 
EOF
)
