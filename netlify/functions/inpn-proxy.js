// Fichier : netlify/functions/inpn-proxy.js

const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

exports.handler = async function(event, context) {
    console.log('--- Fonction Proxy INPN Déclenchée ---');
    const params = event.queryStringParameters || {};

    // =================================================================
    // NOUVELLE LOGIQUE DE ROUTAGE
    // Distingue les requêtes WMS des autres requêtes basées sur les paramètres.
    // =================================================================

    // --- Mode 1: Proxy pour les requêtes WMS de la carte environnementale ---
    if (params.service && params.service.toUpperCase() === 'WMS') {
        const TARGET_URL = 'https://inpn.mnhn.fr/webgeoservice/WMS/fxx_inpn';
        const fullUrl = `${TARGET_URL}?${event.rawQuery}`;

        console.log(`[WMS Mode] URL cible construite : ${fullUrl}`);

        try {
            // Ajout d'un User-Agent pour simuler une requête de navigateur classique
            const userAgent = event.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36';
            
            const response = await fetch(fullUrl, {
                headers: { 'User-Agent': userAgent }
            });

            console.log(`[WMS Mode] Réponse de l'INPN - Statut : ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WMS Mode] Erreur de l'INPN : ${errorText}`);
                return { statusCode: response.status, body: errorText };
            }

            const contentType = response.headers.get('content-type');
            console.log(`[WMS Mode] Type de contenu reçu : ${contentType}`);

            const data = await response.buffer();

            // Retourne l'image en base64, ce qui est requis par Netlify/AWS Lambda
            return {
                statusCode: 200,
                headers: { 'Content-Type': contentType },
                body: data.toString('base64'),
                isBase64Encoded: true,
            };
        } catch (error) {
            console.error('[WMS Mode] Erreur majeure dans la fonction proxy:', error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy WMS.' }) };
        }
    }

    // --- Mode 2: Extraction de fragment HTML (pour d'autres fonctionnalités de l'app) ---
    const { cd, type, q } = params;
    if (type) {
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

        console.log(`[Fragment Mode] Fetching fragment URL : ${url}`);
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

            if (!fragment) return { statusCode: 404, body: 'Fragment not found in source page.' };
            return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: fragment };
        } catch (err) {
            console.error('[Fragment Mode] Erreur lors de la récupération du fragment:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy de fragment.' }) };
        }
    }

    // --- Cas par défaut: la requête est invalide ---
    return { 
        statusCode: 400, 
        body: 'Paramètres de requête invalides. Le paramètre "service=WMS" ou "type" est manquant.' 
    };
};
