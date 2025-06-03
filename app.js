/* ---------------- CONFIG ---------------- */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
/* ---------------------------------------- */

/* -- chargement synchronisé des deux JSON -- */
let taxref={}, ecology={};
const ready = Promise.all([
  fetch("taxref.json").then(r=>r.json()).then(j=>taxref=j),
  fetch("ecology.json").then(r=>r.json()).then(j=>ecology=j)
]).catch(err=>{
  alert("Échec chargement données locales : "+err);
});

/* ------------- helpers ------------------ */
const cdRef  = n=>taxref[n.toLowerCase()];
const ecolOf = n=>ecology[n.toLowerCase()]||"—";
const slug   = n=>n.toLowerCase().replace(/\s+/g,"-");

const infoFlora = n=>`https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnCarte = c=>`https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStat  = c=>`https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura      = c=>`https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs   = c=>`https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`;

/* proxies fragments */
const proxyCarte = c=>`/.netlify/functions/inpn-proxy?cd=${c}&type=carte`;
const proxyStat  = c=>`/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;

/* ------------- appel PlantNet ----------- */
async function identify(file){
  /* on attend que taxref + ecology soient chargées */
  await ready;

  const fd=new FormData();
  fd.append("images",file,"photo.jpg");
  fd.append("organs","auto");

  const r=await fetch(ENDPOINT,{method:"POST",body:fd});
  if(!r.ok){alert("Erreur API");return;}

  const res=(await r.json()).results.slice(0,MAX_RESULTS);
  document.body.classList.remove("home");        // retire fond
  buildTable(res); buildCards(res);
}

/* ------------- tableau ------------------ */
function buildTable(items){
  const wrap=document.getElementById("results"); wrap.innerHTML="";
  const head=["Nom latin","Score (%)","InfoFlora","Écologie","INPN carte","INPN statut","Biodiv'AURA","OpenObs"];
  const L=(u,l)=>u?`<a href="${u}" target="_blank" rel="noopener">${l}</a>`:"—";

  const rows=items.map(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRef(sci); const pct=Math.round(score*100);
    const eco=ecolOf(sci);
    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${pct}</td>
      <td>${L(infoFlora(sci),"fiche")}</td>
      <td>${eco.slice(0,120)}${eco.length>120?"…":""}</td>
      <td>${L(cd&&inpnCarte(cd),"carte")}</td>
      <td>${L(cd&&inpnStat(cd),"statut")}</td>
      <td>${L(cd&&aura(cd),"atlas")}</td>
      <td>${L(cd&&openObs(cd),"carte")}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML=`<table>
    <thead><tr>${head.map(t=>`<th>${t}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ------------- fiches accordéon -------- */
function buildCards(items){
  const zone=document.getElementById("cards"); zone.innerHTML="";
  items.forEach(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRef(sci); if(!cd)return;
    const pct=Math.round(score*100);
    const details=document.createElement("details");
    details.innerHTML=`
      <summary>${sci} — ${pct}%</summary>
      <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>
      <div class="iframe-grid">
        <iframe src="${proxyCarte(cd)}"></iframe>
        <iframe src="${proxyStat(cd)}"></iframe>
        <iframe src="${aura(cd)}"></iframe>
        <iframe src="${openObs(cd)}"></iframe>
      </div>`;
    zone.appendChild(details);
  });
}

/* ------------- input listener ---------- */
document.getElementById("file")
  .addEventListener("change",e=>{
    if(e.target.files[0]) identify(e.target.files[0]);
  });
