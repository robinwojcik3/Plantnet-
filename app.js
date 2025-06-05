/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5; // Limite pour l'identification multi-images

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
  }).catch(err => console.error("Erreur chargement taxref.json:", err)),
  fetch("ecology.json").then(r => r.json()).then(j => {
    Object.entries(j).forEach(([k,v]) => ecology[norm(k)] = v);
    console.log("Ecology.json chargé et normalisé.");
  }).catch(err => console.error("Erreur chargement ecology.json:", err))
]).catch(err => {
  alert("Erreur chargement des fichiers de données locaux : " + err.message);
  console.error("Erreur globale chargement des fichiers locaux:", err);
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
   APPEL À L'API PlantNet (générique pour résultats)
   ================================================================ */
async function callPlantNetAPI(formData) {
  console.log("Appel à l'API PlantNet...");
  try {
    const res = await fetch(ENDPOINT, { method: "POST", body: formData });
    if (!res.ok) {
      const errorBody = await res.json().catch(() => res.text());
      console.error("Erreur API Pl@ntNet:", res.status, errorBody);
      let alertMessage = `Erreur API Pl@ntNet (${res.status})`;
      if (typeof errorBody === 'object' && errorBody !== null && errorBody.message) {
        alertMessage += `: ${errorBody.message}`;
      } else if (typeof errorBody === 'string') {
        alertMessage += `: ${errorBody}`;
      }
      alert(alertMessage);
      return null;
    }
    const responseData = await res.json();
    console.log("Réponse API Pl@ntNet reçue:", responseData);
    return responseData.results.slice(0, MAX_RESULTS);
  } catch (error) {
    console.error("Erreur lors de l'appel à l'API PlantNet ou du traitement des résultats:", error);
    alert("Une erreur est survenue lors de l'identification: " + error.message);
    return null;
  }
}

/* ================================================================
   IDENTIFICATION (1 image) - appelée depuis organ.html
   ================================================================ */
async function identifySingleImage(fileBlob, organ) {
  console.log("identifySingleImage appelée avec organe:", organ);
  if (!fileBlob) {
    alert("Erreur: Aucune image à identifier.");
    return;
  }
  try {
    await ready; // Assure que taxref et ecology sont chargés
  } catch (err) {
     alert("Erreur critique lors du chargement des données. Veuillez réessayer.");
     return;
  }

  const fd = new FormData();
  fd.append("images", fileBlob, "photo.jpg");
  fd.append("organs", organ);

  const results = await callPlantNetAPI(fd);
  if (results) {
    document.body.classList.remove("home"); // S'applique à organ.html
    buildTable(results);
    buildCards(results);
    console.log("Affichage des résultats (1 image) terminé.");
  }
}

/* ================================================================
   IDENTIFICATION (multi-images) - appelée depuis index.html
   ================================================================ */
async function identifyMultipleImages(filesArray, organsArray) {
  console.log("identifyMultipleImages appelée avec:", filesArray.length, "images et organes.");
  if (filesArray.length === 0 || filesArray.length !== organsArray.length) {
    alert("Erreur: Le nombre d'images et d'organes ne correspond pas ou est nul.");
    return;
  }
  try {
    await ready;
  } catch (err) {
     alert("Erreur critique lors du chargement des données. Veuillez réessayer.");
     return;
  }

  const fd = new FormData();
  filesArray.forEach((file, index) => {
    // Utiliser le nom original du fichier si disponible, sinon un nom générique
    const fileName = file.name || `photo_${index}.jpg`;
    fd.append("images", file, fileName);
  });
  organsArray.forEach(organ => {
    fd.append("organs", organ);
  });

  const results = await callPlantNetAPI(fd);
  if (results) {
    // Stocker les résultats pour affichage sur organ.html
    sessionStorage.setItem("identificationResults", JSON.stringify(results));
    sessionStorage.removeItem("photoData"); // Effacer données single image
    sessionStorage.removeItem("speciesQueryName"); // Effacer données recherche par nom
    location.href = "organ.html";
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

  const rows = items.map(item => {
    const score = item.score !== undefined ? Math.round(item.score * 100) : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const cd   = cdRef(sci);
    const eco  = ecolOf(sci);
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
    const isNameSearchResult = item.score === 1.00 && items.length === 1; // Heuristique pour recherche par nom

    if(!cd && !isNameSearchResult) return; // Skip si pas de cd_ref pour résultats API
    
    const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info";

    const details = document.createElement("details");
    let iframeHTML = '';
    if (cd) { // Afficher les iframes seulement si cd_ref est disponible
        iframeHTML = `
        <div class="iframe-grid">
            <iframe loading="lazy" src="${proxyCarte(cd)}"  title="Carte INPN"></iframe>
            <iframe loading="lazy" src="${proxyStatut(cd)}" title="Statut INPN"></iframe>
            <iframe loading="lazy" src="${aura(cd)}"        title="Biodiv'AURA"></iframe>
            <iframe loading="lazy" src="${openObs(cd)}"     title="OpenObs"></iframe>
        </div>`;
    }

    details.innerHTML = `
      <summary>${sci} — ${pct}${item.score !== undefined && !isNameSearchResult ? '%' : ''}</summary>
      <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>
      ${iframeHTML}`;
    zone.appendChild(details);
  });
}

/* ================================================================
   LOGIQUE COMMUNE DE TRAITEMENT DE FICHIER IMAGE (pour single image flow)
   ================================================================ */
function handleSingleFileSelect(file) {
  if (!file) return;
  console.log("Image unique sélectionnée:", file.name);
  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result);
    console.log("Image unique sauvegardée; redirection vers organ.html.");
    sessionStorage.removeItem("speciesQueryName"); 
    sessionStorage.removeItem("identificationResults"); // Effacer résultats multi-images potentiels
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
if (document.getElementById("file-capture")) { // On est probablement sur index.html
  
  const fileCaptureInput = document.getElementById("file-capture");
  const fileGalleryInput = document.getElementById("file-gallery");
  const speciesSearchInput = document.getElementById("species-search-input");
  const speciesSearchButton = document.getElementById("species-search-button");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");

  let selectedMultiFilesData = []; // [{file: File, organ: 'leaf', previewUrl: 'data:...'}, ...]

  if (fileCaptureInput) {
    fileCaptureInput.addEventListener("change", e => {
      handleSingleFileSelect(e.target.files[0]);
    });
  }

  if (fileGalleryInput) {
    fileGalleryInput.addEventListener("change", e => {
      handleSingleFileSelect(e.target.files[0]);
    });
  }

  const performSpeciesSearch = async () => {
    const query = speciesSearchInput.value.trim();
    if (!query) {
      alert("Veuillez entrer un nom d'espèce à rechercher.");
      return;
    }
    try {
        await ready;
        const normalizedQuery = norm(query);
        let foundSpeciesName = null;
        const originalTaxrefKeys = Object.keys(JSON.parse(await (await fetch("taxref.json")).text()));
        foundSpeciesName = originalTaxrefKeys.find(key => norm(key) === normalizedQuery) || 
                           (taxref[normalizedQuery] ? normalizedQuery : null); // Utilise la clé normalisée si le nom original n'est pas retrouvé mais que la clé normalisée existe

        if (foundSpeciesName && cdRef(foundSpeciesName)) {
            sessionStorage.setItem("speciesQueryName", foundSpeciesName);
            sessionStorage.removeItem("photoData");
            sessionStorage.removeItem("identificationResults");
            location.href = "organ.html";
        } else {
            alert(`L'espèce "${query}" n'a pas été trouvée dans nos données locales.`);
        }
    } catch (err) {
        console.error("Erreur lors de la recherche d'espèce:", err);
        alert("Une erreur est survenue lors de la recherche.");
    }
  };

  if (speciesSearchButton && speciesSearchInput) {
    speciesSearchButton.addEventListener("click", performSpeciesSearch);
    speciesSearchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") performSpeciesSearch();
    });
  }

  // Logique pour l'upload multi-images
  if (multiFileInput && multiImageListArea && multiImageIdentifyButton) {
    multiFileInput.addEventListener("change", event => {
      multiImageListArea.innerHTML = ''; // Nettoyer la zone
      selectedMultiFilesData = [];
      const files = Array.from(event.target.files).slice(0, MAX_MULTI_IMAGES);

      if (files.length === 0) {
          multiImageIdentifyButton.style.display = 'none';
          return;
      }

      files.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'image-organ-item';
            
            const imgPreview = document.createElement('img');
            imgPreview.src = e.target.result;
            imgPreview.className = 'preview';
            itemDiv.appendChild(imgPreview);

            const fileNameSpan = document.createElement('span');
            fileNameSpan.className = 'file-name';
            fileNameSpan.textContent = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
            itemDiv.appendChild(fileNameSpan);

            const organSelect = document.createElement('select');
            organSelect.id = `organ-select-${index}`;
            ['leaf', 'flower', 'fruit', 'bark'].forEach(organValue => {
                const option = document.createElement('option');
                option.value = organValue;
                option.textContent = organValue.charAt(0).toUpperCase() + organValue.slice(1);
                organSelect.appendChild(option);
            });
            itemDiv.appendChild(organSelect);
            multiImageListArea.appendChild(itemDiv);

            selectedMultiFilesData.push({ file: file, organSelectElement: organSelect, previewUrl: e.target.result });
        }
        reader.readAsDataURL(file);
      });
      multiImageIdentifyButton.style.display = 'block';
    });

    multiImageIdentifyButton.addEventListener("click", async () => {
      if (selectedMultiFilesData.length === 0) {
        alert("Veuillez sélectionner au moins une image.");
        return;
      }
      if (selectedMultiFilesData.length > MAX_MULTI_IMAGES) {
        alert(`Vous ne pouvez sélectionner que ${MAX_MULTI_IMAGES} images au maximum.`);
        return;
      }

      const filesToSend = selectedMultiFilesData.map(item => item.file);
      const organsToSend = selectedMultiFilesData.map(item => item.organSelectElement.value);
      
      // Valider que tous les organes sont sélectionnés (ils auront une valeur par défaut)
      await identifyMultipleImages(filesToSend, organsToSend);
    });
  }
}


