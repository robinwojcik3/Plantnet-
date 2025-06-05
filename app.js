/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";          // clé Pl@ntNet
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;                                // nb lignes tableau/fiches

/* ================================================================
   FONCTION DE NORMALISATION (minuscules + pas d'accents + espaces simples)
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
  fetch("ecology.json").then(r => r.json()).then(j => {
    // le JSON est déjà normalisé, mais on re-normalise par sécurité
    Object.entries(j).forEach(([k,v]) => ecology[norm(k)] = v);
  })
]).catch(err => {
  console.error("Erreur chargement des fichiers locaux : " + err);
  // Ne pas bloquer l'application si les fichiers locaux ne sont pas disponibles
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
   GESTION DE LA SÉLECTION D'ORGANE
   ================================================================ */
let pendingFile = null;

function showOrganModal(file) {
  pendingFile = file;
  document.getElementById("organModal").classList.add("active");
}

function hideOrganModal() {
  document.getElementById("organModal").classList.remove("active");
  pendingFile = null;
  // Reset l'input file pour permettre de re-sélectionner le même fichier
  document.getElementById("file").value = "";
}

function showLoader() {
  document.getElementById("loader").classList.add("active");
}

function hideLoader() {
  document.getElementById("loader").classList.remove("active");
}

/* ================================================================
   FONCTION PRINCIPALE : IDENTIFICATION Pl@ntNet
   ================================================================ */
async function identify(file, organ){
  try {
    /* Afficher le loader */
    showLoader();
    
    /* On attend que taxref + ecology soient chargés */
    await ready;

    /* Requête API Pl@ntNet */
    const fd = new FormData();
    fd.append("images", file, "photo.jpg");
    fd.append("organs", organ);  // Utilise l'organe sélectionné

    const res = await fetch(ENDPOINT, { method:"POST", body:fd });
    
    if(!res.ok){ 
      throw new Error(`Erreur API Pl@ntNet: ${res.status}`);
    }

    const data = await res.json();
    const results = data.results.slice(0, MAX_RESULTS);

    /* Cache le loader */
    hideLoader();

    /* Retire le bandeau de fond */
    document.body.classList.remove("home");

    /* Affichage */
    buildTable(results);
    buildCards(results);
    
  } catch(error) {
    hideLoader();
    console.error("Erreur identification:", error);
    alert("Erreur lors de l'identification. Veuillez réessayer.");
  }
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
  }).join("");

  wrap.innerHTML = `
    <table>
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ================================================================
   CONSTRUCTION DES FICHES ACCORDÉON
   ================================================================ */
function buildCards(items){
  const zone = document.getElementById("cards");
  zone.innerHTML = "";

  items.forEach(({score,species}) => {
    const sci = species.scientificNameWithoutAuthor;
    const cd  = cdRef(sci); 
    if(!cd) return;     // skip si pas de cd_ref
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
   INITIALISATION ET LISTENERS
   ================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  /* Listener sur l'input file */
  const fileInput = document.getElementById("file");
  fileInput.addEventListener("change", e => {
    if(e.target.files && e.target.files[0]) {
      showOrganModal(e.target.files[0]);
    }
  });

  /* Listeners sur les boutons d'organe */
  const organButtons = document.querySelectorAll(".organ-btn");
  organButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const organ = btn.getAttribute("data-organ");
      if(pendingFile && organ) {
        hideOrganModal();
        identify(pendingFile, organ);
      }
    });
  });

  /* Listener sur le bouton retour */
  const backBtn = document.getElementById("backBtn");
  if(backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideOrganModal();
    });
  }
  
  /* Fermeture du modal si on clique sur le fond */
  const organModal = document.getElementById("organModal");
  organModal.addEventListener("click", (e) => {
    if(e.target === organModal) {
      hideOrganModal();
    }
  });

  /* Empêcher la propagation des clics dans le contenu du modal */
  const organContent = document.querySelector(".organ-content");
  if(organContent) {
    organContent.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});
