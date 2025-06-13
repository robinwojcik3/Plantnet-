// Fichier : netlify/functions/inpn-proxy.js

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // L'URL cible du service WMS de l'INPN (version "fxx_inpn")
  const TARGET_URL = 'https://inpn.mnhn.fr/webgeoservice/WMS/fxx_inpn';

  // Construit l'URL complète en ajoutant les paramètres de la requête originale
  // event.rawQuery contient tous les paramètres comme "service=WMS&request=GetTile..."
  const fullUrl = `${TARGET_URL}?${event.rawQuery}`;

  try {
    const response = await fetch(fullUrl);
    const data = await response.buffer(); // Les tuiles WMS sont des images, on utilise buffer()

    // Important : On doit retourner la réponse avec les bons en-têtes (headers)
    // pour que le navigateur comprenne qu'il reçoit une image.
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type'),
        'Content-Length': data.length.toString(),
      },
      body: data.toString('base64'), // Le corps de la réponse doit être encodé en base64
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Erreur dans la fonction proxy:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur lors de la communication avec le service INPN.' }),
    };
  }
};
