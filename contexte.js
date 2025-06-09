/* ================================================================
   CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
   Adaptation du script Python pour une utilisation web
   ================================================================ */

// Variables globales
let map = null;
let marker = null;
let selectedLat = null;
let selectedLon = null;

// Configuration des services
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
  // Bouton géolocalisation
  document.getElementById('use-geolocation').addEventListener('click', useGeolocation);
  
  // Bouton carte
  document.getElementById('choose-on-map').addEventListener('click', toggleMap);
  
  // Bouton validation
  document.getElementById('validate-location').addEventListener('click', validateLocation);

  // Bouton recherche d'adresse
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

// Fonction pour afficher/masquer la carte
function toggleMap() {
  const mapContainer = document.getElementById('map-container');
  const button = document.getElementById('choose-on-map');
  const instruction = document.getElementById('map-instruction');
  
  if (mapContainer.style.display === 'none' || !mapContainer.style.display) {
    mapContainer.style.display = 'block';
    instruction.style.display = 'block';
    button.textContent = 'Fermer la carte';
    
    // Initialiser la carte si pas encore fait
    if (!map) {
      initializeMap();
    } else {
      // Forcer le redimensionnement si la carte était cachée
      setTimeout(() => map.invalidateSize(), 100);
    }
    
    // Masquer l'instruction après 3 secondes
    setTimeout(() => {
      instruction.style.display = 'none';
    }, 3000);
  } else {
    mapContainer.style.display = 'none';
    button.textContent = 'Ouvrir la carte';
  }
}

// Initialisation de la carte Leaflet
function initializeMap() {
  // Coordonnées par défaut (Grenoble)
  const defaultLat = 45.188529;
  const defaultLon = 5.724524;
  
  // Créer la carte
  map = L.map('map').setView([defaultLat, defaultLon], 13);
  
  // Ajouter la couche de tuiles OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  
  // Gestionnaire d'événements pour le clic long
  let pressTimer;
  let isPressing = false;
  
  // Fonction pour gérer la sélection d'un point
  function selectPoint(e) {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    // Supprimer l'ancien marqueur s'il existe
    if (marker) {
      map.removeLayer(marker);
    }
    
    // Ajouter un nouveau marqueur
    marker = L.marker([lat, lon]).addTo(map);
    
    // Mettre à jour les coordonnées sélectionnées
    selectedLat = lat;
    selectedLon = lon;
    
    // Afficher les coordonnées
    document.getElementById('coordinates-display').style.display = 'block';
    document.getElementById('selected-coords').textContent = 
      `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
    
    // Afficher le bouton de validation
    document.getElementById('validate-location').style.display = 'block';
  }
  
  // Gestion du clic long (desktop)
  map.on('mousedown', (e) => {
    isPressing = true;
    pressTimer = setTimeout(() => {
      if (isPressing) {
        selectPoint(e);
      }
    }, 500); // 500ms pour un clic long
  });
  
  map.on('mouseup', () => {
    isPressing = false;
    clearTimeout(pressTimer);
  });
  
  map.on('mousemove', () => {
    if (isPressing) {
      isPressing = false;
      clearTimeout(pressTimer);
    }
  });
  
  // Gestion du touch (mobile)
  map.on('touchstart', (e) => {
    isPressing = true;
    pressTimer = setTimeout(() => {
      if (isPressing) {
        selectPoint(e);
      }
    }, 500);
  });
  
  map.on('touchend', () => {
    isPressing = false;
    clearTimeout(pressTimer);
  });
  
  map.on('touchmove', () => {
    if (isPressing) {
      isPressing = false;
      clearTimeout(pressTimer);
    }
  });
  
  // Empêcher le comportement par défaut du clic droit
  map.on('contextmenu', (e) => {
    e.originalEvent.preventDefault();
    selectPoint(e);
  });
}

// Fonction pour valider la localisation sélectionnée
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

// Fonction pour afficher les résultats
function showResults() {
  if (!selectedLat || !selectedLon) {
    showNotification('Aucune localisation sélectionnée', 'error');
    return;
  }
  
  // Afficher le chargement
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  loading.textContent = 'Préparation des liens...';
  
  // Simuler un court délai
  setTimeout(() => {
    loading.style.display = 'none';
    
    // Afficher la section des résultats
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = 'block';
    
    // Générer les cartes de résultats
    const resultsGrid = document.getElementById('results-grid');
    resultsGrid.innerHTML = '';
    
    Object.keys(SERVICES).forEach(serviceKey => {
      const service = SERVICES[serviceKey];
      const url = service.buildUrl(selectedLat, selectedLon);
      
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <h3>${service.name}</h3>
        <p>${service.description}</p>
        <a href="${url}" target="_blank" rel="noopener noreferrer">
          Ouvrir dans un nouvel onglet →
        </a>
      `;
      
      resultsGrid.appendChild(card);
    });
    
    // Faire défiler jusqu'aux résultats
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 500);
}

// Gestionnaire pour le retour à la page d'accueil
window.addEventListener('pageshow', (event) => {
  // Réinitialiser l'état si on revient sur la page
  if (event.persisted) {
    document.getElementById('use-geolocation').disabled = false;
    document.getElementById('use-geolocation').textContent = 'Utiliser ma localisation';
  }
});
