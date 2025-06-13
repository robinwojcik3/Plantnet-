/* ================================================================
      CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
      Refonte pour utiliser un service WMS pour l'affichage des couches
      ================================================================ */

// Variables globales
let map = null; // Carte pour la sélection du point
let envMap = null; // Carte pour l'affichage des résultats
let layerControl = null; // Contrôleur de couches pour la carte de résultats
let envMarker = null; // Marqueur du point analysé
let marker = null;
let selectedLat = null;
let selectedLon = null;

// Configuration des services externes (liens)
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

// NOUVEAU : Configuration des couches WMS via le proxy local
const WMS_LAYERS = {
    'Natura 2000': {
        layerName: 'PROTECTEDAREAS.SIC,PROTECTEDAREAS.ZPS',
        attribution: 'IGN-F/Geoportail'
    },
    'ZNIEFF I & II': {
        layerName: 'PROTECTEDAREAS.ZNIEFF1,PROTECTEDAREAS.ZNIEFF2',
        attribution: 'IGN-F/Geoportail'
    },
    'Parcs Nationaux': {
        layerName: 'PROTECTEDAREAS.PN',
        attribution: 'IGN-F/Geoportail'
    },
    'Réserves Naturelles (Nationales & Régionales)': {
        layerName: 'PROTECTEDAREAS.RNN,PROTECTEDAREAS.RNR',
        attribution: 'IGN-F/Geoportail'
    }
};


// Utilitaires de conversion
function latLonToWebMercator(lat, lon) {
	const R = 6378137.0;
	const x = R * (lon * Math.PI / 180);
	const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
	return { x, y };
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
	document.getElementById('use-geolocation').addEventListener('click', useGeolocation);
	document.getElementById('choose-on-map').addEventListener('click', toggleMap);
	document.getElementById('validate-location').addEventListener('click', validateLocation);
	document.getElementById('search-address').addEventListener('click', searchAddress);
	document.getElementById('address-input').addEventListener('keydown', (e) => {
		if (e.key === 'Enter') searchAddress();
	});
});

// Fonction pour utiliser la géolocalisation
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
				case error.PERMISSION_DENIED:
					message = 'Vous avez refusé l\'accès à votre position';
					break;
				case error.POSITION_UNAVAILABLE:
					message = 'Position indisponible';
					break;
				case error.TIMEOUT:
					message = 'La demande de position a expiré';
					break;
			}
			showNotification(message, 'error');
			button.disabled = false;
			button.textContent = 'Utiliser ma localisation';
		},
		{
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 0
		}
	);
}

// Fonction pour afficher/masquer la carte de sélection
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
		setTimeout(() => {
			instruction.style.display = 'none';
		}, 3000);
	} else {
		mapContainer.style.display = 'none';
		button.textContent = 'Ouvrir la carte';
	}
}

