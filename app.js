/* ------------------ CONFIGURATION ------------------ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
/* --------------------------------------------------- */

/* charge taxref.json */
let taxref={};
fetch("taxref.json").then(r=>r.json()).then(j=>{taxref=j;});

/* helpers URL */
const cdRefOf       = n => taxref[n.toLowerCase()];
const slug          = n => n.toLowerCase().replace(/\s+/g,"-");
const infoFloraUrl  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnCarteUrl  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStatutUrl = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const auraUrl       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObsUrl    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`;

/* proxies fragments INPN */
const proxyCarte  = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=carte`;
const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;

/* ---------------- appel Pl@ntNet --------------- */
async function identify(file){
  const fd=new FormData();
  fd.append("images",file,"photo.jpg");
  fd.append("organs","auto");
  const r = await fetch(ENDPOINT,{method:"POST",body:fd});
  if(!r.ok){alert("Erreur API");return;}

  const res=(await r.json()).results.slice(0,MAX_RESULTS);
  buildTable(res); buildCards(res);
}

/* ---------------- tableau ----------------------- */
function buildTable(items){
  const wrap=document.getElementById("results"); wrap.innerHTML="";
  const head=["Nom latin","Score (%)","InfoFlora","INPN carte","INPN statut","Biodiv'AURA","OpenObs"];
  const L=(u,l)=>u?`<a href="${u}" target="_blank" rel="noopener">${l}</a>`:"—";

  const rows=items.map(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRefOf(sci); const pct=Math.round(score*100);
    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${pct}</td>
      <td>${L(infoFloraUrl(sci),"fiche")}</td>
      <td>${L(cd&&inpnCarteUrl(cd),"carte")}</td>
      <td>${L(cd&&inpnStatutUrl(cd),"statut")}</td>
      <td>${L(cd&&auraUrl(cd),"atlas")}</td>
      <td>${L(cd&&openObsUrl(cd),"carte")}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML=`<table>
    <thead><tr>${head.map(t=>`<th>${t}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ------------- fiches accordéon ----------------- */
function buildCards(items){
  const zone=document.getElementById("cards"); zone.innerHTML="";
  items.forEach(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRefOf(sci); if(!cd)return;
    const pct=Math.round(score*100);
    const details=document.createElement("details");
    details.innerHTML=`
      <summary>${sci} — ${pct}%</summary>
      <div class="iframe-grid">
        <iframe src="${proxyCarte(cd)}"  title="Carte"></iframe>
        <iframe src="${proxyStatut(cd)}" title="Statut"></iframe>
        <iframe src="${auraUrl(cd)}"     title="Biodiv'AURA"></iframe>
        <iframe src="${openObsUrl(cd)}"  title="OpenObs"></iframe>
      </div>`;
    zone.appendChild(details);
  });
}

/* input listener */
document.getElementById("file")
  .addEventListener("change",e=>e.target.files[0]&&identify(e.target.files[0]));
