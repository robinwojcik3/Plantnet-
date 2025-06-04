diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..0e32a04af7ce159b936b7dd34a377eba96263047 100644
--- a/app.js
+++ b/app.js
@@ -58,50 +58,64 @@ const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;
 /* ================================================================
    FONCTION PRINCIPALE : IDENTIFICATION Pl@ntNet
    ================================================================ */
 async function identify(file){
   /* On attend que taxref + ecology soient chargés */
   await ready;
 
   /* Requête API Pl@ntNet */
   const fd = new FormData();
   fd.append("images", file, "photo.jpg");
   fd.append("organs", "auto");
 
   const res = await fetch(ENDPOINT, { method:"POST", body:fd });
   if(!res.ok){ alert("Erreur API Pl@ntNet"); return; }
 
   const results = (await res.json()).results.slice(0, MAX_RESULTS);
 
   /* Retire le bandeau de fond */
   document.body.classList.remove("home");
 
   /* Affichage */
   buildTable(results);
   buildCards(results);
 }
 
+/* ================================================================
+   SAUVEGARDE LOCALE DE LA PHOTO
+   ================================================================ */
+function savePhoto(file){
+  const url = URL.createObjectURL(file);
+  const a = document.createElement('a');
+  a.href = url;
+  a.download = file.name || 'photo.jpg';
+  document.body.appendChild(a);
+  a.click();
+  a.remove();
+  URL.revokeObjectURL(url);
+}
+
 /* ================================================================
    CONSTRUCTION DU TABLEAU DE RÉSULTATS
    ================================================================ */
 function buildTable(items){
   const wrap = document.getElementById("results");
   wrap.innerHTML = "";
 
   const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN carte","INPN statut","Biodiv'AURA","OpenObs"];
   const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";
 
   const rows = items.map(({score,species}) => {
     const sci  = species.scientificNameWithoutAuthor;
     const pct  = Math.round(score * 100);
     const cd   = cdRef(sci);
     const eco  = ecolOf(sci);
     return `<tr>
       <td>${sci}</td>
       <td style="text-align:center">${pct}</td>
       <td>${link(infoFlora(sci),"fiche")}</td>
       <td>${eco.slice(0,120)}${eco.length>120?"…":""}</td>
       <td>${link(cd && inpnCarte(cd),"carte")}</td>
       <td>${link(cd && inpnStatut(cd),"statut")}</td>
       <td>${link(cd && aura(cd),"atlas")}</td>
       <td>${link(cd && openObs(cd),"carte")}</td>
     </tr>`;
diff --git a/app.js b/app.js
index a00273bc45f318117d075865b2cd59544ebded79..0e32a04af7ce159b936b7dd34a377eba96263047 100644
--- a/app.js
+++ b/app.js
@@ -123,27 +137,45 @@ function buildCards(items){
 
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
 document.getElementById("file")
   .addEventListener("change", e => {
-    if(e.target.files[0]) identify(e.target.files[0]);
+    const f = e.target.files[0];
+    if(!f) return;
+    savePhoto(f);
+    identify(f);
   });
+
+const toggleBtn = document.getElementById('toggle-mode');
+if(toggleBtn){
+  const updateIcon = () => {
+    toggleBtn.textContent = document.body.classList.contains('phone') ? '💻' : '📱';
+  };
+  toggleBtn.addEventListener('click', () => {
+    document.body.classList.toggle('phone');
+    updateIcon();
+  });
+  window.addEventListener('load', () => {
+    if(window.innerWidth <= 600) document.body.classList.add('phone');
+    updateIcon();
+  });
+}
