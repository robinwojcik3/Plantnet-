/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;
const GEMINI_API_KEY = "AIzaSyDDv4amCchpTXGqz6FGuY8mxPClkw-uwMs";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/* ================================================================
   GESTION DE LA GÉOLOCALISATION
   ================================================================ */
// Coordonnées par défaut (Grenoble, France) si la géolocalisation échoue ou est refusée.
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

/**
 * Demande la géolocalisation de l'utilisateur.
 * REMARQUE : Pour des raisons de sécurité et de respect de la vie privée, tous les navigateurs
 * modernes EXIGENT que l'utilisateur donne son autorisation pour partager sa position.
 * Cette demande d'autorisation n'est faite qu'une seule fois ; le navigateur mémorise ensuite le choix.
 * Il est techniquement impossible d'obtenir la position GPS sans cette permission initiale.
 */
function requestUserLocation() {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log("Géolocalisation de l'utilisateur obtenue :", userLocation);
      },
      (error) => {
        console.warn(`ERREUR de géolocalisation (${error.code}): ${error.message}. Utilisation des coordonnées par défaut.`);
      }
    );
  } else {
    console.warn("La géolocalisation n'est pas supportée par ce navigateur. Utilisation des coordonnées par défaut.");
  }
}

// Lancer la demande de géolocalisation au chargement de l'application.
requestUserLocation();


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
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;

function buildOpenObsUrl(cd_ref, location) {
    const lat = location ? location.latitude : 45.188529; 
    const lon = location ? location.longitude : 5.724524;
    return `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${cd_ref}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=120.6&lat=${lat}&lon=${lon}#tab_mapView`;
}

function getLiveUserLocation() {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("La géolocalisation n'est pas supportée par votre navigateur."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            }
        );
    });
}

window.handleOpenObsClick = async function(event, cd_ref) {
    event.preventDefault(); 
    const targetLink = event.currentTarget;
    const originalText = targetLink.textContent;
    targetLink.textContent = 'Localisation...';
    targetLink.style.pointerEvents = 'none';

    try {
        const location = await getLiveUserLocation();
        console.log("Géolocalisation obtenue pour OpenObs:", location);
        const url = buildOpenObsUrl(cd_ref, location);
        window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.error("Échec de l'obtention de la géolocalisation pour OpenObs:", error.message);
        alert("Impossible d'obtenir la localisation. Ouverture de la carte avec une position par défaut.");
        const defaultUrl = buildOpenObsUrl(cd_ref, null); 
        window.open(defaultUrl, '_blank', 'noopener,noreferrer');
    } finally {
        targetLink.textContent = originalText;
        targetLink.style.pointerEvents = 'auto';
    }
}


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

  const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN statut","Biodiv'AURA","OpenObs", "Gemini"];
  const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";

  const rows = items.map(item => {
    const score = item.score !== undefined ? Math.round(item.score * 100) : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const escapedSci = sci.replace(/'/g, "\\'"); // Échapper les apostrophes pour l'attribut onclick
    const cd   = cdRef(sci); 
    const eco  = ecolOf(sci); 
    return `<tr>
      <td>${sci}</td>
      <td style="text-align:center">${score}</td>
      <td>${link(infoFlora(sci),"fiche")}</td>
      <td class="ecology-column">${eco}</td>
      <td>${link(cd && inpnStatut(cd),"statut")}</td>
      <td>${link(cd && aura(cd),"atlas")}</td>
      <td>${cd ? `<a href="#" onclick="handleOpenObsClick(event, '${cd}')" title="Ouvrir la carte avec votre position actuelle">carte</a>` : "—"}</td>
      <td><a href="#" onclick="handleGeminiClick(event, this, '${escapedSci}')">Classifier</a></td>
    </tr>`;
  }).join("");

  const headerHtml = headers.map(h => `<th class="${h === 'Écologie' ? 'ecology-column' : ''}">${h}</th>`).join("");
  wrap.innerHTML = `
    <table>
      <thead><tr>${headerHtml}</tr></thead>
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
        const openObsDefaultUrl = buildOpenObsUrl(cd, null);
        iframeHTML = `
        <div class="iframe-grid">
            <iframe loading="lazy" src="${proxyStatut(cd)}" title="Statut INPN"></iframe>
            <iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe>
            <iframe loading="lazy" src="${openObsDefaultUrl}" title="OpenObs"></iframe>
        </div>`;
    }

    details.innerHTML = `
      <summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary>
      <p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>
      ${iframeHTML}`;
    zone.appendChild(details);
  });
}

/* ================================================================
   LOGIQUE COMMUNE DE TRAITEMENT DE FICHIER IMAGE (pour single image flow)
   ================================================================ */
function handleSingleFileSelect(file, sourceType) { 
  if (!file) return;
  console.log(`Image unique sélectionnée depuis ${sourceType || 'source inconnue'}:`, file.name);

  savePhotoToDB(file).catch(err => {
      console.error(`La sauvegarde locale (IndexedDB) de la photo a échoué:`, err);
  });

  if (sourceType === 'capture') {
      downloadPhotoForDeviceGallery(file);
  }

  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result); 
    sessionStorage.removeItem("speciesQueryName"); 
    sessionStorage.removeItem("identificationResults");
    location.href = "organ.html";
  };
  reader.onerror = () => alert("Erreur lors de la lecture de l'image.");
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

  fileCaptureInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0], 'capture'));
  fileGalleryInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0], 'gallery'));

  const performSpeciesSearch = async () => {
    const query = speciesSearchInput.value.trim();
    if (!query) return alert("Veuillez entrer un nom d'espèce à rechercher.");
    try {
        await ready;
        const normalizedQuery = norm(query);
        let taxrefOriginalData = JSON.parse(await (await fetch("taxref.json")).text());
        const originalTaxrefKeys = Object.keys(taxrefOriginalData);
        let foundSpeciesName = originalTaxrefKeys.find(key => norm(key) === normalizedQuery) || (taxref[normalizedQuery] ? normalizedQuery : null);
        
        if (foundSpeciesName && cdRef(foundSpeciesName)) { 
            sessionStorage.setItem("speciesQueryName", foundSpeciesName);
            ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
            location.href = "organ.html";
        } else {
            alert(`L'espèce "${query}" n'a pas été trouvée dans nos données locales.`);
        }
    } catch (err) {
        console.error("Erreur lors de la recherche d'espèce:", err);
        alert("Une erreur est survenue lors de la recherche.");
    }
  };

  speciesSearchButton?.addEventListener("click", performSpeciesSearch);
  speciesSearchInput?.addEventListener("keypress", e => { if (e.key === "Enter") performSpeciesSearch(); });

  function renderMultiImageList() {
    multiImageListArea.innerHTML = ''; 
    multiImageIdentifyButton.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none';
    if (selectedMultiFilesData.length === 0) multiFileInput.value = '';

    selectedMultiFilesData.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'image-organ-item';
        itemDiv.innerHTML = `
            <span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.length > 20 ? item.file.name.substring(0, 17) + '...' : item.file.name}</span></span>
            <select data-index="${index}">
                <option value="leaf">Feuille</option>
                <option value="flower">Fleur</option>
                <option value="fruit">Fruit</option>
                <option value="bark">Écorce</option>
            </select>
            <button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer cette image">✖</button>`;
        
        itemDiv.querySelector('select').value = item.organ;
        multiImageListArea.appendChild(itemDiv);
    });
  }

  multiImageListArea?.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete-file-btn')) {
        const indexToRemove = parseInt(e.target.dataset.index, 10);
        selectedMultiFilesData.splice(indexToRemove, 1);
        renderMultiImageList();
    }
  });

  multiImageListArea?.addEventListener('change', (e) => {
    if (e.target && e.target.tagName === 'SELECT') {
        const itemIndex = parseInt(e.target.dataset.index, 10);
        selectedMultiFilesData[itemIndex].organ = e.target.value;
    }
  });

  multiFileInput?.addEventListener("change", (event) => {
      const files = Array.from(event.target.files);
      const currentFileCount = selectedMultiFilesData.length;
      const remainingSlots = MAX_MULTI_IMAGES - currentFileCount;
      
      if (remainingSlots <= 0 && files.length > 0) return alert(`Limite de ${MAX_MULTI_IMAGES} images atteinte.`);
      
      files.slice(0, remainingSlots).forEach(file => {
        if (!selectedMultiFilesData.some(item => item.file.name === file.name && item.file.size === file.size)) {
            selectedMultiFilesData.push({ file: file, organ: 'leaf' });
        }
      });
      if (files.length > remainingSlots) alert(`Limite de ${MAX_MULTI_IMAGES} images atteinte. Certaines images n'ont pas été ajoutées.`);
      
      renderMultiImageList();
      multiFileInput.value = ''; 
  });

  multiImageIdentifyButton?.addEventListener("click", () => {
    if (selectedMultiFilesData.length === 0) return alert("Veuillez sélectionner au moins une image.");
    identifyMultipleImages(selectedMultiFilesData.map(item => item.file), selectedMultiFilesData.map(item => item.organ));
  });
}

