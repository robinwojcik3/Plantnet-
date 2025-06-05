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
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

function getLiveUserLocation() {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            reject(new Error("La géolocalisation n'est pas supportée par votre navigateur."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            (error) => reject(error)
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
   FONCTIONS IA & FLORA GALLICA
   ================================================================ */
async function classifyWithGemini(speciesName) {
    const prompt = `Détermine auquel des 4 groupes suivants l'espèce floristique '${speciesName}' appartient : Angiospermes Dicotylédon, Angiospermes Monocotylédon, Gymnospermes, ou Ptéridophytes. Ta réponse doit uniquement être le nom du groupe. Si tu ne sais pas ou que ce n'est pas une plante, réponds "Inconnu".`;

    const requestBody = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": { "temperature": 0.2, "maxOutputTokens": 50 }
    };

    try {
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON de l'API" }}));
            throw new Error(errorData.error.message || "Réponse non valide de l'API Gemini");
        }
        const responseData = await response.json();
        if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return responseData.candidates[0].content.parts[0].text.trim();
        } else {
            if (responseData.promptFeedback?.blockReason) return `Bloqué (${responseData.promptFeedback.blockReason})`;
            return "Réponse vide";
        }
    } catch (error) {
        console.error("Erreur lors de l'appel à Gemini:", error);
        return "Erreur"; 
    }
}

