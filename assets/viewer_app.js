import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration du worker PDF.js
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../pdfjs/build/pdf.worker.mjs';
} catch (e) {
    console.error('Erreur configuration worker:', e);
}

function supportsModuleWorker() {
    try {
        const worker = new Worker(URL.createObjectURL(new Blob([''], { type: 'text/javascript' })), { type: 'module' });
        worker.terminate();
        return true;
    } catch (e) {
        return false;
    }
}

const container = document.getElementById('pdf-container');

async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const pdfUrl = urlParams.get('file');
    const initialPage = parseInt(urlParams.get('page'), 10) || 1;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!pdfUrl) {
        document.body.innerHTML = '<h1>Erreur : Aucun fichier PDF spécifié.</h1>';
        return;
    }

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
        const loadingOptions = isIOS ? {
            cMapUrl: '../pdfjs/web/cmaps/',
            cMapPacked: true,
            disableWorker: true
        } : {};

        const loadingTask = pdfjsLib.getDocument(pdfUrl, loadingOptions);
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const baseScale = isIOS ? 1.5 : 2.0;
            const devicePixelRatio = window.devicePixelRatio || 1;
            const finalScale = baseScale * devicePixelRatio;
            const viewport = page.getViewport({ scale: finalScale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
            container.appendChild(canvas);
        }

        const target = container.children[initialPage - 1];
        if (target) {
            target.scrollIntoView();
        }
    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
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

loadPdfViewer();
