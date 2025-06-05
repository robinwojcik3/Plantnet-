// On importe la bibliothèque pdfjs que nous avons incluse dans le HTML
import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration essentielle pour indiquer où se trouve le 'worker' de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;

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

/**
 * Affiche une page spécifique du PDF sur le canvas.
 * @param {number} num - Le numéro de la page à afficher.
 */
async function renderPage(num) {
    if (!pdfDoc) return;
    
    // Empêche le rendu si la page est hors limites
    num = Math.max(1, Math.min(totalPages, num));
    currentPageNum = num;

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: 1.5 }); // On peut ajuster l'échelle ici
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        // Mettre à jour les informations de pagination
        currentPageNumSpan.textContent = currentPageNum;
        prevBtn.disabled = (currentPageNum <= 1);
        nextBtn.disabled = (currentPageNum >= totalPages);

    } catch (error) {
        console.error('Erreur lors du rendu de la page:', error);
    }
}

// Logique pour les boutons de navigation
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


/**
 * Fonction principale qui se lance au chargement de la page.
 */
async function loadPdfViewer() {
    // Récupérer les paramètres 'file' et 'page' de l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1; // La page de départ, 1 par défaut

    if (!pdfUrl) {
        document.body.innerHTML = '<h1>Erreur : Aucun fichier PDF spécifié.</h1>';
        return;
    }

    try {
        // Charger le document PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        pdfDoc = await loadingTask.promise;
        
        totalPages = pdfDoc.numPages;
        totalPageNumSpan.textContent = totalPages;

        // Afficher la page initiale demandée
        renderPage(initialPage);

    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        document.body.innerHTML = `<h1>Erreur de chargement du PDF</h1><p>${error.message}</p>`;
    }
}

// Lancer le chargement
loadPdfViewer();