// Initialisation de la carte de sélection Leaflet
function initializeMap() {
	const defaultLat = 45.188529;
	const defaultLon = 5.724524;
	map = L.map('map').setView([defaultLat, defaultLon], 13);
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© OpenStreetMap contributors',
		maxZoom: 19
	}).addTo(map);
	
	let pressTimer;
	let isPressing = false;
	
	function selectPoint(e) {
		const lat = e.latlng.lat;
		const lon = e.latlng.lng;
		if (marker) map.removeLayer(marker);
		marker = L.marker([lat, lon]).addTo(map);
		selectedLat = lat;
		selectedLon = lon;
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
	}
	
	map.on('mousedown', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('mouseup', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('mousemove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('touchstart', (e) => { isPressing = true; pressTimer = setTimeout(() => { if (isPressing) selectPoint(e); }, 500); });
	map.on('touchend', () => { isPressing = false; clearTimeout(pressTimer); });
	map.on('touchmove', () => { if (isPressing) { isPressing = false; clearTimeout(pressTimer); }});
	map.on('contextmenu', (e) => { e.originalEvent.preventDefault(); selectPoint(e); });
}

// Fonction pour valider la localisation sélectionnée sur la carte
function validateLocation() {
	if (selectedLat && selectedLon) {
		showResults();
	}
}

// Fonction pour rechercher une adresse
async function searchAddress() {
	const input = document.getElementById('address-input');
	const address = input.value.trim();
	if (!address) {
		showNotification('Veuillez entrer une adresse', 'error');
		return;
	}

	const button = document.getElementById('search-address');
	button.disabled = true;
	button.textContent = 'Recherche en cours...';

	try {
		const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
		if (!resp.ok) throw new Error('Service indisponible');
		const data = await resp.json();
		if (!data.length) {
			showNotification('Adresse introuvable', 'error');
			return;
		}
		selectedLat = parseFloat(data[0].lat);
		selectedLon = parseFloat(data[0].lon);
		document.getElementById('coordinates-display').style.display = 'block';
		document.getElementById('selected-coords').textContent = `${selectedLat.toFixed(6)}°, ${selectedLon.toFixed(6)}°`;
		document.getElementById('validate-location').style.display = 'block';
		showResults();
	} catch (err) {
		showNotification('Erreur pendant la recherche', 'error');
	} finally {
		button.disabled = false;
		button.textContent = 'Rechercher';
	}
}

// Fonction principale pour afficher les résultats
function showResults() {
	if (!selectedLat || !selectedLon) {
		showNotification('Aucune localisation sélectionnée', 'error');
		return;
	}
	
	const loading = document.getElementById('loading');
	loading.style.display = 'block';
	
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

		displayInteractiveEnvMap();
		resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, 500);
}

/**
 * MODIFIÉ : Affiche la carte interactive avec les couches WMS.
 */
function displayInteractiveEnvMap() {
    const mapDiv = document.getElementById('env-map');
    const controlsDiv = document.getElementById('layer-controls');
    mapDiv.style.display = 'block';
    controlsDiv.style.display = 'block'; // Afficher le conteneur des contrôles

    // Initialisation ou réinitialisation de la carte
    if (!envMap) {
        envMap = L.map('env-map').setView([selectedLat, selectedLon], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(envMap);
    } else {
        envMap.setView([selectedLat, selectedLon], 11);
        if (layerControl) {
            envMap.removeControl(layerControl);
        }
        envMap.eachLayer(layer => {
            // Ne pas supprimer le fond de carte (tileLayer)
            if (!(layer instanceof L.TileLayer)) {
                envMap.removeLayer(layer);
            }
        });
    }

    // Ajoute un marqueur pour le point analysé
    if (envMarker) envMap.removeLayer(envMarker);
    envMarker = L.marker([selectedLat, selectedLon]).addTo(envMap)
      .bindPopup("Point d'analyse").openPopup();

    const overlayMaps = {};
    Object.entries(WMS_LAYERS).forEach(([name, config]) => {
        const wmsLayer = L.tileLayer.wms('/api/wms/inpn', {
            layers: config.layerName,
            format: 'image/png',
            transparent: true,
            attribution: config.attribution
        });
        overlayMaps[name] = wmsLayer;
    });

    layerControl = L.control.layers(null, overlayMaps, { collapsed: false }).addTo(envMap);
    controlsDiv.innerHTML = ''; // Vider les anciens contrôles
    controlsDiv.appendChild(layerControl.getContainer());

    // Ajout de la gestion de l'événement de clic pour GetFeatureInfo
    envMap.on('click', handleMapClick);
}

/**
 * NOUVEAU : Gère le clic sur la carte pour effectuer une requête GetFeatureInfo.
 * @param {L.LeafletMouseEvent} e - L'événement de clic de Leaflet.
 */
function handleMapClick(e) {
    const latlng = e.latlng;
    const popup = L.popup()
        .setLatLng(latlng)
        .setContent('<p>Chargement des informations...</p>')
        .openOn(envMap);

    const activeLayers = [];
    layerControl._layers.forEach(layer => {
        if (envMap.hasLayer(layer.layer)) {
            activeLayers.push(layer.layer.wmsParams.layers);
        }
    });

    if (activeLayers.length === 0) {
        popup.setContent("<p>Aucune couche n'est active.</p>");
        return;
    }

    const url = getFeatureInfoUrl(e, activeLayers.join(','));

    fetch(url)
        .then(response => response.text())
        .then(html => {
            // La réponse du Géoportail est souvent une page HTML complète.
            // On cherche la partie pertinente (souvent dans <body>).
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const content = bodyMatch && bodyMatch[1].trim() ? bodyMatch[1] : "Aucune information trouvée pour ce point.";
            popup.setContent(content);
        })
        .catch(err => {
            console.error("Erreur GetFeatureInfo:", err);
            popup.setContent("<p>Erreur lors de la récupération des informations.</p>");
        });
}

/**
 * NOUVEAU : Construit l'URL pour une requête GetFeatureInfo.
 * @param {L.LeafletMouseEvent} e - L'événement de clic de Leaflet.
 * @param {string} layers - La chaîne des couches à interroger.
 * @returns {string} L'URL complète pour la requête.
 */
function getFeatureInfoUrl(e, layers) {
    const map = e.target;
    const point = map.latLngToContainerPoint(e.latlng, map.getZoom());
    const size = map.getSize();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const params = {
        request: 'GetFeatureInfo',
        service: 'WMS',
        version: '1.1.1',
        layers: layers,
        styles: '',
        bbox: `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`,
        width: size.x,
        height: size.y,
        query_layers: layers,
        info_format: 'text/html',
        srs: 'EPSG:4326',
        x: Math.round(point.x),
        y: Math.round(point.y)
    };

    const url = '/api/wms/inpn' + L.Util.getParamString(params, '', true);
    return url;
}

// Fonction de notification générique
function showNotification(message, type = 'info') {
	console.log(`Notification (${type}): ${message}`);
	// Remplacer alert par une notification non-bloquante si ui.js est disponible
    if(window.showUINotification) {
        window.showUINotification(message, type);
    } else {
	    alert(message); 
    }
}

// Gestionnaire pour le retour à la page d'accueil
window.addEventListener('pageshow', (event) => {
	if (event.persisted) {
		document.getElementById('use-geolocation').disabled = false;
		document.getElementById('use-geolocation').textContent = 'Utiliser ma localisation';
	}
});
