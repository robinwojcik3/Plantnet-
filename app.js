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
let taxrefNames = [];
let ecology = {};
let floraToc = {};
let floreAlpesIndex = {}; 
let criteres = {}; // NOUVEAU : pour les critères physiologiques
let physionomie = {}; // Nouvelle table pour la physionomie
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

const ready = Promise.all([
  fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => { taxrefNames.push(k); taxref[norm(k)] = v; })),
  fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
  fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
  fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j),
  // NOUVEAU : Chargement des critères physiologiques
  fetch("Criteres_herbier.json").then(r => r.json()).then(j => j.forEach(item => criteres[norm(item.species)] = item.description)),
  // Nouvelle donnée : physionomie des espèces
  fetch("Physionomie.json").then(r => r.json()).then(j => j.forEach(item => physionomie[norm(item.nom_latin)] = item.physionomie))
]).then(() => { taxrefNames.sort(); console.log("Données prêtes."); })
  .catch(err => showNotification("Erreur chargement des données: " + err.message, 'error'));


/* ================================================================
   FONCTIONS UTILITAIRES ET HELPERS
   ================================================================ */
function norm(txt) { if (typeof txt !== 'string') return ""; return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " "); }
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const criteresOf = n => criteres[norm(n)] || "—"; // NOUVEAU : fonction pour récupérer les critères
const physioOf = n => physionomie[norm(n)] || "—"; // Récupération de la physionomie
const slug = n => norm(n).replace(/ /g, "-");
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=120.6&lat=45.188529&lon=5.724524#tab_mapView`;
const pfaf       = n => `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(n).replace(/%20/g, '+')}`;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
// Génère un nom de fichier basé sur la date et l'heure courantes
function makeTimestampedName(prefix = "") {
  const d = new Date();
  const pad = n => n.toString().padStart(2, "0");
  const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
                    `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  const safePrefix = prefix ? prefix.replace(/[\\/:*?"<>|]/g, "_").trim() + " " : "";
  return `${safePrefix}${timestamp}.jpg`;
}
// Enregistre une photo sur l'appareil en déclenchant un téléchargement
function savePhotoLocally(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = makeTimestampedName(name);
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
   NOUVEAU : FONCTIONS POUR L'ANALYSE COMPARATIVE
   ================================================================ */

/**
 * Affiche les résultats de la comparaison dans une fenêtre modale.
 * @param {string} title - Le titre de la fenêtre modale.
 * @param {string} content - Le contenu textuel à afficher.
 */
function showComparisonModal(title, content) {
    const existingModal = document.getElementById('comparison-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'comparison-modal-overlay';
    modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 1rem;';

    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = 'background: var(--card, #ffffff); color: var(--text, #202124); padding: 2rem; border-radius: 8px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.3);';

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = title;
    modalTitle.style.marginTop = '0';
    modalTitle.style.color = 'var(--primary, #388e3c)';

    const modalText = document.createElement('div');
    modalText.innerHTML = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    modalText.style.lineHeight = '1.6';

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Fermer';
    closeButton.className = 'action-button';
    closeButton.style.display = 'block';
    closeButton.style.margin = '1.5rem auto 0';
    
    closeButton.onclick = () => modalOverlay.remove();
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };
    
    modalContainer.appendChild(modalTitle);
    modalContainer.appendChild(modalText);
    modalContainer.appendChild(closeButton);
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);
}

/**
 * Interroge l'API Gemini pour obtenir une analyse comparative des espèces fournies.
 * @param {Array<Object>} speciesData - Un tableau d'objets, chaque objet représentant une espèce sélectionnée.
 * @returns {Promise<string>} Le texte de l'analyse comparative généré par l'IA.
 */
async function getComparisonFromGemini(speciesData) {
    const speciesDataString = speciesData.map(s => `Espèce: ${s.species}\nDonnées morphologiques (Physionomie): ${s.physio || 'Non renseignée'}\nDonnées écologiques: ${s.eco || 'Non renseignée'}`).join('\n\n');

    const promptTemplate = `Pour chaque espèce fournie par l’utilisateur, tu dois identifier et décrire quelques critères morphologiques immédiatement visibles, simples à vérifier sur le terrain ou à partir d’un spécimen, et suffisamment fiables pour permettre de distinguer cette espèce uniquement des autres espèces de la même liste avec lesquelles une confusion est réellement probable. Ces critères doivent présenter un fort pouvoir discriminant, c’est-à-dire qu’ils doivent permettre une différenciation claire sans ambiguïté, en se fondant sur des éléments visuellement évidents et accessibles à l’observation directe. Tu ne dois en aucun cas fournir une description complète de l’espèce ni une clé de détermination exhaustive ; seuls les traits morphologiques essentiels à la discrimination doivent être retenus, formulés de manière concise et rigoureuse. Pour accéder à la page d’une espèce sur ces sites, effectue une recherche Google en combinant le nom scientifique de l’espèce et le nom du site concerné. La réponse devra commencer par une ou deux phrases synthétiques présentant les éléments les plus immédiatement remarquables qui permettent de distinguer l’espèce des autres mentionnées. Ensuite, développe un court paragraphe décrivant précisément les différences morphologiques discriminantes entre l’espèce ciblée et celles avec lesquelles elle est susceptible d’être confondue, en insistant sur les caractères visibles les plus efficaces pour la séparation. Aucun autre contenu ne doit être ajouté : pas de préambule, pas de conclusion, pas de phrase générique du type « voici comment distinguer… », et ne cite pas les sources dans la réponse. Voici les données des espèces sélectionnées à comparer :\n\n---\n\n${speciesDataString}`;

    const requestBody = { 
        "contents": [{ "parts": [{ "text": promptTemplate }] }], 
        "generationConfig": { "temperature": 0.3, "maxOutputTokens": 1500 } 
    };

    try {
        const response = await fetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "Réponse non JSON" } }));
            throw new Error(errorData.error.message || `Erreur API Gemini (${response.status})`);
        }
        const responseData = await response.json();
        if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return responseData.candidates[0].content.parts[0].text.trim();
        }
        if (responseData.promptFeedback?.blockReason) {
            return `Réponse bloquée par le modèle (${responseData.promptFeedback.blockReason}). Vérifiez le contenu du prompt.`;
        }
        return "Le modèle n'a pas pu générer de comparaison. La réponse était vide.";
    } catch (error) {
        console.error("Erreur Gemini (comparaison):", error);
        return `Erreur technique lors de la génération de la comparaison: ${error.message}`;
    }
}

/**
 * Gère le clic sur le bouton de comparaison, collecte les données et affiche les résultats.
 */
async function handleComparisonClick() {
    const compareBtn = document.getElementById('compare-btn');
    if (!compareBtn) return;
    
    compareBtn.disabled = true;
    compareBtn.textContent = 'Analyse en cours...';

    const checkedBoxes = document.querySelectorAll('.species-checkbox:checked');
    const speciesData = Array.from(checkedBoxes).map(box => ({
        species: box.dataset.species,
        physio: decodeURIComponent(box.dataset.physio),
        eco: decodeURIComponent(box.dataset.eco)
    }));

    const comparisonText = await getComparisonFromGemini(speciesData);

    showComparisonModal('Analyse Comparative des Espèces', comparisonText);

    compareBtn.disabled = false;
    compareBtn.textContent = 'Lancer la comparaison';
}


/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function callPlantNetAPI(formData) { try { const res = await fetch(ENDPOINT, { method: "POST", body: formData }); if (!res.ok) { const errBody = await res.json().catch(() => res.text()); throw new Error(`Erreur API PlantNet (${res.status}): ${typeof errBody === 'object' ? errBody.message : errBody}`); } return (await res.json()).results.slice(0, MAX_RESULTS); } catch (err) { console.error(err); showNotification(err.message, 'error'); return null; } }
async function identifySingleImage(fileBlob, organ) {
  await ready;
  const fd = new FormData();
  fd.append("images", fileBlob, fileBlob.name || "photo.jpg");
  fd.append("organs", organ);
  const results = await callPlantNetAPI(fd);
  if (results) {
    document.body.classList.remove("home");
    buildTable(results);
    buildCards(results);
    const latin = results[0]?.species?.scientificNameWithoutAuthor;
    if (latin) savePhotoLocally(fileBlob, latin);
  }
}
async function identifyMultipleImages(files, organs) { await ready; const fd = new FormData(); files.forEach((f, i) => fd.append("images", f, f.name || `photo_${i}.jpg`)); organs.forEach(o => fd.append("organs", o)); if (!fd.has("images")) return showNotification("Aucune image valide.", 'error'); const results = await callPlantNetAPI(fd); if (results) { sessionStorage.setItem("identificationResults", JSON.stringify(results)); ["photoData", "speciesQueryName"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } }

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;

  const headers = ['Sél.', 'Nom latin (score %)', 'FloreAlpes', 'INPN statut', 'Critères physiologiques', 'Écologie', 'Physionomie', 'Flora Gallica', 'OpenObs', "Biodiv'AURA", 'Info Flora', 'Fiche synthèse', 'PFAF', 'Carnet'];
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
    const crit = criteresOf(sci);
    const phys = physioOf(sci);
    const genus = sci.split(' ')[0].toLowerCase();
    const tocEntry = floraToc[genus];
    let floraGallicaLink = "—";
    if (tocEntry?.pdfFile && tocEntry?.page) {
      const pdfPath = `assets/flora_gallica_pdfs/${tocEntry.pdfFile}`;
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
    return `<tr>
              <td class="col-checkbox">
                <input type="checkbox" class="species-checkbox" 
                       data-species="${escapedSci}" 
                       data-physio="${encodeURIComponent(phys)}" 
                       data-eco="${encodeURIComponent(eco)}">
              </td>
              <td class="col-nom-latin">${sci}<br><span class="score">(${pct})</span></td>
              <td class="col-link">${floreAlpesLink}</td>
              <td class="col-link">${linkIcon(cd && inpnStatut(cd), "INPN.png", "INPN")}</td>
              <td class="col-criteres">${crit}</td>
              <td class="col-ecologie">${eco}</td>
              <td class="col-physionomie">${phys}</td>
              <td class="col-link">${floraGallicaLink}</td>
              <td class="col-link">${linkIcon(cd && openObs(cd), "OpenObs.png", "OpenObs")}</td>
              <td class="col-link">${linkIcon(cd && aura(cd), "Biodiv'AURA.png", "Biodiv'AURA")}</td>
              <td class="col-link">${linkIcon(infoFlora(sci), "Info Flora.png", "Info Flora")}</td>
              <td class="col-link"><a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')"><img src="assets/Audio.png" alt="Audio" class="logo-icon"></a></td>
              <td class="col-link">${linkIcon(pfaf(sci), "PFAF.png", "PFAF")}</td>
              <td class="col-link"><button onclick="saveObservationPrompt('${escapedSci}')">⭐</button></td>
            </tr>`;
  }).join("");

  const headerHtml = `<tr><th>Sél.</th><th>Nom latin (score %)</th><th>FloreAlpes</th><th>INPN statut</th><th>Critères physiologiques</th><th>Écologie</th><th>Physionomie</th><th>Flora Gallica</th><th>OpenObs</th><th>Biodiv'AURA</th><th>Info Flora</th><th>Fiche synthèse</th><th>PFAF</th><th>Carnet</th></tr>`;
  const colgroupHtml = `<colgroup><col style="width: 4%;"><col style="width: 18%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 15%;"><col style="width: 15%;"><col style="width: 10%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"><col style="width: 5%;"></colgroup>`;
  
  wrap.innerHTML = `<table>${colgroupHtml}<thead>${headerHtml}</thead><tbody>${rows}</tbody></table><div id="comparison-footer" style="padding-top: 1rem; text-align: center;"></div>`;

  const footer = document.getElementById('comparison-footer');
  if (footer) {
      const compareBtn = document.createElement('button');
      compareBtn.id = 'compare-btn';
      compareBtn.textContent = 'Lancer la comparaison';
      compareBtn.className = 'action-button';
      compareBtn.style.display = 'none';
      compareBtn.style.padding = '0.8rem 1.5rem';
      
      footer.appendChild(compareBtn);

      compareBtn.addEventListener('click', handleComparisonClick);

      wrap.addEventListener('change', (e) => {
          if (e.target.classList.contains('species-checkbox')) {
              const checkedCount = wrap.querySelectorAll('.species-checkbox:checked').length;
              compareBtn.style.display = (checkedCount >= 2) ? 'inline-block' : 'none';
          }
      });
  }
}

