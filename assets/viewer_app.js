import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration du worker
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;
} catch (e) {
    console.error('Erreur de configuration du worker PDF.js:', e);
}

const viewerContainer = document.getElementById('pdf-viewer');

/**
 * Affiche un message d'erreur et un lien de secours pour ouvrir le PDF.
 * @param {string} title - Le titre de l'erreur.
 * @param {string} message - Le message d'erreur.
 * @param {string} pdfUrl - L'URL du fichier PDF.
 * @param {number} pageNum - Le numéro de la page cible.
 */
function displayFallback(title, message, pdfUrl, pageNum) {
    viewerContainer.innerHTML = `
        <div class="error-message">
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Page cible : ${pageNum}</p>
            <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer">
                Ouvrir le PDF directement (recherchez la page ${pageNum})
            </a>
        </div>
    `;
}

/**
 * Rend une page spécifique du PDF sur son canvas dédié.
 * @param {PDFDocumentProxy} pdfDoc - L'objet document PDF chargé.
 * @param {number} num - Le numéro de la page à rendre.
 * @param {HTMLCanvasElement} canvas - Le canvas sur lequel dessiner la page.
 */
async function renderPage(pdfDoc, num, canvas) {
    try {
        const page = await pdfDoc.getPage(num);
        
        // Utiliser une échelle haute résolution pour une meilleure qualité
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const baseScale = isIOS ? 1.8 : 2.0;
        const finalScale = (window.devicePixelRatio || 1) * baseScale;

        const viewport = page.getViewport({ scale: finalScale });

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;
    } catch (error) {
        console.error(`Erreur lors du rendu de la page ${num}:`, error);
        // On pourrait afficher un message d'erreur sur le canvas de la page
    }
}

/**
 * Fonction principale qui charge le PDF et initialise le visualiseur.
 */
async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1;

    if (!pdfUrl) {
        viewerContainer.innerHTML = '<div class="error-message"><h1>Erreur : Aucun fichier PDF spécifié.</h1></div>';
        return;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        // Boucle pour créer un conteneur et un canvas pour chaque page
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const pageContainer = document.createElement('div');
            pageContainer.id = `page-container-${pageNum}`;
            pageContainer.className = 'page-container';

            const canvas = document.createElement('canvas');
            pageContainer.appendChild(canvas);
            viewerContainer.appendChild(pageContainer);

            // Lancer le rendu de la page (sans attendre la fin)
            renderPage(pdfDoc, pageNum, canvas);
        }

        // Ancrage : faire défiler jusqu'à la page cible
        // On utilise setTimeout pour s'assurer que le DOM est bien mis à jour avant de scroller
        setTimeout(() => {
            const targetElement = document.getElementById(`page-container-${initialPage}`);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }, 0);

    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        displayFallback(
            'Erreur de chargement',
            'Impossible de charger le lecteur PDF intégré.',
            pdfUrl,
            initialPage
        );
    }
}

// Lancement de l'application
loadPdfViewer();
