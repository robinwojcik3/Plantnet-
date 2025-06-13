/* ================================================================
      CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
      Approche Hybride Optimisée : Affichage WMS + Interrogation API REST
      ================================================================ */

// Variables globales
let map = null;
let envMap = null;
let layerControl = null;
let marker = null;
let selectedLat = null;
let selectedLon = null;

// Configuration des services externes
const SERVICES = {
	arcgis: {
		name: "ArcGIS - Carte de la végétation",
		description: "Visualisez la carte de végétation de la zone",
		buildUrl: (lat, lon) => {
			const { x, y } = latLonToWebMercator(lat, lon);
			const buffer = 1000;
			return `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&extent=${x-buffer}%2C${y-buffer}%2C${x+buffer}%2C${y+buffer}%2C102100`;
		}
	},
	geoportail: {
		name: "Géoportail - Carte des sols",
		description: "Explorez la carte pédologique de la zone",
		buildUrl: (lat, lon) => {
			return `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=ORTHOIMAGERY.ORTHOPHOTOS::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.5)&permalink=yes`;
		}
	},
	ign: {
		name: "IGN Remonter le temps",
		description: "Comparez l'évolution du paysage dans le temps",
		buildUrl: (lat, lon) => {
			return `https://remonterletemps.ign.fr/comparer?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&z=17&layer1=16&layer2=19&mode=split-h`;
		}
	},
	inaturalist: {
		name: "iNaturalist - Observations",
		description: "Découvrez les observations naturalistes de la zone",
		buildUrl: (lat, lon) => {
			const radius = 5; // km
			return `https://www.inaturalist.org/observations?lat=${lat.toFixed(8)}&lng=${lon.toFixed(8)}&radius=${radius}&subview=map&threatened&iconic_taxa=Plantae`;
		}
	},
	topographic: {
		name: "Carte topographique",
		description: "Visualisez le relief et l'altitude de la zone",
		buildUrl: (lat, lon) => {
			return `https://fr-fr.topographic-map.com/map-v1qmt/?center=${lat.toFixed(6)}%2C${lon.toFixed(6)}&zoom=15`;
		}
	},
	inpn: {
		name: "INPN - Espaces protégés",
		description: "Accédez à la cartographie des espaces protégés",
		buildUrl: () => {
			return "https://inpn.mnhn.fr/viewer-carto/espaces/";
		}
	}
};

// MODIFICATION : Configuration des couches WMS pour l'affichage visuel
const WMS_LAYERS = {
    'Natura 2000 (Habitats)': { layers: "PROTECTEDAREAS.HABITAT", attribution: "IGN-Geoportail" },
    'Natura 2000 (Oiseaux)': { layers: "PROTECTEDAREAS.BIRDS", attribution: "IGN-Geoportail" },
    'ZNIEFF I': { layers: "PROTECTEDAREAS.ZNIEFF1", attribution: "IGN-Geoportail" },
    'ZNIEFF II': { layers: "PROTECTEDAREAS.ZNIEFF2", attribution: "IGN-Geoportail" },
    'Parcs Nationaux': { layers: "PROTECTEDAREAS.PN", attribution: "IGN-Geoportail" },
    'Réserves Nat. Nationales': { layers: "PROTECTEDAREAS.RNN", attribution: "IGN-Geoportail" },
    'Réserves Nat. Régionales': { layers: "PROTECTEDAREAS.RNR", attribution: "IGN-Geoportail" },
    'Arrêtés Protection Biotope': { layers: "PROTECTEDAREAS.BIOTOPE", attribution: "IGN-Geoportail" },
    'Espaces Naturels Sensibles': { layers: "PROTECTEDAREAS.ENS", attribution: "IGN-Geoportail" }
};

// MODIFICATION : Configuration des endpoints API Carto pour l'interrogation au clic
const APICARTO_ENDPOINTS = {
    'Natura 2000 (Habitats)': 'https://apicarto.ign.fr/api/nature/natura-habitat',
    'Natura 2000 (Oiseaux)': 'https://apicarto.ign.fr/api/nature/natura-oiseaux',
    'ZNIEFF I': 'https://apicarto.ign.fr/api/nature/znieff1',
    'ZNIEFF II': 'https://apicarto.ign.fr/api/nature/znieff2',
    'Parcs Nationaux': 'https://apicarto.ign.fr/api/nature/pn',
    'Réserves Nat. Nationales': 'https://apicarto.ign.fr/api/nature/rn',
    'Réserves Nat. Régionales': 'https://apicarto.ign.fr/api/nature/rn',
    'Arrêtés Protection Biotope': 'https://apicarto.ign.fr/api/nature/biotope'
    // Pas d'endpoint national pour les ENS dans l'API Carto Nature, l'interaction au clic ne sera pas disponible pour cette couche.
};