function buildCards(items){ const zone = document.getElementById("cards"); if (!zone) return; zone.innerHTML = ""; items.forEach(item => { const sci = item.species.scientificNameWithoutAuthor; const cd = cdRef(sci); if(!cd && !(item.score === 1.00 && items.length === 1)) return; const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info"; const isNameSearchResult = item.score === 1.00 && items.length === 1; const details = document.createElement("details"); let iframeHTML = ''; if (cd) { iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe><iframe loading="lazy" src="${openObs(cd)}" title="OpenObs"></iframe></div>`; } details.innerHTML = `<summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`; zone.appendChild(details); }); }

/* ================================================================
   LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
   ================================================================ */
function handleSingleFileSelect(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { sessionStorage.setItem("photoData", reader.result); ["speciesQueryName", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; }; reader.onerror = () => showNotification("Erreur lecture image.", 'error'); reader.readAsDataURL(file); }
const speciesSearchInput = document.getElementById("species-search-input");
const speciesSearchButton = document.getElementById("species-search-button");
const speciesSuggestions = document.getElementById("species-suggestions");

if (document.getElementById("file-capture")) {
  const fileCaptureInput = document.getElementById("file-capture");
  const fileGalleryInput = document.getElementById("file-gallery");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");
  let selectedMultiFilesData = [];
  fileCaptureInput?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) handleSingleFileSelect(f);
  });
  fileGalleryInput?.addEventListener("change", e => handleSingleFileSelect(e.target.files[0]));
  const performSpeciesSearch = async () => {
    const query = speciesSearchInput.value.trim();
    if (!query) return;
    await ready;
    const normQuery = norm(query);
    let foundName = taxrefNames.find(n => norm(n) === normQuery);
    if (!foundName) {
      const partial = taxrefNames.filter(n => norm(n).startsWith(normQuery));
      if (partial.length === 1) foundName = partial[0];
    }
    if (foundName) {
      sessionStorage.setItem("speciesQueryName", foundName);
      ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
      location.href = "organ.html";
    } else {
      showNotification(`Espèce "${query}" non trouvée.`, "error");
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
      itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">Feuille</option><option value="flower">Fleur</option><option value="fruit">Fruit</option><option value="bark">Écorce</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`;
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
  multiFileInput?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files), r = MAX_MULTI_IMAGES - selectedMultiFilesData.length;
    if (r <= 0) return showNotification(`Limite de ${MAX_MULTI_IMAGES} atteinte.`, "error");
    files.slice(0, r).forEach(f => {
      if (!selectedMultiFilesData.some(i => i.file.name === f.name && i.file.size === f.size)) selectedMultiFilesData.push({ file: f, organ: 'leaf' });
    });
    if (files.length > r) showNotification(`Limite atteinte.`, "error");
    renderMultiImageList();
    e.target.value = '';
  });
  multiImageIdentifyButton?.addEventListener("click", () => {
    if (selectedMultiFilesData.length === 0) return showNotification("Veuillez sélectionner au moins une image.", "error");
    identifyMultipleImages(selectedMultiFilesData.map(i => i.file), selectedMultiFilesData.map(i => i.organ));
  });
}
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

speciesSearchInput?.addEventListener("input", e => {
  if (!speciesSuggestions) return;
  const q = norm(e.target.value);
  if (!q) { speciesSuggestions.innerHTML = ""; return; }
  const matches = taxrefNames.filter(n => norm(n).startsWith(q)).slice(0, 5);
  speciesSuggestions.innerHTML = matches.map(n => `<option value="${n}">`).join("");
});
