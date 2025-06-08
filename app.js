/* ================================================================
   CONFIGURATION GÉNÉRALE
   ================================================================ */
const API_KEY  = "2b10vfT6MvFC2lcAzqG1ZMKO";
const PROJECT  = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;
// NOUVEAU : Ajout des clés et points d'accès pour les API Google
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
let criteres = {}; // NOUVEAU : pour les critères physiologiques
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v)),
  fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
  fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
  fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j),
  // NOUVEAU : Chargement des critères physiologiques
  fetch("Criteres_herbier.json").then(r => r.json()).then(j => j.forEach(item => criteres[norm(item.species)] = item.description))
]).then(() => console.log("Données prêtes."))
  .catch(err => showNotification("Erreur chargement des données: " + err.message, 'error'));


/* ================================================================
   FONCTIONS UTILITAIRES ET HELPERS
   ================================================================ */
function norm(txt) { if (typeof txt !== 'string') return ""; return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " "); }
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const criteresOf = n => criteres[norm(n)] || "—"; // NOUVEAU : fonction pour récupérer les critères
const slug = n => norm(n).replace(/ /g, "-");
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=120.6&lat=45.188529&lon=5.724524#tab_mapView`;
const pfaf       = n => `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(n).replace(/%20/g, '+')}`;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
// Génère un nom de fichier basé sur la date et l'heure courantes
function makeTimestampedName() {
  const d = new Date();
  const pad = n => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
         `${pad(d.getHours())}h${pad(d.getMinutes())}.jpg`;
}
// Enregistre une photo sur l'appareil en déclenchant un téléchargement
function savePhotoLocally(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = name || makeTimestampedName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Erreur sauvegarde photo:", e);
  }
}



/* ================================================================
   NOUVEAU : FONCTIONS POUR LA FICHE DE SYNTHÈSE (TEXTE ET AUDIO)
   ================================================================ */

async function getSynthesisFromGemini(speciesName) {
    const prompt = `En tant qu'expert botaniste, rédige une fiche de synthèse narrative et fluide pour l'espèce "${speciesName}". Le style doit être oral, comme si tu t'adressais à des étudiants, pour une future conversion en audio. N'utilise ni tableau, ni formatage de code, ni listes à puces. Structure ta réponse en couvrant les points suivants de manière conversationnelle, sans utiliser de titres : commence par une introduction (nom commun, nom latin, famille), puis décris un ou deux critères d'identification clés pour la distinguer d'espèces proches. Mentionne ces espèces sources de confusion et comment les différencier. Ensuite, décris son écologie et habitat préférentiel. Termine par son statut de conservation en France (si pertinent) et sa répartition générale. Dans ta réponse, ne met aucun caractères qui ne soit pas du text directement. Je ne veux pas que tu mette de '*' ou de ":" ou de "/", met juste du texte conventionelle comme on écrirait naturellement quoi. Utilise ton savoir encyclopédique pour générer cette fiche.`;
    const requestBody = { "contents": [{ "parts": [{ "text": prompt }] }], "generationConfig": { "temperature": 0.4, "maxOutputTokens": 800 } };
    try {
        const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON" }})); throw new Error(errorData.error.message || "Réponse non valide de l'API Gemini"); }
        const responseData = await response.json();
        if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) return responseData.candidates[0].content.parts[0].text.trim();
        if (responseData.promptFeedback?.blockReason) return `Réponse bloquée par le modèle (${responseData.promptFeedback.blockReason}).`;
        return "Le modèle n'a pas pu générer de synthèse.";
    } catch (error) { console.error("Erreur Gemini:", error); return "Erreur lors de la génération du texte."; }
}