// Utilitaires de conversion (inchangé)
function latLonToWebMercator(lat, lon) {
	const R = 6378137.0;
	const x = R * (lon * Math.PI / 180);
	const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
	return { x, y };
}

// Initialisation au chargement de la page (inchangé)
document.addEventListener('DOMContentLoaded', () => {
	document.getElementById('use-geolocation').addEventListener('click', useGeolocation);
	document.getElementById('choose-on-map').addEventListener('click', toggleMap);
	document.getElementById('validate-location').addEventListener('click', validateLocation);
	document.getElementById('search-address').addEventListener('click', searchAddress);
	document.getElementById('address-input').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') searchAddress();
	});
});

// Logique de sélection de la localisation (inchangée)
async function useGeolocation() {
	const button = document.getElementById('use-geolocation');
	button.disabled = true;
	button.textContent = 'Récupération de la position...';
	if (!navigator.geolocation) {
		showNotification('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
		button.disabled = false;
		button.textContent = 'Utiliser ma localisation';
		return;
	}
	navigator.geolocation.getCurrentPosition(
		(position) => {
			selectedLat = position.coords.latitude;
			selectedLon = position.coords.longitude;
			button.textContent = 'Position récupérée ✓';
			setTimeout(() => {
				button.disabled = false;
				button.textContent = 'Utiliser ma localisation';
			}, 2000);
			showResults();
		},
		(error) => {
			let message = 'Impossible de récupérer votre position';
			switch(error.code) {
				case error.PERMISSION_DENIED: message = 'Vous avez refusé l\'accès à votre position'; break;
				case error.POSITION_UNAVAILABLE: message = 'Position indisponible'; break;
				case error.TIMEOUT: message = 'La demande de position a expiré'; break;
			}
			showNotification(message, 'error');
			button.disabled = false;
			button.textContent = 'Utiliser ma localisation';
		},
		{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
	);
}

function toggleMap() {
	const mapContainer = document.getElementById('map-container');
	const button = document.getElementById('choose-on-map');
	const instruction = document.getElementById('map-instruction');
	if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
		mapContainer.style.display = 'block';
		instruction.style.display = 'block';
		button.textContent = 'Fermer la carte';
		if (!map) {
			initializeMap();
		} else {
			setTimeout(() => map.invalidateSize(), 100);
		}
		setTimeout(() => { instruction.style.display = 'none'; }, 3000);
	} else {
		mapContainer.style.display = 'none';
		button.textContent = 'Ouvrir la carte';
	}
}

function initializeMap() {
	map = L.map('map').setView([45.188529, 5.724524], 13);
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© OpenStreetMap contributors', maxZoom: 19
	}).addTo(map);
	function selectPoint(e) {
		const { lat, lng } = e.latlng;
		if (marker) map.removeLayer(marker);
		marker = L.marker([lat, lng]).addTo(map);
		selectedLat = lat;
		selectedLon = lng;
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
	}
	let pressTimer;
	let isPressing = false;
	map.on('mousedown', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('mouseup', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('mousemove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('touchstart', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('touchend', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('touchmove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('contextmenu', (e) => { e.originalEvent.preventDefault(); selectPoint(e); });
}

function validateLocation() {
	if (selectedLat && selectedLon) showResults();
}

async function searchAddress() {
	const input = document.getElementById('address-input');
	const address = input.value.trim();
	if (!address) return showNotification('Veuillez entrer une adresse', 'error');
	const button = document.getElementById('search-address');
	button.disabled = true;
	button.textContent = 'Recherche en cours...';
	try {
		const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
		if (!resp.ok) throw new Error('Service indisponible');
		const data = await resp.json();
		if (!data.length) throw new Error('Adresse introuvable');
		selectedLat = parseFloat(data[0].lat);
		selectedLon = parseFloat(data[0].lon);
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${selectedLat.toFixed(6)}°, ${selectedLon.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
		showResults();
	} catch (err) {
		showNotification(err.message, 'error');
	} finally {
		button.disabled = false;
		button.textContent = 'Rechercher';
	}
}

// Fonction pour afficher les résultats (inchangée)
function showResults() {
	if (!selectedLat || !selectedLon) {
		showNotification('Aucune localisation sélectionnée', 'error');
		return;
	}
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
		displayEnvMap();
		resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, 500);
}

// MODIFICATION : Remplacement de l'ancienne fonction par la logique hybride
function displayEnvMap() {
    const mapDiv = document.getElementById('env-map');
    mapDiv.style.display = 'block';
    document.getElementById('layer-controls').innerHTML = ''; // Vide le conteneur des anciens contrôles manuels

    if (!envMap) {
        envMap = L.map('env-map').setView([selectedLat, selectedLon], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors', maxZoom: 19
        }).addTo(envMap);
    } else {
        envMap.setView([selectedLat, selectedLon], 9);
        if (layerControl) {
            envMap.removeControl(layerControl);
        }
    }
    
    const wmsOverlays = {};
    Object.entries(WMS_LAYERS).forEach(([name, config]) => {
        wmsOverlays[name] = L.tileLayer.wms("/api/wms/inpn", {
            layers: config.layers,
            format: 'image/png',
            transparent: true,
            attribution: config.attribution,
            version: '1.3.0'
        });
    });

    // Utilise le contrôleur de couches natif de Leaflet
    layerControl = L.control.layers(null, wmsOverlays, { collapsed: false }).addTo(envMap);
    
    // Attache l'événement de clic à la carte
    envMap.off('click').on('click', handleMapClick);
}

// NOUVEAU : Logique de gestion du clic sur la carte
async function handleMapClick(e) {
    const { lat, lng } = e.latlng;
    const popup = L.popup().setLatLng(e.latlng).setContent('<p>Analyse des couches en cours...</p>').openOn(envMap);

    let finalContent = '<h4>Données au point cliqué</h4>';
    let resultsFound = false;

    const activeLayers = [];
    if (layerControl) {
        for(const name in layerControl._layers) {
            const layer = layerControl._layers[name];
            if (envMap.hasLayer(layer.layer)) {
                activeLayers.push(layer.name);
            }
        }
    }

    if (activeLayers.length === 0) {
        popup.setContent("<p>Aucune couche n'est activée. Cochez une ou plusieurs couches pour l'analyse.</p>");
        return;
    }

    const promises = activeLayers.map(async (layerName) => {
        const endpoint = APICARTO_ENDPOINTS[layerName];
        if (!endpoint) {
             console.log(`Pas d'API de détail pour la couche : ${layerName}`);
             return;
        }

        try {
            const url = `${endpoint}?lon=${lng}&lat=${lat}`;
            const response = await fetch(url);
            if (!response.ok) return;
            const geojsonData = await response.json();

            if (geojsonData.features.length > 0) {
                resultsFound = true;
                finalContent += `<h5>${layerName}</h5>`;
                geojsonData.features.forEach(feature => {
                    const info = getFeatureInfo(feature.properties);
                    const inpnUrl = buildInpnUrl(info, layerName);
                    finalContent += `<div class="popup-item">`;
                    if(info.name) finalContent += `<p class="site-name">${info.name}</p>`;
                    if(inpnUrl) finalContent += `<a href="${inpnUrl}" target="_blank" class="site-link">Voulez-vous ouvrir la page ?</a>`;
                    else finalContent += `<p class="no-link">Pas de page de détail disponible.</p>`;
                    finalContent += `</div>`;
                });
            }
        } catch (error) { console.error(`Erreur API pour ${layerName}:`, error); }
    });

    await Promise.all(promises);
    popup.setContent(resultsFound ? finalContent : "<p>Aucune donnée de zone protégée trouvée ici pour les couches actives.</p>");
}

// NOUVEAU : Fonctions utilitaires pour les popups
function getFeatureInfo(properties) {
    const nameKeys = ['nom_site', 'nom', 'libelle', 'site_name'];
    const idKeys = ['id_site', 'id_inspire', 'inpn_id', 'id'];
    let name = 'Non spécifié';
    let id = null;

    for (const key of nameKeys) {
        if (properties[key]) { name = properties[key]; break; }
    }
    for (const key of idKeys) {
        if (properties[key]) { id = properties[key]; break; }
    }
    return { name, id };
}

function buildInpnUrl(info, layerName) {
    if (!info.id) return null;
    const ln = layerName.toLowerCase();
    
    if (ln.includes('natura')) return `https://inpn.mnhn.fr/site/natura2000/${info.id}`;
    if (ln.includes('znieff')) return `https://inpn.mnhn.fr/zone/znieff/${info.id}`;
    if (ln.includes('réserve') || ln.includes('parc') || ln.includes('biotope')) return `https://inpn.mnhn.fr/espace/protege/${info.id}`;
    
    return null;
}

// Fonction de notification (inchangée)
function showNotification(message, type = 'info') {
	console.log(`Notification (${type}): ${message}`);
	alert(message); 
}

// Gestionnaire de page (inchangé)
window.addEventListener('pageshow', (event) => {
	if (event.persisted) {
		document.getElementById('use-geolocation').disabled = false;
		document.getElementById('use-geolocation').textContent = 'Utiliser ma localisation';
	}
});
