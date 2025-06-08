let pdfjsLib;
async function loadPdfLib() {
    if (!pdfjsLib) {
        pdfjsLib = await import('../pdfjs/build/pdf.mjs');
        try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;
        } catch (e) {
            console.error('Erreur configuration worker:', e);
        }
    }
    return pdfjsLib;
}

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
        
        // Réduire l'échelle sur iOS pour éviter les problèmes de mémoire
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const baseScale = isIOS ? 1.5 : 2.0; 
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

/**
 * Fonction principale qui se lance au chargement de la page.
 */
async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!pdfUrl) {
        document.body.innerHTML = '<h1>Erreur : Aucun fichier PDF spécifié.</h1>';
        return;
    }

    // Si iOS et pas de support des module workers, proposer une alternative
    if (isIOS && !supportsModuleWorker()) {
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h2>Ouverture du PDF</h2>
                <p>Le lecteur PDF intégré n'est pas compatible avec votre appareil.</p>
                <p>Page cible : ${initialPage}</p>
                <a href="${pdfUrl}" style="display: inline-block; margin: 20px; padding: 10px 20px; background: #388e3c; color: white; text-decoration: none; border-radius: 5px;">
                    Ouvrir le PDF (recherchez la page ${initialPage})
                </a>
            </div>
        `;
        return;
    }

    try {
        // Configuration spéciale pour iOS
        const loadingOptions = isIOS ? {
            cMapUrl: '../pdfjs/web/cmaps/',
            cMapPacked: true,
            disableWorker: true // Désactiver le worker sur iOS pour éviter les erreurs
        } : {};

        const lib = await loadPdfLib();
        const loadingTask = lib.getDocument(pdfUrl, loadingOptions);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        totalPageNumSpan.textContent = totalPages;

        // Écouteurs pour les boutons uniquement
        prevBtn.addEventListener('click', goToPrevPage);
        nextBtn.addEventListener('click', goToNextPage);

        await renderPage(initialPage);
    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        
        // En cas d'erreur, proposer d'ouvrir le PDF natif
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h2>Erreur de chargement</h2>
                <p>Impossible de charger le lecteur PDF intégré.</p>
                <p>Page recherchée : ${initialPage}</p>
                <a href="${pdfUrl}" style="display: inline-block; margin: 20px; padding: 10px 20px; background: #388e3c; color: white; text-decoration: none; border-radius: 5px;">
                    Ouvrir le PDF dans le lecteur natif
                </a>
            </div>
        `;
    }
}

// Lancement de l'application du lecteur
loadPdfViewer();
