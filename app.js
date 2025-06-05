/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;

/* ================================================================
   FONCTION DE NORMALISATION
   ================================================================ */
function norm(txt){
  if (typeof txt !== 'string') return "";
  return txt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/\s+/g," ");
}

/* ================================================================
   CHARGEMENT DES JSON LOCAUX
   ================================================================ */
let taxref   = {};
let ecology  = {};

const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => {
    Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v);
    console.log("Taxref.json chargé et normalisé.");
  }),
  fetch("ecology.json").then(r => r.json()).then(j => {
    Object.entries(j).forEach(([k,v]) => ecology[norm(k)] = v);
    console.log("Ecology.json chargé et normalisé.");
  })
]).catch(err => {
  alert("Erreur chargement des fichiers locaux : " + err);
  console.error("Erreur chargement des fichiers locaux:", err);
});

/* ================================================================
   HELPERS URLS
   ================================================================ */
const cdRef      = n => taxref[norm(n)];
const ecolOf     = n => ecology[norm(n)] || "—";
const slug       = n => norm(n).replace(/ /g,"-");

const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnCarte  = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/carte`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=239.6&lat=44.57641801313443&lon=4.9718137085437775#tab_mapView`;

const proxyCarte  = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=carte`;
const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;

/* ================================================================
   IDENTIFICATION Pl@ntNet (pour images)
   ================================================================ */
async function identify(file, organ){
  console.log("Fonction identify appelée avec organe:", organ, "et fichier:", file ? "Oui" : "Non");
  if (!file) {
    console.error("Aucun fichier fourni à identify.");
    alert("Erreur: Aucune image à identifier.");
    return;
  }
  try {
    await ready; // Assure que taxref et ecology sont chargés
  } catch (err) {
    console.error("Erreur lors de l'attente du chargement des données locales (ready):", err);
    alert("Erreur critique lors du chargement des données. Veuillez réessayer.");
    return;
  }

  const fd = new FormData();
  fd.append("images", file, "photo.jpg");
  fd.append("organs", organ); 

  console.log(`Envoi de la requête à l'API PlantNet pour l'organe: ${organ}`);
  try {
    const res = await fetch(ENDPOINT, { method:"POST", body:fd });
    if(!res.ok){
      const errorBody = await res.json().catch(() => res.text());
      console.error("Erreur API Pl@ntNet:", res.status, errorBody);
      let alertMessage = `Erreur API Pl@ntNet (${res.status})`;
      if (typeof errorBody === 'object' && errorBody !== null && errorBody.message) {
        alertMessage += `: ${errorBody.message}`;
      } else if (typeof errorBody === 'string') {
        alertMessage += `: ${errorBody}`;
      }
      alert(alertMessage);
      return;
    }
    const responseData = await res.json();
    const results = responseData.results.slice(0, MAX_RESULTS);
    document.body.classList.remove("home");
    buildTable(results);
    buildCards(results);
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API PlantNet ou du traitement des résultats:", error);
    alert("Une erreur est survenue lors de l'identification: " + error.message);
  }
}

/* ================================================================
   CONSTRUCTION DU TABLEAU ET DES FICHES DE RÉSULTATS
   ================================================================ */
function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;
  wrap.innerHTML = ""; 

  const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN carte","INPN statut","Biodiv'AURA","OpenObs"];
  const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";

  const rows = items.map(item => { // 'item' peut venir de l'API ou d'une recherche locale
    const score = item.score !== undefined ? Math.round(item.score * 100) : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const cd   = cdRef(sci); // cdRef utilise norm(sci) implicitement
    const eco  = ecolOf(sci);  // ecolOf utilise norm(sci) implicitement
    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${score}</td>
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

function buildCards(items){
  const zone = document.getElementById("cards");
  if (!zone) return;
  zone.innerHTML = ""; 

  items.forEach(item => {
    const sci = item.species.scientificNameWithoutAuthor;
    const cd  = cdRef(sci); 
    if(!cd && item.score === undefined) { // Cas d'une recherche par nom sans CD_REF mais on veut afficher le nom
        // Option: afficher une carte simplifiée ou un message
    } else if (!cd) { // Cas d'un résultat API sans CD_REF correspondant localement
        return; 
    }
    const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info";

    const details = document.createElement("details");
    details.innerHTML = `
      <summary>${sci} — ${pct}${item.score !== undefined ? '%' : ''}</summary>
      <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>
      <div class="iframe-grid">
        <iframe loading="lazy" src="${proxyCarte(cd)}"  title="Carte INPN"></iframe>
        <iframe loading="lazy" src="${proxyStatut(cd)}" title="Statut INPN"></iframe>
        <iframe loading="lazy" src="${aura(cd)}"        title="Biodiv'AURA"></iframe>
        <iframe loading="lazy" src="${openObs(cd)}"     title="OpenObs"></iframe>
      </div>`;
    zone.appendChild(details);
  });
}

/* ================================================================
   LOGIQUE COMMUNE DE TRAITEMENT DE FICHIER IMAGE
   ================================================================ */
function handleFileSelect(file) {
  if (!file) return;
  console.log("Image sélectionnée:", file.name);
  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result);
    console.log("Image sauvegardée dans sessionStorage; redirection vers organ.html.");
    // Effacer une éventuelle recherche par nom précédente
    sessionStorage.removeItem("speciesQueryName"); 
    location.href = "organ.html";
  };
  reader.onerror = () => {
    console.error("Erreur lors de la lecture du fichier image.");
    alert("Erreur lors de la lecture de l'image.");
  };
  reader.readAsDataURL(file);
}

/* ================================================================
   ÉCOUTEURS ET LOGIQUE SPÉCIFIQUE AUX PAGES
   ================================================================ */

// --- Logique pour INDEX.HTML ---
const fileCaptureInput = document.getElementById("file-capture");
const fileGalleryInput = document.getElementById("file-gallery");
const speciesSearchInput = document.getElementById("species-search-input");
const speciesSearchButton = document.getElementById("species-search-button");
const organBox = document.getElementById("organ-choice"); // Pourra être null sur index.html

if (fileCaptureInput && fileGalleryInput && speciesSearchButton) { // Assure qu'on est sur index.html
  
  fileCaptureInput.addEventListener("change", e => {
    handleFileSelect(e.target.files[0]);
  });

  fileGalleryInput.addEventListener("change", e => {
    handleFileSelect(e.target.files[0]);
  });

  const performSpeciesSearch = async () => {
    const query = speciesSearchInput.value.trim();
    if (!query) {
      alert("Veuillez entrer un nom d'espèce à rechercher.");
      return;
    }
    console.log("Recherche par nom d'espèce:", query);

    try {
        await ready; // S'assurer que taxref et ecology sont chargés
        const normalizedQuery = norm(query);
        let foundSpeciesName = null;

        // Chercher la clé correspondante dans taxref (qui sont déjà normalisées à l'init)
        if (taxref[normalizedQuery]) {
            // Trouver la clé originale non-normalisée serait idéal pour l'affichage, 
            // mais nos objets taxref et ecology sont indexés par nom normalisé.
            // Nous allons utiliser la clé normalisée si c'est la seule disponible pour récupérer cdRef/ecolOf
            // Il faudrait idéalement une structure qui conserve le nom original.
            // Pour l'instant, on assume que le nom normalisé est acceptable pour affichage, ou qu'on le retrouve.
            // Pour retrouver le nom original, il faudrait parcourir Object.keys(j) de taxref.json original.
            // Simplification: on utilise la query normalisée comme base si elle matche une clé.
            foundSpeciesName = Object.keys(taxref).find(key => key === normalizedQuery);
             if (!foundSpeciesName) { // Fallback si la clé exacte n'est pas retrouvée (devrait l'être)
                // Ceci est une tentative pour retrouver une clé qui, une fois normalisée, correspond.
                // Cela suppose que les clés de `taxref` sont déjà normalisées à l'initialisation.
                // Si on veut le nom original, il faudrait le stocker.
                // Pour cette version, on va passer le nom normalisé qui a matché une clé.
                 foundSpeciesName = normalizedQuery; 
             }
        } else {
             // Tentative de recherche plus flexible (ex: "Abies Alba" pour "abies alba")
             const originalTaxrefKeys = Object.keys(JSON.parse(await (await fetch("taxref.json")).text()));
             foundSpeciesName = originalTaxrefKeys.find(key => norm(key) === normalizedQuery);
        }


        if (foundSpeciesName && cdRef(foundSpeciesName)) { // cdRef normalise à nouveau, donc c'est ok
            console.log("Espèce trouvée localement:", foundSpeciesName, "CD_REF:", cdRef(foundSpeciesName));
            sessionStorage.setItem("speciesQueryName", foundSpeciesName); // Stocker le nom trouvé
            sessionStorage.removeItem("photoData"); // Effacer une éventuelle photo précédente
            location.href = "organ.html";
        } else {
            alert(`L'espèce "${query}" n'a pas été trouvée dans nos données locales.`);
            console.warn(`Espèce non trouvée pour la requête normalisée: "${normalizedQuery}"`);
        }
    } catch (err) {
        console.error("Erreur lors de la recherche d'espèce:", err);
        alert("Une erreur est survenue lors de la recherche.");
    }
  };

  speciesSearchButton.addEventListener("click", performSpeciesSearch);
  speciesSearchInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
      performSpeciesSearch();
    }
  });

}


// --- Logique pour ORGAN.HTML ---
if (organBox) { // Assure qu'on est sur organ.html (ou une page avec organBox)
  
  const displaySpeciesNameResults = async (speciesName) => {
    console.log("Affichage des résultats pour la recherche par nom:", speciesName);
    if (document.getElementById("preview")) document.getElementById("preview").style.display = 'none';
    if (organBox) organBox.style.display = 'none';
    document.getElementById("results").innerHTML = ""; // Nettoyer la zone
    document.getElementById("cards").innerHTML = "";   // Nettoyer la zone

    try {
        await ready; // S'assurer que taxref et ecology sont chargés
        
        // Récupérer le CD_REF et l'écologie. cdRef et ecolOf utilisent des noms normalisés.
        // Il est important que speciesName soit la version correcte pour ces fonctions.
        // Si speciesName est déjà la clé normalisée, c'est bon.
        // Si c'est le nom original, cdRef et ecolOf le normaliseront.
        const scientificNameForLookup = speciesName; // Assumons que speciesName est la bonne clé ou sera normalisée par les helpers

        if (cdRef(scientificNameForLookup)) { // Vérifie si l'espèce est dans taxref
            const resultsForDisplay = [{
                score: 1.00, // Score de 100% pour une correspondance directe par nom
                species: {
                    scientificNameWithoutAuthor: speciesName, // Afficher le nom tel que recherché/trouvé
                    scientificNameAuthorship: "", 
                    scientificName: speciesName, 
                    // Les informations de genre/famille ne sont pas directement dans taxref.json/ecology.json
                    // On pourrait les déduire ou les omettre pour la recherche par nom.
                    genus: { scientificNameWithoutAuthor: speciesName.split(' ')[0], scientificNameAuthorship: "", scientificName: speciesName.split(' ')[0] },
                    family: { scientificNameWithoutAuthor: "N/A", scientificNameAuthorship: "", scientificName: "N/A" },
                    commonNames: [] // Non disponible dans les JSON fournis
                }
            }];
            document.body.classList.remove("home");
            buildTable(resultsForDisplay);
            buildCards(resultsForDisplay);
        } else {
            document.getElementById("results").innerHTML = `<p>Données détaillées non trouvées pour ${speciesName}.</p>`;
            console.warn("CD_REF non trouvé pour ", speciesName, "après redirection.");
        }
    } catch (err) {
        console.error("Erreur lors de l'affichage des résultats de recherche par nom:", err);
        alert("Erreur lors de l'affichage des informations de l'espèce.");
    }
  };

  const speciesQueryName = sessionStorage.getItem("speciesQueryName");
  const storedImage = sessionStorage.getItem("photoData");

  if (speciesQueryName) {
    sessionStorage.removeItem("speciesQueryName"); // Important: consommer l'item
    displaySpeciesNameResults(speciesQueryName);
  } else if (storedImage) {
    const previewElement = document.getElementById("preview");
    if(previewElement) {
        previewElement.src = storedImage;
        previewElement.style.display = 'block';
    }
    if (organBox) organBox.style.display = 'block'; // S'assurer que les boutons d'organe sont visibles

    const toBlob = dataURL => {
      try {
        const [meta, b64] = dataURL.split(",");
        if (!meta || !b64) throw new Error("Format DataURL invalide");
        const mimeMatch = /:(.*?);/.exec(meta);
        if (!mimeMatch || !mimeMatch[1]) throw new Error("Type MIME non trouvé dans DataURL");
        const mime = mimeMatch[1];
        const bin = atob(b64);
        let arr = new Uint8Array(bin.length);
        for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], {type:mime});
      } catch (e) {
        console.error("Erreur dans toBlob:", e);
        return null;
      }
    };
    
    const imageBlob = toBlob(storedImage); 
    if (!imageBlob) {
        alert("Erreur lors de la préparation de l'image pour l'envoi. Veuillez retourner à l'accueil.");
    }

    const handleOrganChoice = async (event) => {
      console.log("Bouton organe cliqué:", event.currentTarget.dataset.organ);
      if (!imageBlob) {
        console.error("L'image n'a pas pu être convertie en Blob. Impossible d'identifier.");
        alert("Erreur: L'image n'est pas prête pour l'identification. Veuillez retourner à l'accueil.");
        return;
      }
      const selectedOrgan = event.currentTarget.dataset.organ;
      await identify(imageBlob, selectedOrgan);
    };

    organBox.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", handleOrganChoice);
    });
    console.log("Écouteurs d'événements attachés aux boutons d'organe pour identification d'image.");
  } else {
    // Ni recherche par nom, ni image stockée
    console.warn("Aucune photoData ni speciesQueryName trouvée, redirection vers index.html.");
    location.href = "index.html";
  }
}
