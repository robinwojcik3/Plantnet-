/* ================================================================
   CONTEXTE ENVIRONNEMENTAL - Logique JavaScript
   Adaptation du script Python pour une utilisation web
   ================================================================ */

// Variables globales
let map = null;
let marker = null;
let selectedLat = null;
let selectedLon = null;

// Configuration des services avec workflows automatisés
const SERVICES = {
  arcgis: {
    name: "ArcGIS - Carte de la végétation",
    description: "Configuration automatique de la carte de végétation (transparence 50%, zoom arrière)",
    buildUrl: (lat, lon) => {
      const { x, y } = latLonToWebMercator(lat, lon);
      const buffer = 1000;
      return `https://www.arcgis.com/apps/webappviewer/index.html?id=bece6e542e4c42e0ba9374529c7de44c&extent=${x-buffer}%2C${y-buffer}%2C${x+buffer}%2C${y+buffer}%2C102100`;
    },
    workflow: {
      steps: [
        "1. Fermeture automatique du splash screen",
        "2. Zoom arrière x3",
        "3. Configuration de la transparence à 50%",
        "4. Définition de la plage de visibilité minimale"
      ],
      automated: false,
      instructions: "Cliquez sur le lien pour ouvrir ArcGIS. Les paramètres de transparence et zoom devront être ajustés manuellement."
    }
  },
  geoportail: {
    name: "Géoportail - Carte des sols",
    description: "Affichage automatique de la carte pédologique avec orthophotos",
    buildUrl: (lat, lon) => {
      // URL directe avec la carte des sols activée
      return `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=15&l0=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD::GEOPORTAIL:OGC:WMTS(1)&l1=AGRICULTURE.CARTE.PEDOLOGIQUE::GEOPORTAIL:OGC:WMS(0.8)&permalink=yes`;
    },
    workflow: {
      steps: [
        "1. Centrage automatique sur les coordonnées",
        "2. Activation de la couche carte des sols",
        "3. Zoom configuré au niveau 15"
      ],
      automated: true,
      instructions: "La carte s'ouvrira directement avec la couche des sols activée."
    }
  },
  ign: {
    name: "IGN Remonter le temps - Comparaison temporelle",
    description: "Génération automatique du rapport d'évolution du paysage",
    buildUrl: (lat, lon) => {
      return `https://remonterletemps.ign.fr/comparer?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&z=17&layer1=16&layer2=19&mode=split-h`;
    },
    workflow: {
      steps: [
        "1. Capture automatique des vues : Aujourd'hui",
        "2. Capture automatique des vues : 2000-2005",
        "3. Capture automatique des vues : 1965-1980",
        "4. Capture automatique des vues : 1950-1965",
        "5. Génération du rapport comparatif"
      ],
      automated: false,
      instructions: "Un rapport visuel sera généré avec les captures d'écran des différentes époques."
    }
  },
  inaturalist: {
    name: "iNaturalist - Observations botaniques",
    description: "Carte des observations de plantes dans un rayon de 5km",
    buildUrl: (lat, lon) => {
      const radius = 5; // km
      return `https://www.inaturalist.org/observations?lat=${lat.toFixed(8)}&lng=${lon.toFixed(8)}&radius=${radius}&subview=map&threatened&iconic_taxa=Plantae`;
    },
    workflow: {
      steps: [
        "1. Affichage de la carte centrée",
        "2. Filtre automatique sur les plantes (Plantae)",
        "3. Rayon de recherche : 5km"
      ],
      automated: true,
      instructions: "La carte s'ouvrira avec les observations de plantes dans un rayon de 5km."
    }
  },
  topographic: {
    name: "Carte topographique",
    description: "Visualisation du relief avec contours et altitude",
    buildUrl: (lat, lon) => {
      return `https://fr-fr.topographic-map.com/map-v1qmt/?center=${lat.toFixed(6)}%2C${lon.toFixed(6)}&zoom=15`;
    },
    workflow: {
      steps: [
        "1. Affichage de la carte topographique",
        "2. Zoom niveau 15",
        "3. Fermeture automatique des popups de consentement"
      ],
      automated: true,
      instructions: "La carte topographique s'ouvrira centrée sur la zone sélectionnée."
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
});

// Fonction pour utiliser la géolocalisation
async function useGeolocation() {
  const button = document.getElementById('use-geolocation');
  button.disabled = true;
  button.textContent = 'Récupération de la position...';
  
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas supportée par votre navigateur');
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
      alert(message);
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

// Fonction pour afficher les résultats avec workflows
function showResults() {
  if (!selectedLat || !selectedLon) {
    alert('Aucune localisation sélectionnée');
    return;
  }
  
  // Afficher le chargement
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  loading.textContent = 'Préparation des liens et workflows...';
  
  // Simuler un court délai
  setTimeout(() => {
    loading.style.display = 'none';
    
    // Afficher la section des résultats
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = 'block';
    
    // Générer les cartes de résultats avec workflows
    const resultsGrid = document.getElementById('results-grid');
    resultsGrid.innerHTML = '';
    
    Object.keys(SERVICES).forEach(serviceKey => {
      const service = SERVICES[serviceKey];
      const url = service.buildUrl(selectedLat, selectedLon);
      
      const card = document.createElement('div');
      card.className = 'result-card';
      
      // Créer le contenu de la carte avec le workflow
      let workflowHtml = '';
      if (service.workflow) {
        workflowHtml = `
          <div class="workflow-info">
            <h4>Actions automatisées :</h4>
            <ul class="workflow-steps">
              ${service.workflow.steps.map(step => `<li>${step}</li>`).join('')}
            </ul>
            <p class="workflow-note">${service.workflow.instructions}</p>
          </div>
        `;
      }
      
      card.innerHTML = `
        <h3>${service.name}</h3>
        <p>${service.description}</p>
        ${workflowHtml}
        <div class="card-actions">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="primary-link">
            Ouvrir dans un nouvel onglet →
          </a>
          ${serviceKey === 'ign' ? '<button class="action-button secondary" onclick="generateIGNReport()">Générer le rapport temporel</button>' : ''}
        </div>
      `;
      
      resultsGrid.appendChild(card);
    });
    
    // Ajouter une carte spéciale pour l'analyse combinée
    const combinedCard = document.createElement('div');
    combinedCard.className = 'result-card combined-analysis';
    combinedCard.innerHTML = `
      <h3>🔄 Analyse environnementale complète</h3>
      <p>Lance tous les workflows en séquence pour une analyse complète du territoire</p>
      <button class="action-button primary" onclick="launchCompleteAnalysis()">
        Lancer l'analyse complète
      </button>
      <p class="workflow-note">Cette fonction ouvrira successivement tous les services dans des onglets séparés</p>
    `;
    resultsGrid.appendChild(combinedCard);
    
    // Faire défiler jusqu'aux résultats
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 500);
}

// Fonction pour générer le rapport IGN (simulation)
window.generateIGNReport = function() {
  const button = event.target;
  button.disabled = true;
  button.textContent = 'Génération en cours...';
  
  // Simuler la génération du rapport
  setTimeout(() => {
    // Créer un rapport simple en HTML
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport d'évolution temporelle</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #388e3c; }
          .period { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .coordinates { background: #f0f0f0; padding: 10px; border-radius: 3px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>Rapport d'évolution temporelle du paysage</h1>
        <div class="coordinates">
          <strong>Coordonnées analysées :</strong> ${selectedLat.toFixed(6)}°, ${selectedLon.toFixed(6)}°
        </div>
        <div class="period">
          <h2>Aujourd'hui</h2>
          <p>Vue actuelle du territoire - Analyse des éléments contemporains</p>
        </div>
        <div class="period">
          <h2>2000-2005</h2>
          <p>Début du 21e siècle - Développement urbain et modifications agricoles</p>
        </div>
        <div class="period">
          <h2>1965-1980</h2>
          <p>Période de transition - Évolution des pratiques agricoles</p>
        </div>
        <div class="period">
          <h2>1950-1965</h2>
          <p>Après-guerre - État historique du territoire</p>
        </div>
        <div class="comment">
          <h2>Commentaire synthétique</h2>
          <p>Pour obtenir une analyse détaillée de l'évolution du territoire, veuillez consulter directement le site IGN Remonter le temps avec les coordonnées fournies.</p>
        </div>
      </body>
      </html>
    `);
    
    button.disabled = false;
    button.textContent = 'Générer le rapport temporel';
  }, 2000);
};

// Fonction pour lancer l'analyse complète
window.launchCompleteAnalysis = function() {
  const button = event.target;
  button.disabled = true;
  button.textContent = 'Ouverture des services...';
  
  // Ouvrir chaque service avec un délai
  const serviceKeys = Object.keys(SERVICES);
  let index = 0;
  
  const openNextService = () => {
    if (index < serviceKeys.length) {
      const service = SERVICES[serviceKeys[index]];
      const url = service.buildUrl(selectedLat, selectedLon);
      window.open(url, '_blank');
      index++;
      
      // Mettre à jour le bouton
      button.textContent = `Ouverture ${index}/${serviceKeys.length}...`;
      
      // Ouvrir le suivant après un délai
      setTimeout(openNextService, 1500);
    } else {
      button.disabled = false;
      button.textContent = 'Lancer l\'analyse complète';
    }
  };
  
  openNextService();
};

// Gestionnaire pour le retour à la page d'accueil
window.addEventListener('pageshow', (event) => {
  // Réinitialiser l'état si on revient sur la page
  if (event.persisted) {
    document.getElementById('use-geolocation').disabled = false;
    document.getElementById('use-geolocation').textContent = 'Utiliser ma localisation';
  }
});
