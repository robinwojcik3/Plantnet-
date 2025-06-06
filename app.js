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

const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => taxref[norm(k)] = v)),
  fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
  fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
  fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j)
]).then(() => console.log("Données prêtes.")).catch(err => alert("Erreur chargement des données: " + err.message));

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
   NOUVEAU : FONCTIONS POUR LA FICHE DE SYNTHÈSE (TEXTE ET AUDIO)
   ================================================================ */
async function getSynthesisFromGemini(speciesName) {
    const prompt = `En tant qu'expert botaniste, rédige une fiche de synthèse pour l'espèce "${speciesName}". Le texte doit être fluide et naturel, comme si tu t'adressais à des étudiants, pour une future conversion en audio. N'utilise ni tableau, ni formatage de code, ni listes à puces. Intègre les informations suivantes dans un discours cohérent et structuré : 1. Introduction : Présente l'espèce par son nom français le plus courant, son nom latin complet entre parenthèses, et sa famille. 2. Critères d'identification : Décris un ou deux critères morphologiques vraiment distinctifs pour l'identifier facilement sur le terrain et la différencier des espèces du même genre. 3. Confusions possibles : Mentionne une ou deux espèces proches et explique comment les distinguer. 4. Écologie : Décris son habitat préférentiel. 5. Statut : Indique son statut de conservation en France. 6. Répartition : Conclus sur ses régions de présence en France et son origine. Pour construire ta réponse, consulte les informations disponibles sur les sites de référence suivants : FloreAlpes, Tela Botanica, Info Flora, et l'INPN.`;
    const requestBody = { "contents": [{ "parts": [{ "text": prompt }] }], "generationConfig": { "temperature": 0.4, "maxOutputTokens": 800 } };
    try {
        const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON" }})); throw new Error(errorData.error.message || "Réponse non valide de l'API Gemini"); }
        const responseData = await response.json();
        if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) return responseData.candidates[0].content.parts[0].text.trim();
        return "Le modèle n'a pas pu générer de synthèse.";
    } catch (error) { return "Erreur lors de la génération du texte."; }
}

