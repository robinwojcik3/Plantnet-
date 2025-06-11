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
let trigramIndex = {};
let nameTrigram = {};
let ecology = {};
let floraToc = {};
let floreAlpesIndex = {}; 
let criteres = {}; // NOUVEAU : pour les critères physiologiques
let physionomie = {}; // Nouvelle table pour la physionomie
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

let dataPromise = null;
function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => {
      taxrefNames.push(k);
      taxref[norm(k)] = v;
      const tri = makeTrigram(k);
      nameTrigram[k] = tri;
      if (!trigramIndex[tri]) trigramIndex[tri] = [];
      trigramIndex[tri].push(k);
    })),
    fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
    fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
    fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j),
    // NOUVEAU : Chargement des critères physiologiques
    fetch("Criteres_herbier.json").then(r => r.json()).then(j => j.forEach(item => criteres[norm(item.species)] = item.description)),
    // Nouvelle donnée : physionomie des espèces
    fetch("Physionomie.json").then(r => r.json()).then(j => j.forEach(item => physionomie[norm(item.nom_latin)] = item.physionomie))
  ]).then(() => { taxrefNames.sort(); console.log("Données prêtes."); })
    .catch(err => {
      dataPromise = null;
      showNotification("Erreur chargement des données: " + err.message, 'error');
    });
  return dataPromise;
}


/* ================================================================
   FONCTIONS UTILITAIRES ET HELPERS
   ================================================================ */
function norm(txt) {
  if (typeof txt !== 'string') return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "");
}
function makeTrigram(name) {
  const tokens = name.toLowerCase().split(/\s+/);
  if (tokens.length < 2) return "";
  let tri = tokens[0].slice(0, 3) + tokens[1].slice(0, 3);
  if (tokens[2] && tokens[2].startsWith("subsp")) {
    tri += "subsp" + (tokens[3] ? tokens[3].slice(0, 3) : "");
  } else if (tokens[2] && tokens[2].startsWith("var")) {
    tri += "var" + (tokens[3] ? tokens[3].slice(0, 3) : "");
  }
  return norm(tri);
}
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const criteresOf = n => criteres[norm(n)] || "—"; // NOUVEAU : fonction pour récupérer les critères
const physioOf = n => physionomie[norm(n)] || "—"; // Récupération de la physionomie
const slug = n => norm(n).replace(/ /g, "-");
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const openObs    = c => `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=lsid%3A${c}%20AND%20(dynamicProperties_diffusionGP%3A%22true%22)&qc=&radius=120.6&lat=45.188529&lon=5.724524#tab_mapView`;
function openObsMulti(codes) {
  if (!Array.isArray(codes) || codes.length === 0) return '';
  const q = `(${codes.map(c => `lsid:${c}`).join(' OR ')}) AND (dynamicProperties_diffusionGP:"true")`;
  return `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=${encodeURIComponent(q)}&qc=&radius=120.6&lat=45.188529&lon=5.724524#tab_mapView`;
}

let openObsMap = null;
let openObsLayer = null;

async function fetchOpenObsOccurrences(cd) {
  if (!cd) return [];
  const url = `https://openobs.mnhn.fr/api/occurrence?lsid=${cd}&diffusionGP=true`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('API error');
    const data = await resp.json();
    if (Array.isArray(data.features)) return data.features;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.records)) return data.records;
    return [];
  } catch (err) {
    console.error('OpenObs API', err);
    showNotification('Erreur lors de la récupération des données OpenObs', 'error');
    return [];
  }
}

function extractCoords(rec) {
  if (!rec) return null;
  const lat = rec.decimalLatitude || rec.decimallatitude || rec.lat || rec.latitude || (rec.geometry && rec.geometry.coordinates && rec.geometry.coordinates[1]);
  const lon = rec.decimalLongitude || rec.decimallongitude || rec.lon || rec.longitude || (rec.geometry && rec.geometry.coordinates && rec.geometry.coordinates[0]);
  if (lat && lon) return [parseFloat(lat), parseFloat(lon)];
  return null;
}

