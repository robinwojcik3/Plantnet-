/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;
const GEMINI_API_KEY = "AIzaSyDDv4amCchpTXGqz6FGuY8mxPClkw-uwMs";
const TTS_API_KEY = "AIzaSyCsmQ_n_JtrA1Ev2GkOZeldYsAmHpJvhZY";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const TTS_ENDPOINT = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;

/* ================================================================
   INITIALISATION ET GESTION DES DONNÉES
   ================================================================ */
let taxref = {};
let ecology = {};
let floraToc = {};
let floreAlpesIndex = {};
let userLocation = { latitude: 45.188529, longitude: 5.724524 };
let db = null;
let dbInitPromise = null;

const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v)),
  fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
  fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
  fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j)
]).then(() => console.log("Données prêtes.")).catch(err => alert("Erreur chargement des données: " + err.message));

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


/* ================================================================
   FONCTIONS UTILITAIRES ET HELPERS
   ================================================================ */
function norm(txt) { if (typeof txt !== 'string') return ""; return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " "); }
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const slug = n => norm(n).replace(/ /g, "-");
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=120.6&lat=45.188529&lon=5.724524#tab_mapView`;

/* ================================================================
   GESTION DES ACTIONS UTILISATEUR
   ================================================================ */
async function savePhotoToDB(imageFile) {
    if (!imageFile || !(imageFile instanceof Blob)) return;
    try {
        await initPhotoDB();
        if (!db) return;
        const tx = db.transaction(["photosStore"], "readwrite");
        const store = tx.objectStore("photosStore");
        const entry = { imageFile, name: imageFile.name || `photo_${Date.now()}`, timestamp: new Date().toISOString() };
        store.add(entry).onsuccess = e => console.log("Photo sauvegardée dans IndexedDB, clé:", e.target.result);
    } catch (err) { console.error("Erreur dans savePhotoToDB:", err); }
}

function downloadPhotoForDeviceGallery(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `plantouille_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.handleSynthesisClick = async function(event, element, speciesName) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Génération...</i>';
    
    const synthesisText = await getSynthesisFromGemini(speciesName);
    
    const modal = document.getElementById('synthesis-modal');
    const modalTitle = document.getElementById('synthesis-modal-title');
    const modalBody = document.getElementById('synthesis-modal-body');
    const playBtn = document.getElementById('synthesis-play-btn');
    const closeBtn = document.getElementById('synthesis-modal-close');

    modalTitle.textContent = `Fiche de synthèse : ${speciesName}`;
    modalBody.textContent = "Génération du texte en cours...";
    modal.style.display = 'flex';
    
    modalBody.textContent = synthesisText;

    const escapedSci = speciesName.replace(/'/g, "\\'");
    parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')">Générer</a>`;
    
    playBtn.disabled = false;
    playBtn.textContent = 'Écouter la synthèse';

    const playHandler = async () => {
        playBtn.textContent = 'Chargement audio...';
        playBtn.disabled = true;
        const audioData = await synthesizeSpeech(synthesisText);
        playBtn.textContent = 'Écouter la synthèse';
        playBtn.disabled = false;
        if (audioData) {
            const audioSrc = `data:audio/mp3;base64,${audioData}`;
            const audio = new Audio(audioSrc);
            audio.play();
        }
    };

    playBtn.onclick = playHandler;
    const closeModal = () => { modal.style.display = 'none'; playBtn.onclick = null; };
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if(e.target === modal) closeModal(); };
}

