// Fichier : netlify/functions/inpn-proxy.js

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  console.log('--- Fonction Proxy INPN Déclenchée ---');

  const TARGET_URL = 'https://inpn.mnhn.fr/webgeoservice/WMS/fxx_inpn';
  const fullUrl = `${TARGET_URL}?${event.rawQuery}`;
  
  console.log(`URL cible construite : ${fullUrl}`);

  try {
    const response = await fetch(fullUrl);
    console.log(`Réponse de l'INPN - Statut : ${response.status}`);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erreur de l'INPN : ${errorText}`);
        return { statusCode: response.status, body: errorText };
    }

    const contentType = response.headers.get('content-type');
    console.log(`Type de contenu reçu : ${contentType}`);
    
    const data = await response.buffer();

    return {
      statusCode: 200,
      headers: { 'Content-Type': contentType },
      body: data.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Erreur majeure dans la fonction proxy:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur interne du proxy.' }),
    };
  }
};
