/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;

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
    await ready; 
  } catch (err) {
     alert("Erreur critique lors du chargement des données. Veuillez réessayer.");
     return;
  }

  const fd = new FormData();
  fd.append("images", fileBlob, "photo.jpg");
  fd.append("organs", organ);

  const results = await callPlantNetAPI(fd);
  if (results) {
    document.body.classList.remove("home"); 
    buildTable(results);
    buildCards(results);
    console.log("Affichage des résultats (1 image) terminé.");
  }
}

/* ================================================================
   IDENTIFICATION (multi-images) - appelée depuis index.html
   ================================================================ */
async function identifyMultipleImages(filesArray, organsArray) {
  console.log("identifyMultipleImages appelée avec:", filesArray.length, "images et organes correspondants:", organsArray);
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
    const fileName = file.name || `photo_${index}.jpg`;
    fd.append("images", file, fileName);
  });
  organsArray.forEach(organ => {
    fd.append("organs", organ);
  });

  const results = await callPlantNetAPI(fd);
  if (results) {
    sessionStorage.setItem("identificationResults", JSON.stringify(results));
    sessionStorage.removeItem("photoData"); 
    sessionStorage.removeItem("speciesQueryName"); 
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
    const isNameSearchResult = item.score === 1.00 && items.length === 1;

    if(!cd && !isNameSearchResult) return; 
    
    const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info";

    const details = document.createElement("details");
    let iframeHTML = '';
    if (cd) {
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
    sessionStorage.removeItem("identificationResults");
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
if (document.getElementById("file-capture")) { 
  
  const fileCaptureInput = document.getElementById("file-capture");
  const fileGalleryInput = document.getElementById("file-gallery");
  const speciesSearchInput = document.getElementById("species-search-input");
  const speciesSearchButton = document.getElementById("species-search-button");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");

  let selectedMultiFilesData = []; // Structure: [{file: FileObject, organ: 'leaf'}, ...]

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
                           (taxref[normalizedQuery] ? normalizedQuery : null);

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

  // --- Logique pour la section multi-images sur index.html ---
  function renderMultiImageList() {
    multiImageListArea.innerHTML = ''; 
    if (selectedMultiFilesData.length === 0) {
        multiImageIdentifyButton.style.display = 'none';
        // Ne pas réinitialiser multiFileInput.value ici, car cela empêcherait la séléction des mêmes fichiers
        // si l'utilisateur annule et recommence sans recharger la page.
        return;
    }

    selectedMultiFilesData.forEach((item, index) => {
        const listItemDiv = document.createElement('div');
        listItemDiv.className = 'image-organ-item';

        const fileInfoSpan = document.createElement('span');
        fileInfoSpan.className = 'file-info';
        
        const fileIndexSpan = document.createElement('span');
        fileIndexSpan.className = 'file-index';
        fileIndexSpan.textContent = `Image ${index + 1}:`;
        fileInfoSpan.appendChild(fileIndexSpan);

        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = ` ${item.file.name.length > 20 ? item.file.name.substring(0, 17) + '...' : item.file.name}`;
        fileInfoSpan.appendChild(fileNameSpan);
        
        const organSelect = document.createElement('select');
        organSelect.dataset.index = index; // Lier le select à l'item de données
        ['leaf', 'flower', 'fruit', 'bark'].forEach(organValue => {
            const option = document.createElement('option');
            option.value = organValue;
            option.textContent = organValue.charAt(0).toUpperCase() + organValue.slice(1);
            organSelect.appendChild(option);
        });
        organSelect.value = item.organ || 'leaf'; // Appliquer la valeur stockée ou 'leaf' par défaut
        organSelect.addEventListener('change', (e) => {
            const itemIndex = parseInt(e.target.dataset.index, 10);
            selectedMultiFilesData[itemIndex].organ = e.target.value; // Mettre à jour l'organe dans notre tableau
            console.log(`Organe pour image ${itemIndex + 1} changé en: ${selectedMultiFilesData[itemIndex].organ}`);
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '✖';
        deleteButton.className = 'delete-file-btn';
        deleteButton.type = 'button';
        deleteButton.dataset.index = index;
        deleteButton.addEventListener('click', handleDeleteMultiFile);

        listItemDiv.appendChild(fileInfoSpan);
        listItemDiv.appendChild(organSelect);
        listItemDiv.appendChild(deleteButton);
        multiImageListArea.appendChild(listItemDiv);
    });
    multiImageIdentifyButton.style.display = 'block';
  }

  function handleDeleteMultiFile(event) {
    const indexToRemove = parseInt(event.currentTarget.dataset.index, 10);
    selectedMultiFilesData.splice(indexToRemove, 1);
    // Si c'est le dernier fichier, il faut aussi vider l'input file pour permettre de re-sélectionner le même fichier
    if (selectedMultiFilesData.length === 0) {
        multiFileInput.value = ''; // Réinitialiser l'input file
    }
    renderMultiImageList();
  }

  if (multiFileInput && multiImageListArea && multiImageIdentifyButton) {
    multiFileInput.addEventListener("change", event => {
      const files = Array.from(event.target.files);
      // Concaténer avec les fichiers déjà sélectionnés, en respectant la limite
      const totalFilesAfterAdd = selectedMultiFilesData.length + files.length;
      
      let filesToAdd = [];
      if (totalFilesAfterAdd > MAX_MULTI_IMAGES) {
          const remainingSlots = MAX_MULTI_IMAGES - selectedMultiFilesData.length;
          if (remainingSlots > 0) {
              filesToAdd = files.slice(0, remainingSlots);
              alert(`Vous ne pouvez ajouter que ${remainingSlots} image(s) de plus. ${files.length - remainingSlots} image(s) n'ont pas été ajoutée(s).`);
          } else {
              alert(`Vous avez déjà atteint la limite de ${MAX_MULTI_IMAGES} images.`);
          }
      } else {
          filesToAdd = files;
      }

      filesToAdd.forEach(file => {
        // Vérifier si le fichier n'est pas déjà dans la liste (basé sur le nom et la taille pour une simple vérification)
        const isAlreadySelected = selectedMultiFilesData.some(item => item.file.name === file.name && item.file.size === file.size);
        if (!isAlreadySelected && selectedMultiFilesData.length < MAX_MULTI_IMAGES) {
            selectedMultiFilesData.push({ file: file, organ: 'leaf' }); // 'leaf' par défaut
        } else if (isAlreadySelected) {
            console.log(`Fichier "${file.name}" déjà sélectionné.`);
        }
      });
      renderMultiImageList();
      // Ne pas réinitialiser multiFileInput.value ici pour permettre d'ajouter d'autres fichiers plus tard
      // sauf si l'utilisateur le fait manuellement ou qu'on fournit un bouton "vider la sélection"
    });

    multiImageIdentifyButton.addEventListener("click", async () => {
      if (selectedMultiFilesData.length === 0) {
        alert("Veuillez sélectionner au moins une image.");
        return;
      }
      // La validation de MAX_MULTI_IMAGES est déjà gérée à l'ajout
      
      const filesToSend = selectedMultiFilesData.map(item => item.file);
      const organsToSend = selectedMultiFilesData.map(item => item.organ); // L'organe est mis à jour via le 'change' listener du select
      
      await identifyMultipleImages(filesToSend, organsToSend);
    });
  }
}


// --- Logique pour ORGAN.HTML ---
const organBoxOnPage = document.getElementById("organ-choice"); 

if (typeof organBoxOnPage !== 'undefined' && organBoxOnPage !== null) { 
  
  const displaySpeciesNameResults = async (speciesName) => {
    console.log("Affichage des résultats pour la recherche par nom:", speciesName);
    const previewEl = document.getElementById("preview");
    const organChoiceEl = document.getElementById("organ-choice");
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
    if (previewEl) previewEl.style.display = 'none';
    if (organChoiceEl) organChoiceEl.style.display = 'none';
    
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
    try {
        const parsedResults = JSON.parse(multiImageResults);
        displayIdentificationResults(parsedResults);
    } catch (e) {
        console.error("Erreur parsing des résultats d'identification multiple:", e);
        alert("Impossible d'afficher les résultats de l'identification multiple.");
        location.href = "index.html";
    }
  } else if (storedImage) {
    const previewElement = document.getElementById("preview");
    if(previewElement) {
        previewElement.src = storedImage;
        previewElement.style.display = 'block';
    }
    const organChoiceEl = document.getElementById("organ-choice");
    if (organChoiceEl) organChoiceEl.style.display = 'block';

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
      await identifySingleImage(imageBlob, selectedOrgan);
    };
    
    const currentOrganBox = document.getElementById("organ-choice"); 
    if(currentOrganBox) {
        currentOrganBox.querySelectorAll("button").forEach(button => {
          button.addEventListener("click", handleOrganChoice);
        });
        console.log("Écouteurs d'événements attachés aux boutons d'organe pour identification d'image unique.");
    }
  } else {
    console.warn("Organ.html: Aucune donnée à afficher. Redirection vers index.html.");
    location.href = "index.html";
  }
}