async function showOpenObsMap(cd) {
  const points = await fetchOpenObsOccurrences(cd);
  let overlay = document.getElementById('openobs-map-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'openobs-map-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;';

  const container = document.createElement('div');
  container.style.cssText = 'background:var(--card,#fff);border-radius:8px;width:90%;max-width:800px;height:80%;display:flex;flex-direction:column;position:relative;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.className = 'action-button';
  closeBtn.style.cssText = 'margin:0.5rem;align-self:flex-end;z-index:1001;';
  closeBtn.onclick = () => overlay.remove();

  const mapDiv = document.createElement('div');
  mapDiv.id = 'openobs-map';
  mapDiv.style.cssText = 'flex:1;';

  container.appendChild(closeBtn);
  container.appendChild(mapDiv);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  setTimeout(() => {
    if (!openObsMap) {
      openObsMap = L.map('openobs-map').setView([45.188529, 5.724524], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(openObsMap);
    } else {
      openObsMap.invalidateSize();
      openObsMap.setView([45.188529, 5.724524], 6);
      if (openObsLayer) {
        openObsLayer.clearLayers();
      }
    }
    openObsLayer = L.layerGroup().addTo(openObsMap);
    const markers = [];
    points.forEach(p => {
      const coords = extractCoords(p);
      if (!coords) return;
      const m = L.marker(coords).addTo(openObsLayer);
      markers.push(m);
    });
    if (markers.length) {
      const group = new L.featureGroup(markers);
      openObsMap.fitBounds(group.getBounds().pad(0.1));
    }
  }, 100);
}

const pfaf       = n => `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(n).replace(/%20/g, '+')}`;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

function enableDragScroll(el) {
  if (!el) return;
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    isDown = true;
    startX = e.clientX;
    scrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = startX - e.clientX;
    el.scrollLeft = scrollLeft + dx;
  });
  const stop = () => { isDown = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}
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
async function apiFetch(url, options = {}) {
  toggleSpinner(true);
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.json().catch(() => res.text());
      throw new Error(typeof errBody === "object" ? errBody.error?.message || errBody.message : errBody);
    }
    return await res.json();
  } catch (e) {
    console.error(e);
    showNotification(e.message || "Erreur lors de la requête", 'error');
    return null;
  } finally {
    toggleSpinner(false);
  }
}

// Interroge l'API TaxRef-Match pour proposer des noms valides
async function taxrefFuzzyMatch(term) {
  const url = `https://taxref.mnhn.fr/api/taxa/fuzzyMatch?term=${encodeURIComponent(term)}`;
  const data = await apiFetch(url);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.matches)) return data.matches;
  return [];
}


/* ================================================================
   NOUVEAU : FENÊTRE MODALE D'INFORMATION GÉNÉRIQUE
   ================================================================ */

