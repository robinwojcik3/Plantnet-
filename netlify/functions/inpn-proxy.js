// Fichier : netlify/functions/inpn-proxy.js

const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

exports.handler = async function(event, context) {
  console.log('--- Fonction Proxy INPN Déclenchée ---');

  const params = event.queryStringParameters || {};

  // Mode WMS : utilisé pour la carte environnementale
  if (event.rawQuery) {
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
      return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy.' }) };
    }
  }

  // Mode extraction de fragment HTML (carte, statut, openobs)
  const { cd, type, q } = params;
  if (!type) {
    return { statusCode: 400, body: 'Missing type parameter' };
  }

  let url;
  if (type === 'carte' || type === 'statut') {
    if (!cd) return { statusCode: 400, body: 'Missing cd parameter' };
    url = `https://inpn.mnhn.fr/espece/cd_nom/${cd}/tab/${type}`;
  } else if (type === 'openobs') {
    if (!q) return { statusCode: 400, body: 'Missing q parameter' };
    url = `https://openobs.mnhn.fr/openobs-hub/occurrences/search?q=${encodeURIComponent(q)}#tab_mapView`;
  } else {
    return { statusCode: 400, body: 'Unsupported type' };
  }

  console.log(`Fetching fragment URL : ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const txt = await response.text();
      return { statusCode: response.status, body: txt };
    }
    const html = await response.text();

    let fragment = null;
    if (type === 'carte' || type === 'openobs') {
      const m = html.match(/<canvas[^>]*class="[^"]*ol-unselectable[^"]*"[^>]*><\/canvas>/i);
      if (m) fragment = m[0];
    } else if (type === 'statut') {
      const m = html.match(/<div[^>]*class="[^"]*statut[^"]*"[^>]*>[\s\S]*?<\/div>/i);
      if (m) fragment = m[0];
    }

    if (!fragment) return { statusCode: 404 };
    return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: fragment };
  } catch (err) {
    console.error('Erreur lors de la récupération du fragment:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy.' }) };
  }
};