window.handleGeminiClick = async function(event, element, speciesName, cd_ref) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Classification...</i>';

    const classificationResult = await classifyWithGemini(speciesName);
    parentCell.textContent = classificationResult;

    // Une fois la classification obtenue, active le lien Flora Gallica
    const floraCell = document.querySelector(`.flora-gallica-cell-${cd_ref}`);
    if (floraCell && !["Erreur", "Inconnu"].some(err => classificationResult.startsWith(err))) {
        const genus = speciesName.split(' ')[0];
        const escapedGenus = genus.replace(/'/g, "\\'");
        const escapedClassification = classificationResult.replace(/'/g, "\\'");
        floraCell.innerHTML = `<a href="#" onclick="handleFloraGallicaClick(event, '${escapedClassification}', '${escapedGenus}')">Extraire</a>`;
    } else if (floraCell) {
        floraCell.textContent = 'N/A';
    }
}

window.handleFloraGallicaClick = function(event, classificationGroup, genus) {
    event.preventDefault();
    const targetCell = event.currentTarget.parentElement;
    targetCell.innerHTML = '<i>Création...</i>';
    
    // Construire l'URL de la fonction serverless
    const functionUrl = `/.netlify/functions/get_flora_gallica_genus?group=${encodeURIComponent(classificationGroup)}&genus=${encodeURIComponent(genus)}`;

    // Ouvrir l'URL dans un nouvel onglet, le navigateur gérera le téléchargement du PDF
    window.open(functionUrl, '_blank');
    
    // Réinitialiser le lien après un court instant
    setTimeout(() => {
        const escapedGenus = genus.replace(/'/g, "\\'");
        const escapedClassification = classificationGroup.replace(/'/g, "\\'");
        targetCell.innerHTML = `<a href="#" onclick="handleFloraGallicaClick(event, '${escapedClassification}', '${escapedGenus}')">Extraire</a>`;
    }, 2000);
}


/* ================================================================
   INITIALISATION IndexedDB (code inchangé)
   ================================================================ */
let db = null;
let dbInitPromise = null;
function initPhotoDB() {
    if (dbInitPromise) return dbInitPromise;
    dbInitPromise = new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const request = indexedDB.open("plantPhotosDB", 1);
        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains("photosStore")) {
                dbInstance.createObjectStore("photosStore", { autoIncrement: true }).createIndex("timestamp_idx", "timestamp");
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onerror = (e) => { dbInitPromise = null; reject(e.target.error); };
        request.onblocked = () => { alert("Veuillez fermer les autres onglets utilisant l'application pour mettre à jour la base de données."); reject(new Error("IndexedDB open blocked")); };
    });
    return dbInitPromise;
}
initPhotoDB().catch(err => console.error("Échec de l'initialisation de la base de données locale:", err));
async function savePhotoToDB(imageFile) { if (!imageFile || !(imageFile instanceof Blob)) return; try { await initPhotoDB(); if (!db) return; const tx = db.transaction(["photosStore"], "readwrite"); const store = tx.objectStore("photosStore"); const entry = { imageFile, name: imageFile.name || `photo_${Date.now()}`, timestamp: new Date().toISOString() }; store.add(entry).onsuccess = e => console.log("Photo sauvegardée dans IndexedDB, clé:", e.target.result); } catch (err) { console.error("Erreur dans savePhotoToDB:", err); } }
function downloadPhotoForDeviceGallery(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || `plantouille_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }


/* ================================================================
   FONCTIONS DE BASE (code inchangé)
   ================================================================ */
function norm(txt){ if (typeof txt !== 'string') return ""; return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g," "); }
const ready = Promise.all([ fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v)), fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)) ]).catch(err => alert("Erreur chargement des fichiers de données: " + err.message));
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—"; 
const slug = n => norm(n).replace(/ /g,"-");
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const proxyStatut = c => `/.netlify/functions/inpn-proxy?cd=${c}&type=statut`;


/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function callPlantNetAPI(formData) { try { const res = await fetch(ENDPOINT, { method: "POST", body: formData }); if (!res.ok) { const errBody = await res.json().catch(() => res.text()); throw new Error(`Erreur API PlantNet (${res.status}): ${typeof errBody === 'object' ? errBody.message : errBody}`); } return (await res.json()).results.slice(0, MAX_RESULTS); } catch (err) { console.error(err); alert(err.message); return null; } }
async function identifySingleImage(fileBlob, organ) { const fd = new FormData(); fd.append("images", fileBlob, fileBlob.name || "photo.jpg"); fd.append("organs", organ); const results = await callPlantNetAPI(fd); if (results) { document.body.classList.remove("home"); buildTable(results); buildCards(results); } }
async function identifyMultipleImages(files, organs) { const fd = new FormData(); files.forEach((f, i) => fd.append("images", f, f.name || `photo_${i}.jpg`)); organs.forEach(o => fd.append("organs", o)); if (!fd.has("images")) return alert("Aucune image valide."); const results = await callPlantNetAPI(fd); if (results) { sessionStorage.setItem("identificationResults", JSON.stringify(results)); location.href = "organ.html"; } }

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;

  const headers = ["Nom latin","Score (%)","InfoFlora","Écologie","INPN statut","Biodiv'AURA","OpenObs", "Gemini", "Flora Gallica"];
  const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";

  const rows = items.map(item => {
    const score = item.score !== undefined ? Math.round(item.score * 100) : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const escapedSci = sci.replace(/'/g, "\\'");
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
      <td class="gemini-cell-${cd || escapedSci}">${link("#", "Classifier", `handleGeminiClick(event, this, '${escapedSci}', '${cd || escapedSci}')`)}</td>
      <td class="flora-gallica-cell-${cd || escapedSci}">—</td>
    </tr>`.replace('href="#" onclick="', 'href="#" onclick="'); // Nettoyage
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
    if(!cd && !(item.score === 1.00 && items.length === 1)) return;
    
    const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info";
    const isNameSearchResult = item.score === 1.00 && items.length === 1;

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
  savePhotoToDB(file).catch(err => console.error(`La sauvegarde locale (IndexedDB) a échoué:`, err));
  if (sourceType === 'capture') downloadPhotoForDeviceGallery(file);
  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result); 
    ["speciesQueryName", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
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
    if (e.target?.classList.contains('delete-file-btn')) {
        selectedMultiFilesData.splice(parseInt(e.target.dataset.index, 10), 1);
        renderMultiImageList();
    }
  });

  multiImageListArea?.addEventListener('change', (e) => {
    if (e.target?.tagName === 'SELECT') {
        selectedMultiFilesData[parseInt(e.target.dataset.index, 10)].organ = e.target.value;
    }
  });

  multiFileInput?.addEventListener("change", (event) => {
      const files = Array.from(event.target.files);
      const remainingSlots = MAX_MULTI_IMAGES - selectedMultiFilesData.length;
      if (remainingSlots <= 0) return alert(`Limite de ${MAX_MULTI_IMAGES} images atteinte.`);
      
      files.slice(0, remainingSlots).forEach(file => {
        if (!selectedMultiFilesData.some(item => item.file.name === file.name && item.file.size === file.size)) {
            selectedMultiFilesData.push({ file, organ: 'leaf' });
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