// --- Logique pour ORGAN.HTML ---
const organBoxOnPage = document.getElementById("organ-choice"); 

if (organBoxOnPage) {
  
  const displayResults = (results, isNameSearch = false) => {
    const previewEl = document.getElementById("preview");
    if (previewEl) previewEl.style.display = 'none';
    if (organBoxOnPage) organBoxOnPage.style.display = 'none';
    document.body.classList.remove("home");
    buildTable(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results);
    buildCards(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results);
  };
  
  const speciesQueryName = sessionStorage.getItem("speciesQueryName");
  const storedImage = sessionStorage.getItem("photoData");
  const multiImageResults = sessionStorage.getItem("identificationResults");

  if (speciesQueryName) {
    sessionStorage.removeItem("speciesQueryName");
    displayResults(speciesQueryName, true);
  } else if (multiImageResults) {
    sessionStorage.removeItem("identificationResults");
    try { displayResults(JSON.parse(multiImageResults)); }
    catch (e) { location.href = "index.html"; }
  } else if (storedImage) {
    const previewElement = document.getElementById("preview");
    if(previewElement) previewElement.src = storedImage;
    if (organBoxOnPage) organBoxOnPage.style.display = 'block';

    const toBlob = dataURL => {
      try {
        const [meta, b64] = dataURL.split(",");
        const mime = /:(.*?);/.exec(meta)[1];
        const bin = atob(b64);
        let arr = new Uint8Array(bin.length);
        for(let i=0; i<bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], {type:mime});
      } catch (e) { console.error("Erreur dans toBlob:", e); return null; }
    };
    
    const imageBlob = toBlob(storedImage); 
    if (imageBlob) {
        organBoxOnPage.querySelectorAll("button").forEach(button => {
          button.addEventListener("click", (e) => identifySingleImage(imageBlob, e.currentTarget.dataset.organ));
        });
    } else {
        alert("Erreur lors de la préparation de l'image. Veuillez retourner à l'accueil.");
    }
  } else {
    location.href = "index.html";
  }
}
