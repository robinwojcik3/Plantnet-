import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration du worker
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;
} catch (e) {
    console.error('Erreur de configuration du worker PDF.js:', e);
}

const viewerContainer = document.getElementById('pdf-viewer');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
// Définir une échelle de rendu de base
const RENDER_SCALE = isIOS ? 1.8 : 2.0;

/**
 * Affiche un message d'erreur et un lien de secours.
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
 * Rend une page PDF sur son canvas. Appelée par l'IntersectionObserver.
 * @param {PDFPageProxy} page - L'objet page PDF.
 * @param {HTMLCanvasElement} canvas - Le canvas de destination.
 */
async function renderPageOnCanvas(page, canvas) {
    try {
        const finalScale = (window.devicePixelRatio || 1) * RENDER_SCALE;
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
        console.error(`Erreur lors du rendu de la page ${page.pageNumber}:`, error);
    }
}

/**
 * Fonction principale qui initialise le visualiseur.
 */
async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPageNum = parseInt(urlParams.get('page'), 10) || 1;

    if (!pdfUrl) {
        viewerContainer.innerHTML = '<div class="error-message"><h1>Erreur : Aucun fichier PDF spécifié.</h1></div>';
        return;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        // Configuration de l'IntersectionObserver pour le lazy loading
        const observer = new IntersectionObserver(async (entries, self) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const pageContainer = entry.target;
                    const pageNum = parseInt(pageContainer.dataset.pageNum, 10);
                    
                    // Cesser d'observer cet élément pour éviter les rendus multiples
                    self.unobserve(pageContainer);

                    // Créer le canvas et lancer le rendu
                    const canvas = document.createElement('canvas');
                    pageContainer.appendChild(canvas);
                    
                    const page = await pdfDoc.getPage(pageNum);
                    renderPageOnCanvas(page, canvas);
                }
            }
        }, { rootMargin: '200px' }); // rootMargin pré-charge les pages un peu avant qu'elles n'arrivent à l'écran

        // Étape 1: Créer des placeholders pour toutes les pages
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: RENDER_SCALE * (window.devicePixelRatio || 1) });

            const pageContainer = document.createElement('div');
            pageContainer.id = `page-container-${pageNum}`;
            pageContainer.className = 'page-container';
            pageContainer.dataset.pageNum = pageNum;

            // Appliquer la taille au placeholder pour que la scrollbar soit correcte
            pageContainer.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
            pageContainer.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

            viewerContainer.appendChild(pageContainer);
            observer.observe(pageContainer); // Commencer à observer le placeholder
        }

        // Étape 2: Sauter à la page cible
        const targetElement = document.getElementById(`page-container-${initialPageNum}`);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
        }

    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        displayFallback('Erreur de chargement', 'Impossible de charger le lecteur PDF.', pdfUrl, initialPageNum);
    }
}

// Lancement de l'application
loadPdfViewer();
