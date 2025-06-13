/* ================================================================
      CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
      Approche Hybride Optimisée : Affichage WMS + Interrogation API REST
      ================================================================ */

// Variables globales
let map = null;
let envMap = null;
let layerControl = null;
let envMarker = null;
let marker = null;
let selectedLat = null;
let selectedLon = null;

// Configuration des services externes (liens)
const SERVICES = {
	arcgis: { /* ... (inchangé) ... */ },
	geoportail: { /* ... (inchangé) ... */ },
	ign: { /* ... (inchangé) ... */ },
	inaturalist: { /* ... (inchangé) ... */ },
	topographic: { /* ... (inchangé) ... */ },
	inpn: { /* ... (inchangé) ... */ }
};

// Configuration des couches WMS pour l'affichage visuel rapide
const WMS_LAYERS = {
    'Natura 2000 (Habitats)': {
        layers: "PROTECTEDAREAS.HABITAT",
        attribution: "IGN-Geoportail"
    },
    'Natura 2000 (Oiseaux)': {
        layers: "PROTECTEDAREAS.BIRDS",
        attribution: "IGN-Geoportail"
    },
    'ZNIEFF I': {
        layers: "PROTECTEDAREAS.ZNIEFF1",
        attribution: "IGN-Geoportail"
    },
    'ZNIEFF II': {
        layers: "PROTECTEDAREAS.ZNIEFF2",
        attribution: "IGN-Geoportail"
    },
    'Parcs Nationaux': {
        layers: "PROTECTEDAREAS.PN",
        attribution: "IGN-Geoportail"
    },
    'Réserves Naturelles': {
        layers: "PROTECTEDAREAS.RNN",
        attribution: "IGN-Geoportail"
    }
};

// Configuration des endpoints API Carto pour l'interrogation au clic
const APICARTO_ENDPOINTS = {
    'Natura 2000 (Habitats)': 'https://apicarto.ign.fr/api/nature/natura-habitat',
    'Natura 2000 (Oiseaux)': 'https://apicarto.ign.fr/api/nature/natura-oiseaux',
    'ZNIEFF I': 'https://apicarto.ign.fr/api/nature/znieff1',
    'ZNIEFF II': 'https://apicarto.ign.fr/api/nature/znieff2',
    'Parcs Nationaux': 'https://apicarto.ign.fr/api/nature/pn',
    'Réserves Naturelles': 'https://apicarto.ign.fr/api/nature/rn'
};

// --- Initialisation et logique de la page (inchangées) ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (les addEventListeners restent les mêmes)
});
// ... (les fonctions useGeolocation, toggleMap, initializeMap, validateLocation, searchAddress restent les mêmes)


// Fonction principale pour afficher les résultats (légèrement modifiée)
function showResults() {
    if (!selectedLat || !selectedLon) { /* ... */ return; }
	const loading = document.getElementById('loading');
	loading.style.display = 'block';
	loading.textContent = 'Préparation des liens...';
	
	setTimeout(() => {
		loading.style.display = 'none';
		const resultsSection = document.getElementById('results-section');
		resultsSection.style.display = 'block';
		const resultsGrid = document.getElementById('results-grid');
		resultsGrid.innerHTML = '';
		
		Object.keys(SERVICES).forEach(serviceKey => {
            const service = SERVICES[serviceKey];
            const url = service.buildUrl(selectedLat, selectedLon);
			const card = document.createElement('div');
			card.className = 'result-card';
			card.innerHTML = `<h3>${service.name}</h3><p>${service.description}</p><a href="${url}" target="_blank" rel="noopener noreferrer">Ouvrir dans un nouvel onglet →</a>`;
			resultsGrid.appendChild(card);
		});

		displayHybridEnvMap(); // Appel de la nouvelle fonction pour la carte hybride
		resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, 500);
}


/**
 * Affiche la carte interactive en mode hybride : couches WMS pour le visuel,
 * et interrogation de l'API REST au clic pour les détails.
 */
function displayHybridEnvMap() {
    const mapDiv = document.getElementById('env-map');
    mapDiv.style.display = 'block';
    document.getElementById('layer-controls').style.display = 'block'; // On réutilise ce conteneur

    // Initialisation ou réinitialisation de la carte
    if (!envMap) {
        envMap = L.map('env-map').setView([selectedLat, selectedLon], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(envMap);
    } else {
        envMap.setView([selectedLat, selectedLon], 11);
        if (layerControl) envMap.removeControl(layerControl);
    }
    
    // Création des couches WMS et du contrôleur
    const wmsOverlayLayers = {};
    Object.entries(WMS_LAYERS).forEach(([name, config]) => {
        wmsOverlayLayers[name] = L.tileLayer.wms("/api/wms/inpn", {
            layers: config.layers,
            format: 'image/png',
            transparent: true,
            attribution: config.attribution
        });
    });

    layerControl = L.control.layers(null, wmsOverlayLayers, { collapsed: false }).addTo(envMap);
    
    // Logique d'interrogation au clic
    envMap.off('click').on('click', handleMapClick);
}

/**
 * Gère le clic sur la carte pour interroger les données attributaires.
 * @param {L.LeafletMouseEvent} e - L'événement de clic de Leaflet.
 */
async function handleMapClick(e) {
    const { lat, lng } = e.latlng;
    const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent('<p>Analyse des couches en cours...</p>')
        .openOn(envMap);

    let finalContent = '<h4>Données au point cliqué</h4>';
    let resultsFound = false;

    const activeWmsLayers = [];
    envMap.eachLayer(layer => {
        if (layer instanceof L.TileLayer.WMS && envMap.hasLayer(layer)) {
             // Retrouver le nom de la couche à partir de l'objet layer
            for(const name in layerControl._layers) {
                if(layerControl._layers[name].layer === layer) {
                    activeWmsLayers.push(name);
                    break;
                }
            }
        }
    });

    if (activeWmsLayers.length === 0) {
        popup.setContent("<p>Aucune couche n'est activée. Cochez une ou plusieurs couches pour l'analyse.</p>");
        return;
    }

    const promises = activeWmsLayers.map(async (layerName) => {
        const endpoint = APICARTO_ENDPOINTS[layerName];
        if (!endpoint) return;

        try {
            const url = `${endpoint}?lon=${lng}&lat=${lat}`;
            const response = await fetch(url);
            if (!response.ok) return;
            const geojsonData = await response.json();

            if (geojsonData.features.length > 0) {
                resultsFound = true;
                finalContent += `<h5>${layerName}</h5><ul>`;
                geojsonData.features.forEach(feature => {
                    for (const key in feature.properties) {
                         finalContent += `<li><strong>${key}:</strong> ${feature.properties[key]}</li>`;
                    }
                });
                finalContent += '</ul>';
            }
        } catch (error) {
            console.error(`Erreur API pour ${layerName}:`, error);
        }
    });

    await Promise.all(promises);

    if (!resultsFound) {
        popup.setContent("<p>Aucune donnée de zone protégée trouvée à cet emplacement pour les couches actives.</p>");
    } else {
        popup.setContent(finalContent);
    }
}


// --- Fonctions utilitaires et de support (inchangées) ---
function latLonToWebMercator(lat, lon) { /* ... */ }
function showNotification(message, type = 'info') { /* ... */ }
window.addEventListener('pageshow', (event) => { /* ... */ });
