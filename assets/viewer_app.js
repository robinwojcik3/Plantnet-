import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;

function supportsModuleWorker() {
    try {
        const worker = new Worker(URL.createObjectURL(new Blob([''], {type:'text/javascript'})), {type:'module'});
        worker.terminate();
        return true;
    } catch (e) {
        return false;
    }
}

// Récupération des éléments du DOM
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const prevBtn = document.getElementById('prev-page-btn');
const nextBtn = document.getElementById('next-page-btn');
const currentPageNumSpan = document.getElementById('current-page-num');
const totalPageNumSpan = document.getElementById('total-page-num');

// Variables pour garder l'état du PDF
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let isRendering = false;

/**
 * Affiche une page spécifique du PDF sur le canvas avec une haute résolution.
 * @param {number} num - Le numéro de la page à afficher.
 */
async function renderPage(num) {
    if (!pdfDoc) return;
    currentPageNum = Math.max(1, Math.min(totalPages, num));

    try {
        const page = await pdfDoc.getPage(currentPageNum);
        
        const baseScale = 2.0; 
        const devicePixelRatio = window.devicePixelRatio || 1;
        const finalScale = baseScale * devicePixelRatio;
        
        const viewport = page.getViewport({ scale: finalScale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

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
    }
}

/**
 * Fonctions de navigation avec animation.
 */
async function goToPage(pageNumber) {
    if (isRendering || !pdfDoc) return;
    if (pageNumber < 1 || pageNumber > totalPages) return;

    isRendering = true;
    canvas.classList.add('pdf-turning');

    await new Promise(resolve => setTimeout(resolve, 150)); 
    
    await renderPage(pageNumber);
    
    canvas.classList.remove('pdf-turning');
    isRendering = false;
}

function goToPrevPage() {
    goToPage(currentPageNum - 1);
}

function goToNextPage() {
    goToPage(currentPageNum + 1);
}

// MODIFICATION : Suppression de toute la logique de swipe (handleTouchStart, handleTouchEnd)

/**
 * Fonction principale qui se lance au chargement de la page.
 */
async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1;

    if (!supportsModuleWorker()) {
        if (pdfUrl) {
            location.href = `${pdfUrl}#page=${initialPage}`;
            return;
        }
    }

    if (!pdfUrl) {
        document.body.innerHTML = '<h1>Erreur : Aucun fichier PDF spécifié.</h1>';
        return;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        totalPageNumSpan.textContent = totalPages;

        // Écouteurs pour les boutons uniquement
        prevBtn.addEventListener('click', goToPrevPage);
        nextBtn.addEventListener('click', goToNextPage);
        // MODIFICATION : Les écouteurs pour 'touchstart' et 'touchend' ont été retirés.

        await renderPage(initialPage);
    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        document.body.innerHTML = `<h1>Erreur de chargement du PDF</h1><p>${error.message}</p>`;
    }
}

// Lancement de l'application du lecteur
loadPdfViewer();
