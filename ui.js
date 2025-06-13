(function() {
    // --- Initialisation des composants UI (Notifications, Modals, Spinner) ---
    // Cette partie est un utilitaire générique pour l'interface.
    const style = document.createElement('style');
    style.textContent = `
        #notification-container { position: fixed; top: 1rem; right: 1rem; z-index: 2000; display: flex; flex-direction: column; align-items: flex-end; }
        .notification { padding: 10px 15px; margin-top: .5rem; border-radius: 4px; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .notification.success { background: #4caf50; }
        .notification.error { background: #e53935; }
        #modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,.6); display: none; align-items: center; justify-content: center; z-index: 3000; padding: 1rem; }
        #modal-overlay.show { display: flex; }
        #modal-overlay .modal-content { background: var(--card, #fff); color: var(--text, #000); padding: 1rem 1.5rem; border-radius: 6px; max-width: 500px; width: 100%; }
        #modal-overlay .modal-close { float: right; cursor: pointer; background: none; border: none; font-size: 1.5rem; }
        #spinner-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,.7); display: none; align-items: center; justify-content: center; z-index: 4000; }
        #spinner-overlay.show { display: flex; }
        #spinner-overlay .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #4caf50; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        document.body.appendChild(notificationContainer);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'modal-overlay';
        modalOverlay.innerHTML = '<div class="modal-content"><button class="modal-close" aria-label="Fermer">&times;</button><div class="modal-body"></div></div>';
        document.body.appendChild(modalOverlay);
        modalOverlay.querySelector('.modal-close').addEventListener('click', () => modalOverlay.classList.remove('show'));

        const spinnerOverlay = document.createElement("div");
        spinnerOverlay.id = "spinner-overlay";
        spinnerOverlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(spinnerOverlay);

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            const applyTheme = theme => {
                document.documentElement.dataset.theme = theme;
                localStorage.setItem('theme', theme);
                themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
            };
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme) {
                applyTheme(savedTheme);
            }
            themeBtn.addEventListener('click', () => {
                const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
            });
        }
    });

    window.showNotification = function(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification ' + (type === 'error' ? 'error' : 'success');
        notificationDiv.textContent = message;
        container.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 4000);
    };

    window.showModal = function(message) {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay) return;
        overlay.querySelector('.modal-body').textContent = message;
        overlay.classList.add('show');
    };
    
    window.toggleSpinner = function(show) {
        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.classList.toggle("show", !!show);
    };

    /**
     * Affiche les résultats de la recherche dans le conteneur principal.
     * @param {Array} speciesList - La liste des espèces à afficher.
     * @param {Array} floraGallicaToc - La table des matières de Flora Gallica.
     */
    window.displayResults = function(speciesList, floraGallicaToc) {
        // ... (code original non modifié)
    };

    // ===== NOUVELLES FONCTIONS POUR GOOGLE SHEETS (MODIFIÉES) =====

    window.loadGoogleSheetAsCsv = async function() {
        window.toggleSpinner(true);
        const urlInput = document.getElementById('sheet-csv-url');
        const container = document.getElementById('gs-container');
        const speciesListContainer = document.getElementById('species-list-container');
        const getSpeciesBtn = document.getElementById('get-unique-species-btn');

        if (getSpeciesBtn) getSpeciesBtn.style.display = 'none';
        if (speciesListContainer) speciesListContainer.innerHTML = '';
        container.innerHTML = '';

        const url = urlInput ? urlInput.value.trim() : '';
        if (!url) {
            window.showNotification("Veuillez entrer une URL.", 'error');
            window.toggleSpinner(false);
            return;
        }

        // Validation plus stricte de l'URL
        if (!url.includes('/pub?output=csv')) {
            const errorMsg = "URL invalide. Assurez-vous d'utiliser l'URL de publication se terminant par '.../pub?output=csv'.";
            window.showNotification(errorMsg, 'error');
            container.innerHTML = `<p style="color:red;">${errorMsg}</p>`;
            window.toggleSpinner(false);
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Erreur réseau: ${response.statusText}`);
            }
            const csvData = await response.text();
            
            const rows = csvData.split('\n').map(row => row.split(','));

            if (rows.length === 0 || (rows.length === 1 && rows[0].length === 1 && rows[0][0] === '')) {
                throw new Error("Le fichier CSV distant est vide.");
            }

            let table = '<table class="gs-table">';
            table += '<thead><tr>';
            rows[0].forEach(header => {
                table += `<th>${header.trim()}</th>`;
            });
            table += '</tr></thead>';

            table += '<tbody>';
            for (let i = 1; i < rows.length; i++) {
                if (rows[i].join('').trim() === '') continue;
                table += '<tr>';
                rows[i].forEach(cell => {
                    table += `<td>${cell.trim()}</td>`;
                });
                table += '</tr>';
            }
            table += '</tbody></table>';

            container.innerHTML = table;
            if (getSpeciesBtn) getSpeciesBtn.style.display = 'block';

        } catch (error) {
            console.error('Erreur lors du chargement de la Google Sheet:', error);
            const userMsg = `Impossible de charger les données. Vérifiez que l'URL est correcte et publiquement accessible. (${error.message})`;
            window.showNotification(userMsg, 'error');
            container.innerHTML = `<p style="color:red;">${userMsg}</p>`;
        } finally {
            window.toggleSpinner(false);
        }
    };

    window.getUniqueSpeciesFromTable = function() {
        const table = document.querySelector('#gs-container table');
        if (!table) {
            console.error("Tableau de données non trouvé.");
            return [];
        }
        const species = new Set();
        const rows = table.querySelectorAll('tbody tr'); // Only scan body rows

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                const speciesName = cell.textContent.trim();
                if (speciesName) { // Add only non-empty strings
                    species.add(speciesName);
                }
            });
        });
        
        return Array.from(species).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    };

    window.displayUniqueSpeciesList = function() {
        const speciesList = window.getUniqueSpeciesFromTable();
        const container = document.getElementById('species-list-container');
        if (!container) return;

        container.innerHTML = ''; // Clear previous results

        if (speciesList.length === 0) {
            container.innerHTML = '<p>Aucune espèce trouvée dans les données.</p>';
            return;
        }

        let listHtml = `<h3>Liste des espèces uniques (${speciesList.length})</h3><ul>`;
        speciesList.forEach(species => {
            listHtml += `<li>${species}</li>`;
        });
        listHtml += '</ul>';

        container.innerHTML = listHtml;
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

})();
