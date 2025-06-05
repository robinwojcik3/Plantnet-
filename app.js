/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;

/* ================================================================
   INITIALISATION IndexedDB POUR SAUVEGARDE LOCALE DES PHOTOS
   ================================================================ */
let db = null;
let dbInitPromise = null;

function initPhotoDB() {
    if (dbInitPromise) return dbInitPromise;

    dbInitPromise = new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        console.log("Initialisation de IndexedDB 'plantPhotosDB'...");
        const request = indexedDB.open("plantPhotosDB", 1); 

        request.onupgradeneeded = function(event) {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains("photosStore")) {
                const photoStore = dbInstance.createObjectStore("photosStore", { autoIncrement: true });
                photoStore.createIndex("timestamp_idx", "timestamp", { unique: false });
                photoStore.createIndex("name_idx", "name", { unique: false });
                console.log("IndexedDB: photosStore créé.");
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("IndexedDB: plantPhotosDB ouvert avec succès.");
            db.onerror = (dbEvent) => {
                console.error("Erreur de base de données IndexedDB (global): " + (dbEvent.target.error ? dbEvent.target.error.message : dbEvent.target.errorCode));
            };
            resolve(db);
        };

        request.onerror = function(event) {
            console.error("Erreur d'ouverture de IndexedDB:", event.target.error);
            dbInitPromise = null; 
            reject(event.target.error);
        };
        request.onblocked = function(event) {
            console.warn("Ouverture d'IndexedDB bloquée. Fermez les autres instances de l'application.");
            alert("L'application a besoin de mettre à jour la base de données locale. Veuillez fermer les autres onglets de cette application et rafraîchir.");
            dbInitPromise = null;
            reject(new Error("Ouverture IndexedDB bloquée"));
        };
    });
    return dbInitPromise;
}

initPhotoDB().catch(err => {
    console.error("Échec de l'initialisation de la base de données locale au démarrage:", err);
});

async function savePhotoToDB(imageFile) {
    if (!imageFile || !(imageFile instanceof Blob)) { 
        console.warn("Tentative de sauvegarde d'un objet invalide ou non défini. Attendu: File/Blob.", imageFile);
        return;
    }

    try {
        if (!db) {
            console.log("savePhotoToDB: La base de données n'est pas prête, attente de initPhotoDB...");
            await initPhotoDB(); 
            if (!db) { 
                 console.error("savePhotoToDB: Échec de l'initialisation de la DB, impossible de sauvegarder la photo.");
                 return;
            }
        }

        const transaction = db.transaction(["photosStore"], "readwrite");
        const store = transaction.objectStore("photosStore");
        
        const photoEntry = {
            imageFile: imageFile, 
            name: imageFile.name || `photo_${Date.now()}.${imageFile.type.split('/')[1] || 'jpg'}`,
            type: imageFile.type,
            size: imageFile.size,
            timestamp: new Date().toISOString()
        };

        const addRequest = store.add(photoEntry);

        addRequest.onsuccess = function(event) {
            console.log("Photo sauvegardée localement dans IndexedDB avec la clé:", event.target.result, "Nom:", photoEntry.name);
        };
        addRequest.onerror = function(event) {
            console.error("Erreur de sauvegarde de la photo dans IndexedDB:", event.target.error);
        };
    } catch (error) {
        console.error("Erreur inattendue dans savePhotoToDB:", error);
    }
}

