import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const prevBtn = document.getElementById('prev-page-btn');
const nextBtn = document.getElementById('next-page-btn');
const currentPageNumSpan = document.getElementById('current-page-num');
const totalPageNumSpan = document.getElementById('total-page-num');

let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let isRendering = false; // Verrou pour éviter les rendus multiples simultanés

/**
 * Affiche une page spécifique du PDF sur le canvas avec une haute résolution.
 * @param {number} num - Le numéro de la page à afficher.
 */
async function renderPage(num) {
    if (!pdfDoc || isRendering) return;
    
    isRendering = true;
    currentPageNum = Math.max(1, Math.min(totalPages, num));

    try {
        const page = await pdfDoc.getPage(currentPageNum);
        
        // --- DÉBUT DE LA MODIFICATION POUR LA QUALITÉ ---
        
        // 1. Définir une échelle de base pour une bonne qualité
        const baseScale = 2.0; 
        
        // 2. Tenir compte de la densité de pixels de l'écran (ex: écrans Retina)
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        // 3. Calculer l'échelle finale pour un rendu net
        const finalScale = baseScale * devicePixelRatio;
        
        const viewport = page.getViewport({ scale: finalScale });
        
        // 4. Définir la résolution réelle du canvas (en pixels physiques)
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Le CSS s'occupera de redimensionner l'affichage du canvas à la bonne taille,
        // ce qui produira une image nette et non pixélisée.

        // --- FIN DE LA MODIFICATION POUR LA QUALITÉ ---

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        currentPageNumSpan.textContent = currentPageNum;
        prevBtn.disabled = (currentPageNum <= 1);
        nextBtn.disabled = (currentPageNum >= totalPages);

    } catch (error) {
        console.error('Erreur lors du rendu de la page:', error);
    } finally {
        isRendering = false;
    }
}

prevBtn.addEventListener('click', () => {
    if (currentPageNum > 1) {
        renderPage(currentPageNum - 1);
    }
});

nextBtn.addEventListener('click', () => {
    if (currentPageNum < totalPages) {
        renderPage(currentPageNum + 1);
    }
});

async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1;

    if (!pdfUrl) {
        document.body.innerHTML = '<h1>Erreur : Aucun fichier PDF spécifié.</h1>';
        return;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;
        
        totalPages = pdfDoc.numPages;
        totalPageNumSpan.textContent = totalPages;

        renderPage(initialPage);
    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        document.body.innerHTML = `<h1>Erreur de chargement du PDF</h1><p>${error.message}</p>`;
    }
}

loadPdfViewer();
