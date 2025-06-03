/* ------------------- CONFIGURATION -------------------- */
const API_KEY = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
/* ------------------------------------------------------ */

/* Charge taxref.json ------------------------------------------------ */
let taxref = {};
fetch("taxref.json").then(r => r.json()).then(j => { taxref = j; });

/* Helpers URL ------------------------------------------------------- */
const cdRefOf       = s => taxref[s.toLowerCase()];
const inpnCarteUrl  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStatutUrl = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const auraUrl       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObsUrl    = c => (
  `https://openobs.mnhn.fr/openobs-hub/occurrences/search?` +
  `q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)` +
  `&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`
);

/* Appel Pl@ntNet ---------------------------------------------------- */
async function identify(file){
  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", "auto");

  const r = await fetch(ENDPOINT,{method:"POST",body:fd});
  if(!r.ok){alert("Erreur API");return;}
  const data = await r.json();
  buildTable(data.results.slice(0,MAX_RESULTS));
  buildCards(data.results.slice(0,MAX_RESULTS));
}

/* Tableau ----------------------------------------------------------- */
function buildTable(items){
  const wrap = document.getElementById("results");
  wrap.innerHTML = "";
  const h=[
    "Nom latin","Score (%)","INPN carte","INPN statut","Biodiv'AURA","OpenObs"
  ];
  const rows = items.map(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRefOf(sci);
    const pct=Math.round(score*100);
    const linkOrDash = (u,l)=>u?`<a href="${u}" target="_blank" rel="noopener">${l}</a>`:"—";
    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${pct}</td>
      <td>${linkOrDash(cd&&inpnCarteUrl(cd),"carte")}</td>
      <td>${linkOrDash(cd&&inpnStatutUrl(cd),"statut")}</td>
      <td>${linkOrDash(cd&&auraUrl(cd),"atlas")}</td>
      <td>${linkOrDash(cd&&openObsUrl(cd),"carte")}</td>
    </tr>`;
  }).join("");
  wrap.innerHTML=`
    <table>
      <tr>${h.map(t=>`<th>${t}</th>`).join("")}</tr>
      ${rows}
    </table>`;
}

/* Cartes détaillées -------------------------------------------------- */
function buildCards(items){
  const cardWrap = document.getElementById("cards");
  cardWrap.innerHTML="";
  items.forEach(({score,species})=>{
    const sci=species.scientificNameWithoutAuthor;
    const cd = cdRefOf(sci);
    if(!cd){return;} // skip si pas de cd_ref
    const pct=Math.round(score*100);
    const card = document.createElement("details");
    card.innerHTML=`
      <summary>${sci} — ${pct}%</summary>
      <div class="iframe-grid">
        <iframe src="${inpnCarteUrl(cd)}" title="INPN carte"></iframe>
        <iframe src="${inpnStatutUrl(cd)}" title="INPN statut"></iframe>
        <iframe src="${auraUrl(cd)}" title="Biodiv'AURA"></iframe>
        <iframe src="${openObsUrl(cd)}" title="OpenObs"></iframe>
      </div>`;
    cardWrap.appendChild(card);
  });
}

/* Listener ----------------------------------------------------------- */
document.getElementById("file")
  .addEventListener("change",e=>e.target.files[0]&&identify(e.target.files[0]));
