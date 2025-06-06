/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;

/* ================================================================
   INITIALISATION ET GESTION DES DONNÉES
   ================================================================ */
let taxref = {};
let ecology = {};
let floreAlpesIndex = {}; // Pour l'index des fiches FloreAlpes

// Promesse pour s'assurer que toutes les données sont chargées avant de les utiliser
const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v)),
  fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
  // Chargement du nouvel index FloreAlpes
  fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j)
]).then(() => {
    console.log("Fichiers de données (Taxref, Ecology, FloreAlpes Index) chargés et prêts.");
}).catch(err => {
    console.error("Erreur critique lors du chargement des fichiers de données:", err);
    alert("Erreur de chargement des fichiers de données locaux : " + err.message);
});

/* ================================================================
   FONCTIONS UTILITAIRES ET HELPERS
   ================================================================ */
function norm(txt) {
  if (typeof txt !== 'string') return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const slug = n => norm(n).replace(/ /g, "-");

const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnCarte  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`;

const proxyCarte  = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=carte`;
const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;

/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function identify(file, organ) {
  await ready; // S'assurer que les données JSON sont chargées avant tout
  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", organ);

  try {
    const res = await fetch(ENDPOINT, { method:"POST", body:fd });
    if(!res.ok) throw new Error("Erreur API Pl@ntNet");
    
    const results = (await res.json()).results.slice(0, MAX_RESULTS);
    document.body.classList.remove("home");
    buildTable(results);
    buildCards(results);
  } catch(err) {
    alert(err.message);
  }
}

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;
  wrap.innerHTML = "";

  // Ajout de la nouvelle colonne "FloreAlpes"
  const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN carte","INPN statut","Biodiv'AURA","OpenObs", "FloreAlpes"];
  const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";

  const rows = items.map(({score,species}) => {
    const sci  = species.scientificNameWithoutAuthor;
    const pct  = Math.round(score * 100);
    const cd   = cdRef(sci);
    const eco  = ecolOf(sci);
    
    // Logique pour construire le lien FloreAlpes à partir de l'index
    const normalizedSci = norm(sci);
    let floreAlpesLink = "—";
    if (floreAlpesIndex[normalizedSci]) {
        const floreAlpesUrl = `https://www.florealpes.com/${floreAlpesIndex[normalizedSci]}`;
        floreAlpesLink = link(floreAlpesUrl, "fiche");
    }

    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${pct}</td>
      <td>${link(infoFlora(sci),"fiche")}</td>
      <td>${eco.slice(0,120)}${eco.length>120?"…":""}</td>
      <td>${link(cd && proxyCarte(cd),"carte")}</td>
      <td>${link(cd && proxyStatut(cd),"statut")}</td>
      <td>${link(cd && aura(cd),"atlas")}</td>
      <td>${link(cd && openObs(cd),"carte")}</td>
      <td>${floreAlpesLink}</td>
    </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildCards(items){
  const zone = document.getElementById("cards");
  if (!zone) return;
  zone.innerHTML = "";

  items.forEach(({score,species}) => {
    const sci = species.scientificNameWithoutAuthor;
    const cd  = cdRef(sci); 
    if(!cd) return;
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
   ÉCOUTEURS SPÉCIFIQUES AUX PAGES
   ================================================================ */
const fileInput  = document.getElementById("file");
const organBox   = document.getElementById("organ-choice");

if(fileInput && !organBox){ // Logique pour index.html
  fileInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      sessionStorage.setItem("photoData", reader.result);
      location.href = "organ.html";
    };
    reader.readAsDataURL(file);
  });
}

if(organBox){ // Logique pour organ.html
   const stored = sessionStorage.getItem("photoData");
  if(!stored){
    location.href = "index.html";
  } else {
    const prev = document.getElementById("preview");
    if(prev) prev.src = stored;
    const toBlob = str => {
      try {
        const [meta, b64] = str.split(",");
        const mime = /:(.*?);/.exec(meta)[1];
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for(let i=0; i<bin.length; i++) arr[i]=bin.charCodeAt(i);
        return new Blob([arr], {type:mime});
      } catch (e) {
        return null;
      }
    };
    const handle = async e => {
      const img = sessionStorage.getItem("photoData");
      if(!img) return;
      const blob = toBlob(img);
      if (blob) {
        await identify(blob, e.currentTarget.dataset.organ);
      } else {
        alert("Erreur lors de la préparation de l'image.");
      }
    };
    organBox.querySelectorAll("button").forEach(btn =>
      btn.addEventListener("click", handle)
    );
  }
}