function showInfoModal(title, content) {
    const existingModal = document.getElementById('info-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'info-modal-overlay';
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


/* ================================================================
   NOUVEAU : FONCTIONS POUR LA FICHE DE SYNTHÈSE (TEXTE ET AUDIO)
   ================================================================ */

async function getSynthesisFromGemini(speciesName) {
    const prompt = `En tant qu'expert botaniste, rédige une fiche de synthèse narrative et fluide pour l'espèce "${speciesName}". Le style doit être oral, comme si tu t'adressais à des étudiants, pour une future conversion en audio. N'utilise ni tableau, ni formatage de code, ni listes à puces. Structure ta réponse en couvrant les points suivants de manière conversationnelle, sans utiliser de titres : commence par une introduction (nom commun, nom latin, famille), puis décris un ou deux critères d'identification clés pour la distinguer d'espèces proches. Mentionne ces espèces sources de confusion et comment les différencier. Ensuite, décris son écologie et habitat préférentiel. Termine par son statut de conservation en France (si pertinent) et sa répartition générale. Dans ta réponse, ne met aucun caractères qui ne soit pas du text directement. Je ne veux pas que tu mette de '*' ou de ":" ou de "/", met juste du texte conventionelle comme on écrirait naturellement quoi. Utilise ton savoir encyclopédique pour générer cette fiche.`;
    const requestBody = { "contents": [{ "parts": [{ "text": prompt }] }], "generationConfig": { "temperature": 0.4, "maxOutputTokens": 800 } };
    try {
        const responseData = await apiFetch(GEMINI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
        if (!responseData) return "Erreur lors de la génération du texte.";
        if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) return responseData.candidates[0].content.parts[0].text.trim();
        if (responseData.promptFeedback?.blockReason) return `Réponse bloquée par le modèle (${responseData.promptFeedback.blockReason}).`;
        return "Le modèle n'a pas pu générer de synthèse.";
    } catch (error) { console.error("Erreur Gemini:", error); return "Erreur lors de la génération du texte."; }
}

async function synthesizeSpeech(text) {
    const requestBody = {
        input: { text: text },
        voice: { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-D' },
        audioConfig: { audioEncoding: "MP3" }
    };
    try {
        const responseData = await apiFetch(TTS_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
        return responseData ? responseData.audioContent : null;
    } catch (error) {
        console.error("Erreur Text-to-Speech:", error);
        return null;
    }
}

// Convertit une chaîne Base64 en audio et la joue
function playAudioFromBase64(base64Audio) {
    if (!base64Audio) return;
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audio.play().catch(err => {
        console.error("Erreur lecture audio:", err);
        showNotification("Impossible de lire l\'audio", 'error');
    });
}


window.handleSynthesisClick = async function(event, element, speciesName) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Texte en cours...</i>';
    element.style.pointerEvents = 'none';

    const synthesisText = await getSynthesisFromGemini(speciesName);
    if (synthesisText.startsWith('Erreur') || synthesisText.startsWith('Réponse')) {
        showInfoModal('Erreur de Synthèse',synthesisText);
        parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
        return;
    }
    
    parentCell.innerHTML = '<i>Audio en cours...</i>';
    const audioData = await synthesizeSpeech(synthesisText);

    if (audioData) {
        playAudioFromBase64(audioData);
    } else {
        showInfoModal("Échec de la synthèse audio", "La synthèse audio a échoué. Le texte généré était :\n\n" + synthesisText);
    }

    parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
};


/* ================================================================
   NOUVEAU : FONCTIONS POUR L'ANALYSE COMPARATIVE
   ================================================================ */
async function getComparisonFromGemini(speciesData) {
    const speciesDataString = speciesData.map(s => `Espèce: ${s.species}\nDonnées morphologiques (Physionomie): ${s.physio || 'Non renseignée'}\nDonnées écologiques: ${s.eco || 'Non renseignée'}`).join('\n\n');
    
    // MODIFICATION : Le prompt est mis à jour pour structurer la réponse en 3 parties.
    const promptTemplate = `En te basant sur les données fournies ci-dessous, rédige une analyse comparative dont l'objectif est de mettre en évidence les points de distinction clairs entre les espèces.
Données :
---
${speciesDataString}
---
Ta réponse doit être structurée en deux parties distinctes, sans aucun texte introductif ou superflu.

Commence par une phrase unique (1 à 2 lignes maximum) qui met en évidence le critère morphologique le plus facilement observable et le plus discriminant pour distinguer les espèces analysées.

Ensuite, présente un tableau comparatif en format Markdown. Ce tableau doit regrouper pour chaque espèce les principaux critères morphologiques (forme, taille, couleur des organes, etc.) et écologiques (habitat, type de sol, altitude), en t’appuyant sur les informations des colonnes « Physionomie » et « Écologie ». Organise les lignes du tableau en commençant par les critères les plus simples et discriminants à observer. Le contenu du tableau doit rester clair, sans utiliser de gras, italique ou autres styles typographiques.`;

    const requestBody = { 
        "contents": [{ "parts": [{ "text": promptTemplate }] }], 
        "generationConfig": { "temperature": 0.3, "maxOutputTokens": 1500 } 
    };
    try {
        const responseData = await apiFetch(GEMINI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!responseData) return "Erreur technique lors de la génération de la comparaison.";
        if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
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

async function handleComparisonClick() {
    const compareBtn = document.getElementById('compare-btn');
    if (!compareBtn) return;
    
    compareBtn.disabled = true;
    compareBtn.textContent = 'Analyse en cours...';

    const resultsContainer = document.getElementById('comparison-results-container');
    if (!resultsContainer) {
        console.error("Le conteneur de résultats (#comparison-results-container) est introuvable.");
        compareBtn.disabled = false;
        compareBtn.textContent = 'Lancer la comparaison';
        return;
    }
    resultsContainer.innerHTML = '<i>Génération de la comparaison en cours...</i>';
    resultsContainer.style.display = 'block';

    const checkedBoxes = document.querySelectorAll('.species-checkbox:checked');
    const speciesData = Array.from(checkedBoxes).map(box => ({
        species: box.dataset.species,
        physio: decodeURIComponent(box.dataset.physio),
        eco: decodeURIComponent(box.dataset.eco)
    }));

    const cdCodes = speciesData.map(s => cdRef(s.species)).filter(Boolean);
    const mapUrl = cdCodes.length ? openObsMulti(cdCodes) : '';

    const comparisonText = await getComparisonFromGemini(speciesData);

    // MODIFICATION : La structure HTML inclut maintenant le bouton de synthèse vocale.
    resultsContainer.style.cssText = `
        margin-top: 2rem;
        padding: 1.5rem;
        background: var(--card, #ffffff);
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,.05);
    `;
    resultsContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
            <h2 style="margin:0; color:var(--primary, #388e3c);">Analyse Comparative des Espèces</h2>
            <a href="#" id="comparison-tts-btn" title="Écouter la synthèse" style="flex-shrink: 0;">
                <img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height: 32px;">
            </a>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border, #e0e0e0); margin: 1rem 0;">
        <p id="comparison-text-content">${comparisonText.replace(/\n/g, '<br>')}</p>
        ${mapUrl ? `<div style="margin-top:1.5rem;"><iframe loading="lazy" src="${mapUrl}" title="Carte OpenObs" style="width:100%;height:400px;border:none;"></iframe></div>` : ''}
    `;

    // Ajout de l'écouteur d'événement pour le nouveau bouton de synthèse vocale.
    document.getElementById('comparison-tts-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const textElement = document.getElementById('comparison-text-content');
        if (!textElement) return;

        const textToSynthesize = textElement.innerText;
        
        btn.innerHTML = '<i>...</i>';
        btn.style.pointerEvents = 'none';

        const audioData = await synthesizeSpeech(textToSynthesize);
        if (audioData) {
            playAudioFromBase64(audioData);
        } else {
            showInfoModal("Échec de la synthèse audio", "La conversion du texte en audio a échoué.");
        }

        // Restaurer le bouton
        btn.innerHTML = '<img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height: 32px;">';
        btn.style.pointerEvents = 'auto';
    });

    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    compareBtn.disabled = false;
    compareBtn.textContent = 'Lancer la comparaison';
}


/* ================================================================
   LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
   ================================================================ */
async function callPlantNetAPI(formData, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const data = await apiFetch(ENDPOINT, { method: 'POST', body: formData });
        if (data) return data.results.slice(0, MAX_RESULTS);
        if (attempt < retries) {
            await new Promise(res => setTimeout(res, 1000));
        }
    }
    showNotification('Échec de l\'analyse après plusieurs tentatives.', 'error');
    return null;
}
async function identifySingleImage(fileBlob, organ) {
  await loadData();
  const fd = new FormData();
  fd.append("images", fileBlob, fileBlob.name || "photo.jpg");
  fd.append("organs", organ);
  const results = await callPlantNetAPI(fd);
  if (results) {
    document.body.classList.remove("home");
    const preview = document.getElementById("preview");
    if (preview) {
      preview.classList.add('thumbnail');
      preview.addEventListener('click', () => {
        preview.classList.toggle('enlarged');
      });
    }
    buildTable(results);
    buildCards(results);
    const latin = results[0]?.species?.scientificNameWithoutAuthor;
    if (latin) savePhotoLocally(fileBlob, latin);
  }
}
async function identifyMultipleImages(files, organs) { await loadData(); const fd = new FormData(); files.forEach((f, i) => fd.append("images", f, f.name || `photo_${i}.jpg`)); organs.forEach(o => fd.append("organs", o)); if (!fd.has("images")) return showNotification("Aucune image valide.", 'error'); const results = await callPlantNetAPI(fd); if (results) { sessionStorage.setItem("identificationResults", JSON.stringify(results)); ["photoData", "speciesQueryNames"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; } }

function buildTable(items){
  const wrap = document.getElementById("results");
  if (!wrap) return;

  const headers = ['Sél.', 'Nom latin (score %)', 'FloreAlpes', 'INPN statut', 'Critères physiologiques', 'Écologie', 'Physionomie', 'Flora Gallica', 'OpenObs', "Biodiv'AURA", 'Info Flora', 'Fiche synthèse', 'PFAF', 'Carte'];
  const linkIcon = (url, img, alt, extraClass = '') => {
    if (!url) return "—";
    const encoded = img.split('/').map(s => encodeURIComponent(s)).join('/');
    const cls = extraClass ? `logo-icon ${extraClass}` : 'logo-icon';
    return `<a href="${url}" target="_blank" rel="noopener"><img src="assets/${encoded}" alt="${alt}" class="${cls}"></a>`;
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
              <td class="col-nom-latin" data-latin="${sci}">${sci}<br><span class="score">(${pct})</span></td>
              <td class="col-link">${floreAlpesLink}</td>
              <td class="col-link">${linkIcon(cd && inpnStatut(cd), "INPN.png", "INPN", "small-logo")}</td>
              <td class="col-criteres">
                <div class="text-popup-trigger" data-title="Critères physiologiques" data-fulltext="${encodeURIComponent(crit)}">${crit}</div>
              </td>
              <td class="col-ecologie">
                 <div class="text-popup-trigger" data-title="Écologie" data-fulltext="${encodeURIComponent(eco)}">${eco}</div>
              </td>
              <td class="col-physionomie">
                <div class="text-popup-trigger" data-title="Physionomie" data-fulltext="${encodeURIComponent(phys)}">${phys}</div>
              </td>
              <td class="col-link">${floraGallicaLink}</td>
              <td class="col-link">${linkIcon(cd && openObs(cd), "OpenObs.png", "OpenObs", "small-logo")}</td>
              <td class="col-link">${linkIcon(cd && aura(cd), "Biodiv'AURA.png", "Biodiv'AURA")}</td>
              <td class="col-link">${linkIcon(infoFlora(sci), "Info Flora.png", "Info Flora")}</td>
              <td class="col-link"><a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')"><img src="assets/Audio.png" alt="Audio" class="logo-icon"></a></td>
              <td class="col-link">${linkIcon(pfaf(sci), "PFAF.png", "PFAF")}</td>
              <td class="col-link">${cd ? `<a href="#" onclick="showOpenObsMap('${cd}')"><img src="assets/OpenObs.png" alt="Carte" class="logo-icon small-logo"></a>` : '—'}</td>
            </tr>`;
  }).join("");

  const headerHtml = `<tr><th>Sél.</th><th>Nom latin (score %)</th><th>FloreAlpes</th><th>INPN statut</th><th>Critères physiologiques</th><th>Écologie</th><th>Physionomie</th><th>Flora Gallica</th><th>OpenObs</th><th>Biodiv'AURA</th><th>Info Flora</th><th>Fiche synthèse</th><th>PFAF</th><th>Carte</th></tr>`;
  
  wrap.innerHTML = `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${rows}</tbody></table></div><div id="comparison-footer" style="padding-top: 1rem; text-align: center;"></div><div id="comparison-results-container" style="display:none;"></div>`;
  enableDragScroll(wrap);

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
  }

  wrap.addEventListener('change', (e) => {
      if (e.target.classList.contains('species-checkbox')) {
          const checkedCount = wrap.querySelectorAll('.species-checkbox:checked').length;
          const compareBtn = document.getElementById('compare-btn');
          if(compareBtn) {
            compareBtn.style.display = (checkedCount >= 2) ? 'inline-block' : 'none';
          }
      }
  });

  wrap.addEventListener('click', (e) => {
      const nameCell = e.target.closest('.col-nom-latin');
      if (nameCell) {
          const latin = (nameCell.dataset.latin || '').trim();
          const text = latin || nameCell.innerText.replace(/\s*\(.*/, '').replace(/\s+/g, ' ').trim();
          const copy = (t) => {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(t).then(() => {
                      showNotification('Nom latin copié', 'success');
                  }).catch(() => showNotification('Échec de la copie', 'error'));
              } else {
                  const ta = document.createElement('textarea');
                  ta.value = t;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.focus();
                  ta.select();
                  try {
                      document.execCommand('copy');
                      showNotification('Nom latin copié', 'success');
                  } catch(err) {
                      showNotification('Échec de la copie', 'error');
                  }
                  document.body.removeChild(ta);
              }
          };
          copy(text);
          return;
      }

      const targetCell = e.target.closest('.text-popup-trigger');
      if (targetCell) {
          e.preventDefault();
          const infoPanel = document.getElementById('info-panel');
          if (infoPanel) {
              const title = targetCell.dataset.title || '';
              const fullText = decodeURIComponent(targetCell.dataset.fulltext);
              infoPanel.innerHTML = `<h3 style="margin-top:0">${title}</h3><p>${fullText}</p>`;
              infoPanel.style.display = 'block';
              infoPanel.scrollIntoView({behavior:'smooth', block:'start'});
          }
      }
  });
}

function buildCards(items){ const zone = document.getElementById("cards"); if (!zone) return; zone.innerHTML = ""; items.forEach(item => { const sci = item.species.scientificNameWithoutAuthor; const cd = cdRef(sci); if(!cd && !(item.score === 1.00 && items.length === 1)) return; const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info"; const isNameSearchResult = item.score === 1.00 && items.length === 1; const details = document.createElement("details"); let iframeHTML = ''; if (cd) { iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe><iframe loading="lazy" src="${openObs(cd)}" title="OpenObs"></iframe></div>`; } details.innerHTML = `<summary>${sci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`; zone.appendChild(details); }); }

/* ================================================================
   LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
   ================================================================ */
function handleSingleFileSelect(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { sessionStorage.setItem("photoData", reader.result); ["speciesQueryNames", "identificationResults"].forEach(k => sessionStorage.removeItem(k)); location.href = "organ.html"; }; reader.onerror = () => showNotification("Erreur lecture image.", 'error'); reader.readAsDataURL(file); }
const nameSearchInput = document.getElementById("name-search-input");
const nameSearchButton = document.getElementById("name-search-button");
const speciesSuggestions = document.getElementById("species-suggestions");

if (document.getElementById("file-capture")) {
  const fileCaptureInput = document.getElementById("file-capture");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");
  const multiImageSection = document.getElementById("multi-image-section");
  let selectedMultiFilesData = [];
  fileCaptureInput?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) handleSingleFileSelect(f);
  });
  const performNameSearch = async () => {
    const raw = nameSearchInput.value.trim();
    if (!raw) return;
    await loadData();
    const queries = raw.split(/[;,\n]+/).map(q => q.trim()).filter(Boolean);
    if (queries.length === 1 && queries[0].split(/\s+/).length === 1) {
      const q = queries[0];
      const tocEntry = floraToc[norm(q)];
      if (tocEntry?.pdfFile && tocEntry?.page) {
        sessionStorage.setItem("speciesQueryNames", JSON.stringify([q]));
        ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
        location.href = "organ.html";
      } else {
        showNotification(`Genre "${q}" non trouvé.`, "error");
      }
      return;
    }
    const found = [];
    for (const q of queries) {
      const normQuery = norm(q);
      let foundName = taxrefNames.find(n => norm(n) === normQuery);
      if (!foundName) {
        const triList = trigramIndex[normQuery];
        if (triList && triList.length === 1) {
          foundName = triList[0];
        } else {
          const partial = taxrefNames.filter(n => {
            const nk = norm(n);
            return nk.startsWith(normQuery) || (nameTrigram[n] && nameTrigram[n].startsWith(normQuery));
          });
          if (partial.length === 1) foundName = partial[0];
        }
        if (!foundName) {
          const matches = await taxrefFuzzyMatch(q);
          if (matches.length) {
            const best = matches[0];
            foundName = best.nom_complet || best.name || best.nom;
            const sc = best.score !== undefined ? ` (${Math.round(best.score * 100)}%)` : '';
            showNotification(`Suggestion : ${foundName}${sc}`, 'success');
          }
        }
      }
      if (foundName) {
        found.push(foundName);
      } else {
        showNotification(`Espèce "${q}" non trouvée.`, "error");
      }
    }
    if (found.length) {
      sessionStorage.setItem("speciesQueryNames", JSON.stringify(found));
      ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
      location.href = "organ.html";
    }
  };
  nameSearchButton?.addEventListener("click", performNameSearch);
  nameSearchInput?.addEventListener("keypress", e => { if (e.key === "Enter") performNameSearch(); });
  function renderMultiImageList() {
    multiImageListArea.innerHTML = '';
    multiImageIdentifyButton.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none';
    if (multiImageSection) multiImageSection.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none';
    if (selectedMultiFilesData.length === 0) multiFileInput.value = '';
    selectedMultiFilesData.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'image-organ-item';
      itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">🍃</option><option value="flower">🌸</option><option value="fruit">🍒</option><option value="bark">🪵</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`;
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
    const files = Array.from(e.target.files);
    if (selectedMultiFilesData.length === 0 && files.length === 1) {
      handleSingleFileSelect(files[0]);
      e.target.value = '';
      return;
    }
    const r = MAX_MULTI_IMAGES - selectedMultiFilesData.length;
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
const organBoxOnPage = document.getElementById("organ-choice");
if (organBoxOnPage) {
  const displayResults = async (results, isNameSearch = false) => {
    const previewEl = document.getElementById("preview");
    if (previewEl) {
      previewEl.classList.add('thumbnail');
      previewEl.addEventListener('click', () => {
        previewEl.classList.toggle('enlarged');
      });
    }
    organBoxOnPage.style.display = 'none';
    await loadData();
    document.body.classList.remove("home");
    const items = isNameSearch
      ? results.map(n => ({ score: 1.0, species: { scientificNameWithoutAuthor: n } }))
      : results;
    buildTable(items);
    buildCards(items);
  };

  const namesRaw = sessionStorage.getItem("speciesQueryNames");
  const storedImage = sessionStorage.getItem("photoData");
  const multiImageResults = sessionStorage.getItem("identificationResults");

  if (namesRaw) {
    sessionStorage.removeItem("speciesQueryNames");
    let names;
    try { names = JSON.parse(namesRaw); } catch { names = [namesRaw]; }
    displayResults(names, true);
  } else if (multiImageResults) {
    try {
      displayResults(JSON.parse(multiImageResults));
    } catch (e) {
      location.href = "index.html";
    }
  } else if (storedImage) {
    const previewElement = document.getElementById("preview");
    if (previewElement) previewElement.src = storedImage;
    organBoxOnPage.style.display = 'block';
    const toBlob = dataURL => {
      try {
        const [m,b] = dataURL.split(','), [,e] = /:(.*?);/.exec(m), B=atob(b), a=new Uint8Array(B.length);
        for (let i=0; i<B.length; i++) a[i] = B.charCodeAt(i);
        return new Blob([a], { type: e });
      } catch(e) { return null; }
    };
    const imageBlob = toBlob(storedImage);
    if (imageBlob) {
      organBoxOnPage.querySelectorAll("button").forEach(b =>
        b.addEventListener("click", e => identifySingleImage(imageBlob, e.currentTarget.dataset.organ))
      );
    } else {
      showNotification("Erreur lors de la préparation de l'image.", 'error');
    }
  } else {
    location.href = "index.html";
  }
}


nameSearchInput?.addEventListener("input", async e => {
  if (!speciesSuggestions) return;
  await loadData();
  const parts = e.target.value.split(/[;,\n]+/);
  const term = parts[parts.length - 1].trim();
  const q = norm(term);
  if (!q) { speciesSuggestions.innerHTML = ""; return; }
  const matches = taxrefNames.filter(n => {
    const nk = norm(n);
    return nk.startsWith(q) || (nameTrigram[n] && nameTrigram[n].startsWith(q));
  }).slice(0, 5);
  speciesSuggestions.innerHTML = matches.map(n => `<option value="${n}">`).join("");
});

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = () => { loadData(); };
    document.addEventListener('click', trigger, { once: true });
    document.addEventListener('keydown', trigger, { once: true });
  });
}
