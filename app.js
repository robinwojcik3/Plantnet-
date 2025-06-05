 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..1855aa1106e43e9a2fcdc1d3162a72fad57984b0 100644
--- a/app.js
+++ b/app.js
@@ -36,58 +36,58 @@ const ready = Promise.all([
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
+  fd.append("organs", organ); // organ: leaf | flower | bark | fruit
 
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
index a00273bc45f318117d075865b2cd59544ebded79..1855aa1106e43e9a2fcdc1d3162a72fad57984b0 100644
--- a/app.js
+++ b/app.js
@@ -121,29 +121,70 @@ function buildCards(items){
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
-document.getElementById("file")
-  .addEventListener("change", e => {
-    if(e.target.files[0]) identify(e.target.files[0]);
+/* ================================================================
+   ÉCOUTEURS SELON LA PAGE
+   ================================================================ */
+const fileInput  = document.getElementById("file");
+const organBox   = document.getElementById("organ-choice");
+
+if(fileInput && !organBox){
+  /* page d'accueil : sauvegarde la photo et redirection */
+  fileInput.addEventListener("change", e => {
+    const file = e.target.files[0];
+    if(!file) return;
+    const reader = new FileReader();
+    reader.onload = () => {
+      sessionStorage.setItem("photoData", reader.result);
+      location.href = "organ.html";
+    };
+    reader.readAsDataURL(file);
   });
+}
+
+if(organBox){
+  /* page de choix de l'organe */
+  const data = sessionStorage.getItem("photoData");
+  if(!data){
+    location.href = "index.html";
+  } else {
+    const prev = document.getElementById("preview");
+    if(prev) prev.src = data;
+    const toBlob = str => {
+      const [meta, b64] = str.split(",");
+      const mime = /:(.*?);/.exec(meta)[1];
+      const bin = atob(b64);
+      const arr = new Uint8Array(bin.length);
+      for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
+      return new Blob([arr], {type:mime});
+    };
+    organBox.querySelectorAll("button").forEach(btn =>
+      btn.addEventListener("click", () => {
+        identify(toBlob(data), btn.dataset.organ);
+        sessionStorage.removeItem("photoData");
+      })
+    );
+  }
+}
+
 
EOF
)