async function synthesizeSpeech(text) {
    const requestBody = {
        input: { text: text },
        voice: { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-D' },
        audioConfig: { audioEncoding: 'MP3' }
    };
    try {
        const response = await fetch(TTS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON" }})); throw new Error(errorData.error.message || "Réponse non valide de l'API TTS"); }
        const responseData = await response.json();
        return responseData.audioContent; // Renvoie la chaîne base64
    } catch (error) { console.error("Erreur Text-to-Speech:", error); return null; }
}

function playAudioFromBase64(base64String) {
    const audioSrc = `data:audio/mp3;base64,${base64String}`;
    const audio = new Audio(audioSrc);
    audio.play();
}

window.handleSynthesisClick = async function(event, element, speciesName) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Texte en cours...</i>';
    element.style.pointerEvents = 'none'; // Empêche les clics multiples

    const synthesisText = await getSynthesisFromGemini(speciesName);
    if (synthesisText.startsWith('Erreur') || synthesisText.startsWith('Réponse')) {
        showModal(synthesisText);
        parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
        return;
    }
    
    parentCell.innerHTML = '<i>Audio en cours...</i>';
    const audioData = await synthesizeSpeech(synthesisText);

    if (audioData) {
        playAudioFromBase64(audioData);
    } else {
        showModal("La synthèse audio a échoué. Le texte généré était :\n\n" + synthesisText);
    }

    parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
};


/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function callPlantNetAPI(formData) { try { const res = await fetch(ENDPOINT, { method: "POST", body: formData }); if (!res.ok) { const errBody = await res.json().catch(() => res.text()); throw new Error(`Erreur API PlantNet (${res.status}): ${typeof errBody === 'object' ? errBody.message : errBody}`); } return (await res.json()).results.slice(0, MAX_RESULTS); } catch (err) { console.error(err); showNotification(err.message, 'error'); return null; } }
async function identifySingleImage(fileBlob, organ) { await ready; const fd = new FormData(); fd.append("images", fileBlob, fileBlob.name || "photo.jpg"); fd.append("organs", organ); const results = await callPlantNetAPI(fd); if (results) { document.body.classList.remove("home"); buildTable(results); buildCards(results); } }
async function identifyMultipleImages(files, organs) { await ready; const fd = new FormData(); files.forEach((f, i) => fd.append("images", f, f.name || `photo_${i}.jpg`)); organs.forEach(o => fd.append("organs", o)); if (!fd.has("images")) return showNotification("Aucune image valide.", 'error'); const results = await callPlantNetAPI(fd); if (results) { sessionStorage.setItem("identificationResults", JSON.stringify(results)); ["photoData", "speciesQueryName"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } }

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;

  // MODIFIÉ : Ajout de la colonne "Critères physiologiques" avant l'écologie
  const headers = ['Nom latin (score %)', "FloreAlpes", "INPN statut", "Critères physiologiques", "Écologie", "Flora Gallica", "OpenObs", "Biodiv'AURA", "Info Flora", "Fiche synthèse", "PFAF", "Carnet"];
  const linkIcon = (url, img, alt) => {
    if (!url) return "—";
    const encoded = img.split('/').map(s => encodeURIComponent(s)).join('/');
    return `<a href="${url}" target="_blank" rel="noopener"><img src="assets/${encoded}" alt="${alt}" class="logo-icon"></a>`;
  };

  const rows = items.map(item => {
    const pct = item.score !== undefined ? `${Math.round(item.score * 100)}%` : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const cd   = cdRef(sci); 
    const eco  = ecolOf(sci);
    const crit = criteresOf(sci); // NOUVEAU : récupération des critères physiologiques
    const genus = sci.split(' ')[0].toLowerCase();
    const tocEntry = floraToc[genus];
    let floraGallicaLink = "—";
    if (tocEntry?.pdfFile && tocEntry?.page) {
      const pdfPath = `assets/flora_gallica_pdfs/${tocEntry.pdfFile}`;
      // Utiliser le viewer personnalisé sur toutes les plateformes
      const viewerUrl = `viewer.html?file=${encodeURIComponent(pdfPath)}&page=${tocEntry.page}`;
      floraGallicaLink = linkIcon(viewerUrl, "Flora Gallica.png", "Flora Gallica");
    }
    const normalizedSci = norm(sci);
    let floreAlpesLink = "—";
    const foundKey = Object.keys(floreAlpesIndex).find(key => norm(key.split('(')[0]) === normalizedSci);
    if (foundKey) {
        const urlPart = floreAlpesIndex[foundKey].split('?')[0];
        floreAlpesLink = linkIcon(`https://www.florealpes.com/${urlPart}`, "FloreAlpes.png", "FloreAlpes");
    }
    const escapedSci = sci.replace(/'/g, "\\'");
    // MODIFIÉ : Réorganisation des colonnes - critères physiologiques avant écologie
    return `<tr><td class="col-nom-latin">${sci}<br><span class="score">(${pct})</span></td><td class="col-link">${floreAlpesLink}</td><td class="col-link">${linkIcon(cd && inpnStatut(cd), "INPN.png", "INPN")}</td><td class="col-criteres">${crit}</td><td class="col-ecologie">${eco}</td><td class="col-link">${floraGallicaLink}</td><td class="col-link">${linkIcon(cd && openObs(cd), "OpenObs.png", "OpenObs")}</td><td class="col-link">${linkIcon(cd && aura(cd), "Biodiv'AURA.png", "Biodiv'AURA")}</td><td class="col-link">${linkIcon(infoFlora(sci), "Info Flora.png", "Info Flora")}</td><td class="col-link"><a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')"><img src="assets/Audio.png" alt="Audio" class="logo-icon"></a></td><td class="col-link">${linkIcon(pfaf(sci), "PFAF.png", "PFAF")}</td><td class="col-link"><button onclick="saveObservationPrompt('${escapedSci}')">⭐</button></td></tr>`;
  }).join("");

  // MODIFIÉ : En-tête avec critères physiologiques avant écologie
  const headerHtml = `<tr><th class="col-nom-latin">Nom latin (score %)</th><th class="col-link">FloreAlpes</th><th class="col-link">INPN statut</th><th class="col-criteres">Critères physiologiques</th><th class="col-ecologie">Écologie</th><th class="col-link">Flora Gallica</th><th class="col-link">OpenObs</th><th class="col-link">Biodiv'AURA</th><th class="col-link">Info Flora</th><th class="col-link">Fiche synthèse</th><th class="col-link">PFAF</th><th class="col-link">Carnet</th></tr>`;
  // MODIFIÉ : Ajustement des largeurs avec critères physiologiques avant écologie
  const colgroupHtml = `<colgroup><col style="width: 20%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 25%;"><col style="width: 25%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 6%;"><col style="width: 6%;"></colgroup>`;
  wrap.innerHTML = `<table>${colgroupHtml}<thead>${headerHtml}</thead><tbody>${rows}</tbody></table>`;
}

function buildCards(items){ const zone = document.getElementById("cards"); if (!zone) return; zone.innerHTML = ""; items.forEach(item => { const sci = item.species.scientificNameWithoutAuthor; const cd = cdRef(sci); if(!cd && !(item.score === 1.00 && items.length === 1)) return; const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info"; const isNameSearchResult = item.score === 1.00 && items.length === 1; const details = document.createElement("details"); let iframeHTML = ''; if (cd) { iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe><iframe loading="lazy" src="${openObs(cd)}" title="OpenObs"></iframe></div>`; } details.innerHTML = `<summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`; zone.appendChild(details); }); }

/* ================================================================
   LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
   ================================================================ */
function handleSingleFileSelect(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { sessionStorage.setItem("photoData", reader.result); ["speciesQueryName", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; }; reader.onerror = () => showNotification("Erreur lecture image.", 'error'); reader.readAsDataURL(file); }
if (document.getElementById("file-capture")) { const fileCaptureInput = document.getElementById("file-capture"); const fileGalleryInput = document.getElementById("file-gallery"); const speciesSearchInput = document.getElementById("species-search-input"); const speciesSearchButton = document.getElementById("species-search-button"); const multiFileInput = document.getElementById("multi-file-input"); const multiImageListArea = document.getElementById("multi-image-list-area"); const multiImageIdentifyButton = document.getElementById("multi-image-identify-button"); let selectedMultiFilesData = []; fileCaptureInput?.addEventListener("change", e => { const f = e.target.files[0]; if (f) savePhotoLocally(f); handleSingleFileSelect(f); }); fileGalleryInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0])); const performSpeciesSearch = async () => { const query = speciesSearchInput.value.trim(); if (!query) return; await ready; const normQuery = norm(query); let taxrefData = await fetch("taxref.json").then(r => r.json()); let foundName = Object.keys(taxrefData).find(k => norm(k) === normQuery); if (foundName) { sessionStorage.setItem("speciesQueryName", foundName); ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } else { showNotification(`Espèce "${query}" non trouvée.`, "error"); } }; speciesSearchButton?.addEventListener("click", performSpeciesSearch); speciesSearchInput?.addEventListener("keypress", e => { if (e.key === "Enter") performSpeciesSearch(); }); function renderMultiImageList() { multiImageListArea.innerHTML = ''; multiImageIdentifyButton.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none'; if (selectedMultiFilesData.length === 0) multiFileInput.value = ''; selectedMultiFilesData.forEach((item, index) => { const itemDiv = document.createElement('div'); itemDiv.className = 'image-organ-item'; itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">Feuille</option><option value="flower">Fleur</option><option value="fruit">Fruit</option><option value="bark">Écorce</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`; itemDiv.querySelector('select').value = item.organ; multiImageListArea.appendChild(itemDiv); }); } multiImageListArea?.addEventListener('click', (e) => { if (e.target?.classList.contains('delete-file-btn')) { selectedMultiFilesData.splice(parseInt(e.target.dataset.index, 10), 1); renderMultiImageList(); } }); multiImageListArea?.addEventListener('change', (e) => { if (e.target?.tagName === 'SELECT') { selectedMultiFilesData[parseInt(e.target.dataset.index, 10)].organ = e.target.value; } }); multiFileInput?.addEventListener("change", (e) => { const files = Array.from(e.target.files), r = MAX_MULTI_IMAGES - selectedMultiFilesData.length; if (r <= 0) return showNotification(`Limite de ${MAX_MULTI_IMAGES} atteinte.`, "error"); files.slice(0, r).forEach(f => { if (!selectedMultiFilesData.some(i => i.file.name === f.name && i.file.size === f.size)) selectedMultiFilesData.push({ file: f, organ: 'leaf' }); }); if (files.length > r) showNotification(`Limite atteinte.`, "error"); renderMultiImageList(); e.target.value = ''; }); multiImageIdentifyButton?.addEventListener("click", () => { if (selectedMultiFilesData.length === 0) return showNotification("Veuillez sélectionner au moins une image.", "error"); identifyMultipleImages(selectedMultiFilesData.map(i => i.file), selectedMultiFilesData.map(i => i.organ)); }); }
const organBoxOnPage = document.getElementById("organ-choice"); if (organBoxOnPage) { const displayResults = async (results, isNameSearch = false) => { const previewEl = document.getElementById("preview"); if (previewEl) previewEl.style.display = 'none'; if (organBoxOnPage) organBoxOnPage.style.display = 'none'; await ready; document.body.classList.remove("home"); buildTable(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results); buildCards(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results); }; const speciesQueryName = sessionStorage.getItem("speciesQueryName"); const storedImage = sessionStorage.getItem("photoData"); const multiImageResults = sessionStorage.getItem("identificationResults"); if (speciesQueryName) { sessionStorage.removeItem("speciesQueryName"); displayResults(speciesQueryName, true); } else if (multiImageResults) { try { displayResults(JSON.parse(multiImageResults)); } catch (e) { location.href = "index.html"; } } else if (storedImage) { const previewElement = document.getElementById("preview"); if(previewElement) previewElement.src = storedImage; if (organBoxOnPage) organBoxOnPage.style.display = 'block'; const toBlob = dataURL => { try { const [m,b] = dataURL.split(','), [,e] = /:(.*?);/.exec(m), B=atob(b), a=new Uint8Array(B.length); for(let i=0;i<B.length;i++)a[i]=B.charCodeAt(i); return new Blob([a],{type:e})}catch(e){return null}}; const imageBlob = toBlob(storedImage); if (imageBlob) { organBoxOnPage.querySelectorAll("button").forEach(b => b.addEventListener("click", (e) => identifySingleImage(imageBlob, e.currentTarget.dataset.organ))); } else { showNotification("Erreur lors de la préparation de l'image.", 'error'); } } else { location.href = "index.html"; } }

const genusSearchInput = document.getElementById("genus-search-input");
const genusSearchButton = document.getElementById("genus-search-button");
const performGenusSearch = async () => {
  const query = genusSearchInput.value.trim();
  if (!query) return;
  await ready;
  const normQuery = norm(query);
  const tocEntry = floraToc[normQuery];
  if (tocEntry?.pdfFile && tocEntry?.page) {
    sessionStorage.setItem("speciesQueryName", query);
    ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
    location.href = "organ.html";
  } else {
    showNotification(`Genre "${query}" non trouvé.`, "error");
  }
};
genusSearchButton?.addEventListener("click", performGenusSearch);
genusSearchInput?.addEventListener("keypress", e => { if (e.key === "Enter") performGenusSearch(); });
