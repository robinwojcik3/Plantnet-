/* -------------------------------------------------- CONFIGURATION -- */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
/* ------------------------------------------------------------------ */

/* ----------- lecture taxref.json (latin → CD_REF) ------------------ */
let taxref = {};
fetch("taxref.json").then(r => r.json()).then(j => { taxref = j; });

/* ----------------------------- helpers URL ------------------------- */
const cdRefOf       = s => taxref[s.toLowerCase()];
const inpnCarteUrl  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStatutUrl = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const auraUrl       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObsUrl    = c => (
  `https://openobs.mnhn.fr/openobs-hub/occurrences/search?` +
  `q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)` +
  `&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`
);

/* --------------------------- appel PlantNet ------------------------ */
async function identify(file) {
  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", "auto");

  const res = await fetch(ENDPOINT, { method: "POST", body: fd });
  if (!res.ok) { alert("Erreur API Pl@ntNet"); return; }

  const data = await res.json();
  showResults(data.results.slice(0, MAX_RESULTS));
}

/* -------------------- affichage tableau résultat ------------------ */
function showResults(items) {
  const target = document.getElementById("results");
  target.innerHTML = "";

  const table = document.createElement("table");
  table.innerHTML =
    `<tr>
       <th>Nom latin</th>
       <th>Score&nbsp;(%)</th>
       <th>INPN carte</th>
       <th>INPN statut</th>
       <th>Biodiv'AURA</th>
       <th>OpenObs</th>
     </tr>`;

  items.forEach(({ score, species }) => {
    const sci = species.scientificNameWithoutAuthor;
    const cd  = cdRefOf(sci);
    const pct = Math.round(score * 100);

    const row = document.createElement("tr");
    row.innerHTML =
      `<td>${sci}</td>
       <td style="text-align:center">${pct}</td>
       <td>${linkOrDash(cd && inpnCarteUrl(cd),  "carte")}</td>
       <td>${linkOrDash(cd && inpnStatutUrl(cd), "statut")}</td>
       <td>${linkOrDash(cd && auraUrl(cd),       "atlas")}</td>
       <td>${linkOrDash(cd && openObsUrl(cd),    "carte")}</td>`;
    table.appendChild(row);
  });

  target.appendChild(table);
}

/* --------------------------- utilitaire lien ---------------------- */
function linkOrDash(url, label) {
  return url
    ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
    : "—";
}

/* ------------------------------ écouteur -------------------------- */
document.getElementById("file")
  .addEventListener("change", e => e.target.files[0] && identify(e.target.files[0]));
