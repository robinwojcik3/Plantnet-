import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;

// Récupération des éléments du DOM, y compris les nouveaux boutons de zoom
const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const prevBtn = document.getElementById('prev-page-btn');
const nextBtn = document.getElementById('next-page-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const currentPageNumSpan = document.getElementById('current-page-num');
const totalPageNumSpan = document.getElementById('total-page-num');

// Variables d'état
let pdfDoc = null;
let currentPageNum = 1;
let totalPages = 0;
let isRendering = false;
let currentScale = 1.5; // Échelle de rendu initiale

/**
 * Affiche une page spécifique du PDF sur le canvas.
 * @param {number} num - Le numéro de la page à afficher.
 */
async function renderPage(num) {
    if (!pdfDoc) return;
    currentPageNum = Math.max(1, Math.min(totalPages, num));
    isRendering = true;

    try {
        const page = await pdfDoc.getPage(currentPageNum);
        
        // Utilise l'échelle actuelle pour le rendu
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: currentScale * devicePixelRatio });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        // Le style CSS s'occupe de l'affichage, le canvas conserve sa haute résolution
        canvas.style.width = `${viewport.width / devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / devicePixelRatio}px`;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

    } catch (error) {
        console.error('Erreur lors du rendu de la page:', error);
    } finally {
        isRendering = false;
        updateControls();
    }
}

/**
 * Met à jour l'état des boutons de navigation et de zoom.
 */
function updateControls() {
    currentPageNumSpan.textContent = currentPageNum;
    totalPageNumSpan.textContent = totalPages;
    prevBtn.disabled = (currentPageNum <= 1);
    nextBtn.disabled = (currentPageNum >= totalPages);
    zoomOutBtn.disabled = (currentScale <= 0.5); // Limite de dézoom
    zoomInBtn.disabled = (currentScale >= 4.0); // Limite de zoom
}

/**
 * Fonctions de navigation avec animation.
 */
async function goToPage(pageNumber) {
    if (isRendering || !pdfDoc || pageNumber < 1 || pageNumber > totalPages) return;
    
    canvas.classList.add('pdf-turning');
    await new Promise(resolve => setTimeout(resolve, 150)); 
    await renderPage(pageNumber);
    canvas.classList.remove('pdf-turning');
}

/**
 * Fonctions pour le zoom.
 */
function zoomIn() {
    if (currentScale >= 4.0) return; // Limite max
    currentScale += 0.25;
    renderPage(currentPageNum);
}

function zoomOut() {
    if (currentScale <= 0.5) return; // Limite min
    currentScale -= 0.25;
    renderPage(currentPageNum);
}

/**
 * Fonction principale qui se lance au chargement de la page.
 */
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
        
        // Ajout des écouteurs pour les boutons de navigation et de zoom
        prevBtn.addEventListener('click', () => goToPage(currentPageNum - 1));
        nextBtn.addEventListener('click', () => goToPage(currentPageNum + 1));
        zoomInBtn.addEventListener('click', zoomIn);
        zoomOutBtn.addEventListener('click', zoomOut);

        await renderPage(initialPage);
    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        document.body.innerHTML = `<h1>Erreur de chargement du PDF</h1><p>${error.message}</p>`;
    }
}

loadPdfViewer();