// --- Logique pour ORGAN.HTML ---
const organBoxOnPage = document.getElementById("organ-choice"); 
// Ce test est plus fiable pour savoir si on est sur organ.html que `if(organBox)` 
// car organBox est initialisé plus haut et pourrait être null si le script s'exécute avant que le DOM soit prêt pour index.html

if (typeof organBoxOnPage !== 'undefined' && organBoxOnPage !== null) { // Logique spécifique à organ.html
  
  const displaySpeciesNameResults = async (speciesName) => {
    console.log("Affichage des résultats pour la recherche par nom:", speciesName);
    const previewEl = document.getElementById("preview");
    const organChoiceEl = document.getElementById("organ-choice"); // Récupérer à nouveau au cas où
    if (previewEl) previewEl.style.display = 'none';
    if (organChoiceEl) organChoiceEl.style.display = 'none';
    
    document.getElementById("results").innerHTML = "";
    document.getElementById("cards").innerHTML = "";   

    try {
        await ready; 
        const scientificNameForLookup = speciesName; 

        if (cdRef(scientificNameForLookup)) { 
            const resultsForDisplay = [{
                score: 1.00, 
                species: {
                    scientificNameWithoutAuthor: speciesName, 
                    scientificNameAuthorship: "", 
                    scientificName: speciesName, 
                    genus: { scientificNameWithoutAuthor: speciesName.split(' ')[0], scientificNameAuthorship: "", scientificName: speciesName.split(' ')[0] },
                    family: { scientificNameWithoutAuthor: "N/A", scientificNameAuthorship: "", scientificName: "N/A" },
                    commonNames: [] 
                }
            }];
            document.body.classList.remove("home");
            buildTable(resultsForDisplay);
            buildCards(resultsForDisplay);
        } else {
            document.getElementById("results").innerHTML = `<p>Données détaillées non trouvées pour ${speciesName}.</p>`;
        }
    } catch (err) {
        console.error("Erreur lors de l'affichage des résultats de recherche par nom:", err);
        alert("Erreur lors de l'affichage des informations de l'espèce.");
    }
  };

  const displayIdentificationResults = (results) => {
    const previewEl = document.getElementById("preview");
    const organChoiceEl = document.getElementById("organ-choice");
    if (previewEl) previewEl.style.display = 'none'; // Cacher la prévisualisation single-image
    if (organChoiceEl) organChoiceEl.style.display = 'none'; // Cacher la sélection d'organe single-image
    
    document.body.classList.remove("home");
    buildTable(results);
    buildCards(results);
  };


  const speciesQueryName = sessionStorage.getItem("speciesQueryName");
  const storedImage = sessionStorage.getItem("photoData");
  const multiImageResults = sessionStorage.getItem("identificationResults");

  if (speciesQueryName) {
    sessionStorage.removeItem("speciesQueryName");
    displaySpeciesNameResults(speciesQueryName);
  } else if (multiImageResults) {
    sessionStorage.removeItem("identificationResults");
    const parsedResults = JSON.parse(multiImageResults);
    displayIdentificationResults(parsedResults);
  } else if (storedImage) {
    // Logique pour identification d'image unique (existante)
    const previewElement = document.getElementById("preview");
    if(previewElement) {
        previewElement.src = storedImage;
        previewElement.style.display = 'block'; // Assurer la visibilité
    }
    const organChoiceEl = document.getElementById("organ-choice");
    if (organChoiceEl) organChoiceEl.style.display = 'block'; // Assurer la visibilité

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
      } catch (e) { console.error("Erreur dans toBlob:", e); return null; }
    };
    
    const imageBlob = toBlob(storedImage); 
    if (!imageBlob) {
        alert("Erreur lors de la préparation de l'image pour l'envoi. Veuillez retourner à l'accueil.");
    }

    const handleOrganChoice = async (event) => {
      console.log("Bouton organe (single image) cliqué:", event.currentTarget.dataset.organ);
      if (!imageBlob) {
        alert("Erreur: L'image n'est pas prête pour l'identification. Veuillez retourner à l'accueil.");
        return;
      }
      const selectedOrgan = event.currentTarget.dataset.organ;
      await identifySingleImage(imageBlob, selectedOrgan); // Appel de la fonction pour image unique
    };
    
    const currentOrganBox = document.getElementById("organ-choice"); // Utiliser une variable locale
    if(currentOrganBox) {
        currentOrganBox.querySelectorAll("button").forEach(button => {
          button.addEventListener("click", handleOrganChoice);
        });
        console.log("Écouteurs d'événements attachés aux boutons d'organe pour identification d'image unique.");
    }
  } else {
    console.warn("Organ.html: Aucune donnée à afficher (pas de recherche par nom, pas de résultats multi-images, pas d'image unique). Redirection.");
    location.href = "index.html";
  }
}