async function synthesizeSpeech(text) {
    const requestBody = {
        input: { text: text },
        voice: { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-D' }, // Voix masculine de haute qualité
        audioConfig: { audioEncoding: 'MP3' }
    };
    try {
        const response = await fetch(TTS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON" }})); throw new Error(errorData.error.message || "Réponse non valide de l'API TTS"); }
        const responseData = await response.json();
        return responseData.audioContent; // Renvoie la chaîne base64
    } catch (error) { console.error("Erreur Text-to-Speech:", error); alert("Erreur lors de la génération de l'audio : " + error.message); return null; }
}

window.handleSynthesisClick = async function(event, element, speciesName) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Génération...</i>';

    const modal = document.getElementById('synthesis-modal');
    const modalTitle = document.getElementById('synthesis-modal-title');
    const modalBody = document.getElementById('synthesis-modal-body');
    const playBtn = document.getElementById('synthesis-play-btn');
    const closeBtn = document.getElementById('synthesis-modal-close');

    modalTitle.textContent = `Fiche de synthèse : ${speciesName}`;
    modalBody.textContent = "Génération du texte en cours...";
    modal.style.display = 'flex';
    
    const synthesisText = await getSynthesisFromGemini(speciesName);
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
async function identifySingleImage(fileBlob, organ) { await ready; const fd = new FormData(); fd.append("images", fileBlob, fileBlob.name || "photo.jpg"); fd.append("organs", organ); const results = await callPlantNetAPI(fd); if (results) { document.body.classList.remove("home"); buildTable(results); buildCards(results); } }
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
  const colgroupHtml = `<colgroup><col style="width: 20%;"><col style="width: 8%;"><col style="width: 7%;"><col style="width: 7%;"><col style="width: 28%;"><col style="width: 7%;"><col style="width: 7%;"><col style="width: 8%;"><col style="width: 8%;"></colgroup>`;
  wrap.innerHTML = `<table>${colgroupHtml}<thead>${headerHtml}</thead><tbody>${rows}</tbody></table>`;
}
function buildCards(items){ const zone = document.getElementById("cards"); if (!zone) return; zone.innerHTML = ""; items.forEach(item => { const sci = item.species.scientificNameWithoutAuthor; const cd = cdRef(sci); if(!cd && !(item.score === 1.00 && items.length === 1)) return; const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info"; const isNameSearchResult = item.score === 1.00 && items.length === 1; const details = document.createElement("details"); let iframeHTML = ''; if (cd) { iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe><iframe loading="lazy" src="${openObs(cd)}" title="OpenObs"></iframe></div>`; } details.innerHTML = `<summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`; zone.appendChild(details); }); }

/* ================================================================
   LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
   ================================================================ */
function handleSingleFileSelect(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { sessionStorage.setItem("photoData", reader.result); ["speciesQueryName", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; }; reader.onerror = () => alert("Erreur lecture image."); reader.readAsDataURL(file); }
if (document.getElementById("file-capture")) { const fileCaptureInput = document.getElementById("file-capture"); const fileGalleryInput = document.getElementById("file-gallery"); const speciesSearchInput = document.getElementById("species-search-input"); const speciesSearchButton = document.getElementById("species-search-button"); const multiFileInput = document.getElementById("multi-file-input"); const multiImageListArea = document.getElementById("multi-image-list-area"); const multiImageIdentifyButton = document.getElementById("multi-image-identify-button"); let selectedMultiFilesData = []; fileCaptureInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0])); fileGalleryInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0])); const performSpeciesSearch = async () => { const query = speciesSearchInput.value.trim(); if (!query) return; await ready; const normQuery = norm(query); let taxrefData = await fetch("taxref.json").then(r => r.json()); let foundName = Object.keys(taxrefData).find(k => norm(k) === normQuery); if (foundName) { sessionStorage.setItem("speciesQueryName", foundName); ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } else { alert(`Espèce "${query}" non trouvée.`); } }; speciesSearchButton?.addEventListener("click", performSpeciesSearch); speciesSearchInput?.addEventListener("keypress", e => { if (e.key === "Enter") performSpeciesSearch(); }); function renderMultiImageList() { multiImageListArea.innerHTML = ''; multiImageIdentifyButton.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none'; if (selectedMultiFilesData.length === 0) multiFileInput.value = ''; selectedMultiFilesData.forEach((item, index) => { const itemDiv = document.createElement('div'); itemDiv.className = 'image-organ-item'; itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">Feuille</option><option value="flower">Fleur</option><option value="fruit">Fruit</option><option value="bark">Écorce</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`; itemDiv.querySelector('select').value = item.organ; multiImageListArea.appendChild(itemDiv); }); } multiImageListArea?.addEventListener('click', (e) => { if (e.target?.classList.contains('delete-file-btn')) { selectedMultiFilesData.splice(parseInt(e.target.dataset.index, 10), 1); renderMultiImageList(); } }); multiImageListArea?.addEventListener('change', (e) => { if (e.target?.tagName === 'SELECT') { selectedMultiFilesData[parseInt(e.target.dataset.index, 10)].organ = e.target.value; } }); multiFileInput?.addEventListener("change", (e) => { const files = Array.from(e.target.files), r = MAX_MULTI_IMAGES - selectedMultiFilesData.length; if (r <= 0) return alert(`Limite de ${MAX_MULTI_IMAGES} atteinte.`); files.slice(0, r).forEach(f => { if (!selectedMultiFilesData.some(i => i.file.name === f.name && i.file.size === f.size)) selectedMultiFilesData.push({ file: f, organ: 'leaf' }); }); if (files.length > r) alert(`Limite atteinte.`); renderMultiImageList(); e.target.value = ''; }); multiImageIdentifyButton?.addEventListener("click", () => { if (selectedMultiFilesData.length === 0) return alert("Veuillez sélectionner au moins une image."); identifyMultipleImages(selectedMultiFilesData.map(i => i.file), selectedMultiFilesData.map(i => i.organ)); }); }
const organBoxOnPage = document.getElementById("organ-choice"); if (organBoxOnPage) { const displayResults = async (results, isNameSearch = false) => { const previewEl = document.getElementById("preview"); if (previewEl) previewEl.style.display = 'none'; if (organBoxOnPage) organBoxOnPage.style.display = 'none'; await ready; document.body.classList.remove("home"); buildTable(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results); buildCards(isNameSearch ? [{ score: 1.0, species: { scientificNameWithoutAuthor: results } }] : results); }; const speciesQueryName = sessionStorage.getItem("speciesQueryName"); const storedImage = sessionStorage.getItem("photoData"); const multiImageResults = sessionStorage.getItem("identificationResults"); if (speciesQueryName) { sessionStorage.removeItem("speciesQueryName"); displayResults(speciesQueryName, true); } else if (multiImageResults) { try { displayResults(JSON.parse(multiImageResults)); } catch (e) { location.href = "index.html"; } } else if (storedImage) { const previewElement = document.getElementById("preview"); if(previewElement) previewElement.src = storedImage; if (organBoxOnPage) organBoxOnPage.style.display = 'block'; const toBlob = dataURL => { try { const [m,b] = dataURL.split(','), [,e] = /:(.*?);/.exec(m), B=atob(b), a=new Uint8Array(B.length); for(let i=0;i<B.length;i++)a[i]=B.charCodeAt(i); return new Blob([a],{type:e})}catch(e){return null}}; const imageBlob = toBlob(storedImage); if (imageBlob) { organBoxOnPage.querySelectorAll("button").forEach(b => b.addEventListener("click", (e) => identifySingleImage(imageBlob, e.currentTarget.dataset.organ))); } else { alert("Erreur lors de la préparation de l'image."); } } else { location.href = "index.html"; } }
