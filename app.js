/* ------------------------------------------------------------------ */
/* CONFIGURATION                                                      */
/* ------------------------------------------------------------------ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";        // clé Pl@ntNet
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;                              // nombre de lignes affichées
/* ------------------------------------------------------------------ */

/* ---- lecture du fichier taxref.json (nom latin → CD_REF) --------- */
let taxref = {};
fetch("taxref.json")
  .then(r => r.json())
  .then(j => { taxref = j; });

/* ---- helpers URL -------------------------------------------------- */
const cdRefOf       = sci => taxref[sci.toLowerCase()];
const inpnCarteUrl  = cd  => `https://inpn.mnhn.fr/espece/cd_nom/${cd}/tab/carte`;
const inpnStatutUrl = cd  => `https://inpn.mnhn.fr/espece/cd_nom/${cd}/tab/statut`;
const auraUrl       = cd  => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${cd}`;

/* ---- appel Pl@ntNet ---------------------------------------------- */
async function identify(file) {
  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", "auto");

  const res = await fetch(ENDPOINT, { method: "POST", body: fd });
  if (!res.ok) { alert("Erreur API Pl@ntNet"); return; }

  const data = await res.json();
  showResults(data.results.slice(0, MAX_RESULTS));
}

/* ---- affichage des résultats sous forme de tableau --------------- */
function showResults(items) {
  const container = document.getElementById("results");
  container.innerHTML = "";                                   // reset

  /* table + en-tête */
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";

  const header = document.createElement("tr");
  ["Nom latin", "Score (%)", "INPN carte", "INPN statut", "Biodiv'AURA"]
    .forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      th.style.border = "1px solid #ccc";
      th.style.padding = "4px 6px";
      header.appendChild(th);
    });
  table.appendChild(header);

  /* lignes */
  items.forEach(({ score, species }) => {
    const sci  = species.scientificNameWithoutAuthor;
    const pct  = Math.round(score * 100);
    const cd   = cdRefOf(sci);

    const tr = document.createElement("tr");

    // Nom latin
    addCell(tr, sci);

    // Score
    addCell(tr, pct, "center");

    // INPN carte
    addLinkCell(tr, cd ? inpnCarteUrl(cd)  : null,  "carte");

    // INPN statut
    addLinkCell(tr, cd ? inpnStatutUrl(cd) : null,  "statut");

    // Biodiv'AURA
    addLinkCell(tr, cd ? auraUrl(cd)       : null,  "atlas");

    table.appendChild(tr);
  });

  container.appendChild(table);
}

/* utilitaires cellules ------------------------------------------------*/
function addCell(tr, text, align = "left") {
  const td = document.createElement("td");
  td.textContent   = text;
  td.style.border  = "1px solid #ccc";
  td.style.padding = "4px 6px";
  td.style.textAlign = align;
  tr.appendChild(td);
}

function addLinkCell(tr, url, label) {
  const td = document.createElement("td");
  td.style.border  = "1px solid #ccc";
  td.style.padding = "4px 6px";
  td.style.textAlign = "center";

  if (url) {
    const a   = document.createElement("a");
    a.href    = url;
    a.target  = "_blank";
    a.rel     = "noopener";
    a.textContent = label;
    td.appendChild(a);
  } else {
    td.textContent = "—";
  }
  tr.appendChild(td);
}

/* ---- écouteur fichier --------------------------------------------- */
document
  .getElementById("file")
  .addEventListener("change", e => {
    if (e.target.files[0]) identify(e.target.files[0]);
  });