/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function callPlantNetAPI(formData) { try { const res = await fetch(ENDPOINT, { method: "POST", body: formData }); if (!res.ok) { const errBody = await res.json().catch(() => res.text()); throw new Error(`Erreur API PlantNet (${res.status}): ${typeof errBody === 'object' ? errBody.message : errBody}`); } return (await res.json()).results.slice(0, MAX_RESULTS); } catch (err) { console.error(err); alert(err.message); return null; } }
async function identifySingleImage(fileBlob, organ) { await ready; const fd = new FormData(); fd.append("images", fileBlob, fileBlob.name || "photo.jpg"); fd.append("organs", organ); const results = await callPlantNetAPI(fd); if (results) { document.body.classList.remove("home"); buildTable(results); buildCards(results); } }
async function identifyMultipleImages(files, organs) { await ready; const fd = new FormData(); files.forEach((f, i) => fd.append("images", f, f.name || `photo_${i}.jpg`)); organs.forEach(o => fd.append("organs", o)); if (!fd.has("images")) return alert("Aucune image valide."); const results = await callPlantNetAPI(fd); if (results) { sessionStorage.setItem("identificationResults", JSON.stringify(results)); ["photoData", "speciesQueryName"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } }

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;
  const headers = ["Nom latin", "Score (%)", "FloreAlpes", "INPN statut", "Écologie", "Flora Gallica", "OpenObs", "Biodiv'AURA", "Info Flora", "Fiche synthèse"];
  const link = (url, label) => url ? `<a href="${url}" target="_blank" rel="noopener">${label}</a>` : "—";
  const rows = items.map(item => {
    const pct = item.score !== undefined ? `${Math.round(item.score * 100)}%` : "N/A";
    const sci = item.species.scientificNameWithoutAuthor;
    const cd = cdRef(sci);
    const eco = ecolOf(sci);
    const genus = sci.split(' ')[0].toLowerCase();
    const tocEntry = floraToc[genus];
    let floraGallicaLink = "—";
    if (tocEntry?.pdfFile && tocEntry?.page) {
      const pdfPath = `assets/flora_gallica_pdfs/${tocEntry.pdfFile}`;
      const viewerUrl = `viewer.html?file=${encodeURIComponent(pdfPath)}&page=${tocEntry.page}`;
      floraGallicaLink = `<a href="${viewerUrl}" target="_blank" rel="noopener" title="Ouvrir Flora Gallica pour ${genus}">Page ${tocEntry.page}</a>`;
    }
    const normalizedSci = norm(sci);
    let floreAlpesLink = "—";
    const foundKey = Object.keys(floreAlpesIndex).find(key => norm(key.split('(')[0]) === normalizedSci);
    if (foundKey) {
        const urlPart = floreAlpesIndex[foundKey].split('?')[0];
        floreAlpesLink = link(`https://www.florealpes.com/${urlPart}`, "fiche");
    }
    const escapedSci = sci.replace(/'/g, "\\'");
    return `<tr><td class="col-nom-latin">${sci}</td><td class="col-score">${pct}</td><td class="col-link">${floreAlpesLink}</td><td class="col-link">${link(cd && inpnStatut(cd),"statut")}</td><td class="col-ecologie">${eco}</td><td class="col-link">${floraGallicaLink}</td><td class="col-link">${link(cd && openObs(cd),"carte")}</td><td class="col-link">${link(cd && aura(cd),"atlas")}</td><td class="col-link">${link(infoFlora(sci),"fiche")}</td><td class="col-link"><a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')">Générer</a></td></tr>`;
  }).join("");
  const headerHtml = `<tr><th class="col-nom-latin">Nom latin</th><th class="col-score">Score (%)</th><th class="col-link">FloreAlpes</th><th class="col-link">INPN statut</th><th class="col-ecologie">Écologie</th><th class="col-link">Flora Gallica</th><th class="col-link">OpenObs</th><th class="col-link">Biodiv'AURA</th><th class="col-link">Info Flora</th><th class="col-link">Fiche synthèse</th></tr>`;
  const colgroupHtml = `<colgroup><col style="width: 18%;"><col style="width: 7%;"><col style="width: 7%;"><col style="width: 7%;"><col style="width: 32%;"><col style="width: 7%;"><col style="width: 7%;"><col style="width: 8%;"><col style="width: 8%;"></colgroup>`;
  wrap.innerHTML = `<table>${colgroupHtml}<thead>${headerHtml}</thead><tbody>${rows}</tbody></table>`;
}
function buildCards(items){ const zone = document.getElementById("cards"); if (!zone) return; zone.innerHTML = ""; items.forEach(item => { const sci = item.species.scientificNameWithoutAuthor; const cd = cdRef(sci); if(!cd && !(item.score === 1.00 && items.length === 1)) return; const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info"; const isNameSearchResult = item.score === 1.00 && items.length === 1; const details = document.createElement("details"); let iframeHTML = ''; if (cd) { iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe><iframe loading="lazy" src="${openObs(cd)}" title="OpenObs"></iframe></div>`; } details.innerHTML = `<summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`; zone.appendChild(details); }); }

/* ================================================================
   LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
   ================================================================ */
// MODIFICATION : la fonction `handleSingleFileSelect` est maintenant mise à jour pour inclure la logique de sauvegarde
function handleSingleFileSelect(file, sourceType) { 
  if (!file) return;

  // Logique de sauvegarde locale réintégrée
  savePhotoToDB(file).catch(err => console.error(`La sauvegarde locale (IndexedDB) a échoué:`, err));
  if (sourceType === 'capture') {
      downloadPhotoForDeviceGallery(file);
  }

  const reader = new FileReader();
  reader.onload = () => {
    sessionStorage.setItem("photoData", reader.result); 
    ["speciesQueryName", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
    location.href = "organ.html";
  };
  reader.onerror = () => alert("Erreur lors de la lecture de l'image.");
  reader.readAsDataURL(file); 
}

if (document.getElementById("file-capture")) {
    const fileCaptureInput = document.getElementById("file-capture");
    const fileGalleryInput = document.getElementById("file-gallery");
    const speciesSearchInput = document.getElementById("species-search-input");
    const speciesSearchButton = document.getElementById("species-search-button");
    const multiFileInput = document.getElementById("multi-file-input");
    const multiImageListArea = document.getElementById("multi-image-list-area");
    const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");
    let selectedMultiFilesData = [];

    // MODIFICATION : Le paramètre 'sourceType' est maintenant passé
    fileCaptureInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0], 'capture'));
    fileGalleryInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0], 'gallery'));

    const performSpeciesSearch = async () => {
        const query = speciesSearchInput.value.trim();
        if (!query) return alert("Veuillez entrer un nom d'espèce.");
        try {
            await ready;
            const normQuery = norm(query);
            let taxrefData = await fetch("taxref.json").then(r => r.json());
            let foundName = Object.keys(taxrefData).find(k => norm(k) === normQuery);
            if (foundName) { 
                sessionStorage.setItem("speciesQueryName", foundName);
                ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
                location.href = "organ.html";
            } else {
                alert(`Espèce "${query}" non trouvée.`);
            }
        } catch (err) { alert("Erreur lors de la recherche."); }
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
            itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">Feuille</option><option value="flower">Fleur</option><option value="fruit">Fruit</option><option value="bark">Écorce</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`;
            itemDiv.querySelector('select').value = item.organ;
            multiImageListArea.appendChild(itemDiv);
        });
    }

    multiImageListArea?.addEventListener('click', (e) => { if (e.target?.classList.contains('delete-file-btn')) { selectedMultiFilesData.splice(parseInt(e.target.dataset.index, 10), 1); renderMultiImageList(); } });
    multiImageListArea?.addEventListener('change', (e) => { if (e.target?.tagName === 'SELECT') { selectedMultiFilesData[parseInt(e.target.dataset.index, 10)].organ = e.target.value; } });
    multiFileInput?.addEventListener("change", (e) => { const files = Array.from(e.target.files), r = MAX_MULTI_IMAGES - selectedMultiFilesData.length; if (r <= 0) return alert(`Limite de ${MAX_MULTI_IMAGES} atteinte.`); files.slice(0, r).forEach(f => { if (!selectedMultiFilesData.some(i => i.file.name === f.name && i.file.size === f.size)) selectedMultiFilesData.push({ file: f, organ: 'leaf' }); }); if (files.length > r) alert(`Limite atteinte.`); renderMultiImageList(); e.target.value = ''; });
    multiImageIdentifyButton?.addEventListener("click", () => { if (selectedMultiFilesData.length === 0) return alert("Veuillez sélectionner au moins une image."); identifyMultipleImages(selectedMultiFilesData.map(i => i.file), selectedMultiFilesData.map(i => i.organ)); });
}

const organBoxOnPage = document.getElementById("organ-choice"); 
if (organBoxOnPage) {
    const displayResults = async (results, isNameSearch = false) => {
        const previewEl = document.getElementById("preview");
        if (previewEl) previewEl.style.display = 'none';
        if (organBoxOnPage) organBoxOnPage.style.display = 'none';
        
        await ready;
        
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

        const toBlob = dataURL => { try { const [m,b] = dataURL.split(','), [,e] = /:(.*?);/.exec(m), B=atob(b), a=new Uint8Array(B.length); for(let i=0;i<B.length;i++)a[i]=B.charCodeAt(i); return new Blob([a],{type:e})}catch(e){return null}};
        const imageBlob = toBlob(storedImage); 
        if (imageBlob) {
            organBoxOnPage.querySelectorAll("button").forEach(b => b.addEventListener("click", (e) => identifySingleImage(imageBlob, e.currentTarget.dataset.organ)));
        } else {
            alert("Erreur lors de la préparation de l'image.");
        }
    } else {
        location.href = "index.html";
    }
}
