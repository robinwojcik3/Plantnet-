import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration du worker avec gestion d'erreur pour iOS
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;
} catch (e) {
    console.error('Erreur configuration worker:', e);
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

// Récupération du conteneur qui accueillera les pages du PDF
const container = document.getElementById('pdf-container');

// Variables pour garder l'état du PDF
let pdfDoc = null;
let totalPages = 0;

/**
 * Rendu d'une page du PDF dans un nouveau canvas inséré dans le conteneur.
 * @param {number} num - Numéro de la page à afficher.
 * @returns {Promise<HTMLCanvasElement>} Canvas contenant la page rendue.
 */
async function renderPage(num) {
    if (!pdfDoc) return null;

    try {
        const page = await pdfDoc.getPage(num);

        // Réduire l'échelle sur iOS pour éviter les problèmes de mémoire
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const baseScale = isIOS ? 1.5 : 2.0;
        const devicePixelRatio = window.devicePixelRatio || 1;
        const finalScale = baseScale * devicePixelRatio;

        const viewport = page.getViewport({ scale: finalScale });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: canvas.getContext('2d'),
            viewport
        };
        await page.render(renderContext).promise;
        container.appendChild(canvas);
        return canvas;
    } catch (error) {
        console.error('Erreur lors du rendu de la page:', error);
        return null;
    }
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

        const loadingTask = pdfjsLib.getDocument(pdfUrl, loadingOptions);
        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;

        const canvases = [];
        for (let i = 1; i <= totalPages; i++) {
            const c = await renderPage(i);
            canvases.push(c);
        }

        const target = canvases[initialPage - 1];
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
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