function downloadPhotoForDeviceGallery(imageBlob, filename) {
    if (!imageBlob || !(imageBlob instanceof Blob)) {
        console.error("downloadPhotoForDeviceGallery: imageBlob invalide.");
        return;
    }
    const defaultFilename = `plantouille_${Date.now()}.${imageBlob.type.split('/')[1] || 'jpg'}`;
    const effectiveFilename = filename || defaultFilename;

    const url = URL.createObjectURL(imageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = effectiveFilename;
    document.body.appendChild(a);
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url); 
    console.log("Tentative de téléchargement de la photo pour la galerie:", effectiveFilename);
}


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
    Object.entries(j).forEach(([complexKey, value]) => {
        const scientificNamePart = complexKey.split(';')[0].trim();
        ecology[norm(scientificNamePart)] = value;
    });
    console.log("Ecology.json chargé. Clés normalisées basées sur la partie nom scientifique uniquement.");
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
  if (!fileBlob || !(fileBlob instanceof Blob)) {
    alert("Erreur: Image invalide pour identification.");
    return;
  }
  try {
    await ready; 
  } catch (err) {
     alert("Erreur critique lors du chargement des données. Veuillez réessayer.");
     return;
  }

  const fd = new FormData();
  fd.append("images", fileBlob, fileBlob.name || "photo.jpg");
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
    if (file instanceof Blob) { 
        const fileName = file.name || `photo_${index}.jpg`;
        fd.append("images", file, fileName);
    } else {
        console.warn(`Élément invalide dans filesArray à l'index ${index}, ignoré.`);
    }
  });
  organsArray.forEach(organ => {
    fd.append("organs", organ);
  });

  if (!fd.has("images")) {
      alert("Aucune image valide n'a pu être préparée pour l'envoi.");
      return;
  }

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
      <td>${eco}</td> <td>${link(cd && inpnCarte(cd),"carte")}</td>
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
      <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p> ${iframeHTML}`;
    zone.appendChild(details);
  });
}

/* ================================================================
   LOGIQUE COMMUNE DE TRAITEMENT DE FICHIER IMAGE (pour single image flow)
   ================================================================ */
function handleSingleFileSelect(file, sourceType) { 
  if (!file) return;
  console.log(`Image unique sélectionnée depuis ${sourceType || 'source inconnue'}:`, file.name, "Type:", file.type, "Taille:", file.size);

  savePhotoToDB(file).catch(err => {
      console.error(`La sauvegarde locale (IndexedDB) de la photo depuis ${sourceType || 'source inconnue'} a échoué:`, err);
  });

  if (sourceType === 'capture') {
      downloadPhotoForDeviceGallery(file, file.name || `plantouille_capture_${Date.now()}.${file.type.split('/')[1] || 'jpg'}`);
  }

  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result); 
    console.log("Image unique (DataURL) sauvegardée dans sessionStorage; redirection vers organ.html.");
    sessionStorage.removeItem("speciesQueryName"); 
    sessionStorage.removeItem("identificationResults");
    location.href = "organ.html";
  };
  reader.onerror = () => {
    console.error("Erreur lors de la lecture du fichier image pour DataURL.");
    alert("Erreur lors de la lecture de l'image.");
  };
  reader.readAsDataURL(file); 
}

/* ================================================================
   ÉCOUTEURS ET LOGIQUE SPÉCIFIQUE AUX PAGES
   ================================================================ */

if (document.getElementById("file-capture")) { 
  
  const fileCaptureInput = document.getElementById("file-capture");
  const fileGalleryInput = document.getElementById("file-gallery");
  const speciesSearchInput = document.getElementById("species-search-input");
  const speciesSearchButton = document.getElementById("species-search-button");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");

  let selectedMultiFilesData = []; 

  if (fileCaptureInput) {
    fileCaptureInput.addEventListener("change", e => {
      handleSingleFileSelect(e.target.files[0], 'capture'); 
    });
  }

  if (fileGalleryInput) {
    fileGalleryInput.addEventListener("change", e => {
      handleSingleFileSelect(e.target.files[0], 'gallery'); 
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
        let taxrefOriginalData = null;
        try {
            taxrefOriginalData = JSON.parse(await (await fetch("taxref.json")).text());
        } catch (e) { console.error("Impossible de récupérer taxref.json pour les noms originaux", e); }

        if (taxrefOriginalData) {
            const originalTaxrefKeys = Object.keys(taxrefOriginalData);
            foundSpeciesName = originalTaxrefKeys.find(key => norm(key) === normalizedQuery);
        }
        if (!foundSpeciesName && taxref[normalizedQuery]) { 
            foundSpeciesName = normalizedQuery; 
        }
        
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

  function renderMultiImageList() {
    if (!multiImageListArea || !multiImageIdentifyButton || !multiFileInput) return; 
    multiImageListArea.innerHTML = ''; 
    if (selectedMultiFilesData.length === 0) {
        multiImageIdentifyButton.style.display = 'none';
        multiFileInput.value = '';
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
        organSelect.dataset.index = index; 
        ['leaf', 'flower', 'fruit', 'bark'].forEach(organValue => {
            const option = document.createElement('option');
            option.value = organValue;
            option.textContent = organValue.charAt(0).toUpperCase() + organValue.slice(1);
            organSelect.appendChild(option);
        });
        organSelect.value = item.organ; 
        organSelect.addEventListener('change', (e) => {
            const itemIndex = parseInt(e.target.dataset.index, 10);
            selectedMultiFilesData[itemIndex].organ = e.target.value; 
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '✖';
        deleteButton.className = 'delete-file-btn';
        deleteButton.type = 'button';
        deleteButton.dataset.index = index;
        deleteButton.title = "Supprimer cette image";
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
    renderMultiImageList();
  }

  if (multiFileInput && multiImageListArea && multiImageIdentifyButton) {
    multiFileInput.addEventListener("change", event => {
      const files = Array.from(event.target.files);
      const currentFileCount = selectedMultiFilesData.length;
      const remainingSlots = MAX_MULTI_IMAGES - currentFileCount;
      
      let filesActuallyAddedCount = 0;
      if (remainingSlots <= 0 && files.length > 0) {
          alert(`Vous avez déjà atteint la limite de ${MAX_MULTI_IMAGES} images. Impossible d'en ajouter plus.`);
          multiFileInput.value = '';
          return;
      }

      files.slice(0, remainingSlots).forEach(file => {
        const isAlreadySelected = selectedMultiFilesData.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified);
        if (!isAlreadySelected) {
            selectedMultiFilesData.push({ file: file, organ: 'leaf' });
            filesActuallyAddedCount++;
        } else {
            console.log(`Fichier "${file.name}" déjà sélectionné ou identique.`);
        }
      });

      if (files.length > 0 && filesActuallyAddedCount < files.length && selectedMultiFilesData.length === MAX_MULTI_IMAGES) {
          alert(`Limite de ${MAX_MULTI_IMAGES} images atteinte. Certaines images n'ont pas été ajoutées.`);
      }
      
      renderMultiImageList();
      multiFileInput.value = ''; 
    });

    multiImageIdentifyButton.addEventListener("click", async () => {
      if (selectedMultiFilesData.length === 0) {
        alert("Veuillez sélectionner au moins une image.");
        return;
      }
      
      const filesToSend = selectedMultiFilesData.map(item => item.file);
      const organsToSend = selectedMultiFilesData.map(item => item.organ); 
      
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
    
    const resultsDiv = document.getElementById("results");
    const cardsDiv = document.getElementById("cards");
    if(resultsDiv) resultsDiv.innerHTML = "";
    if(cardsDiv) cardsDiv.innerHTML = "";   

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
            if(resultsDiv) resultsDiv.innerHTML = `<p>Données détaillées non trouvées pour ${speciesName}.</p>`;
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
