// Frontend logic for PCA Habitat module - connects to the FastAPI backend

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pca-form');
    if (form) {
        form.addEventListener('submit', handleAnalysis);
    }
});

async function handleAnalysis(event) {
    event.preventDefault();

    const userFileInput = document.getElementById('user_file');
    const refFileInput = document.getElementById('ref_file');
    const plotContainer = document.getElementById('pca-plot-container');
    const tableContainer = document.getElementById('cooccurrence-table-container');

    if (!userFileInput.files[0] || !refFileInput.files[0]) {
        plotContainer.innerHTML = '<p style="color: red;">Veuillez sélectionner les deux fichiers CSV.</p>';
        return;
    }

    plotContainer.innerHTML = '<p>Analyse en cours, veuillez patienter...</p>';
    tableContainer.innerHTML = '';

    const formData = new FormData();
    formData.append('user_file', userFileInput.files[0]);
    formData.append('ref_file', refFileInput.files[0]);

    // **REMPLACEZ PAR L'URL DE VOTRE API DÉPLOYÉE**
    const API_URL = 'https://VOTRE-API-URL.a.run.app/analyse/';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Erreur du serveur');
        }

        const results = await response.json();
        displayPcaPlot(results);
        displayCooccurrenceTable(results);

    } catch (error) {
        plotContainer.innerHTML = `<p style="color: red;">Erreur: ${error.message}</p>`;
    }
}

function displayPcaPlot(results) {
    const plotContainer = document.getElementById('pca-plot-container');
    const traces = [];
    const clusterLabels = [...new Set(results.cluster_labels)]; // Labels uniques [1, 2, 3...]

    clusterLabels.forEach(label => {
        const x_coords = [];
        const y_coords = [];
        const texts = [];
        results.pca_coordinates.forEach((coord, i) => {
            if (results.cluster_labels[i] === label) {
                x_coords.push(coord[0]);
                y_coords.push(coord[1]);
                texts.push(results.species_names[i]);
            }
        });

        traces.push({
            x: x_coords,
            y: y_coords,
            mode: 'markers',
            type: 'scatter',
            name: `Cluster ${label}`,
            text: texts,
            hoverinfo: 'text'
        });
    });

    const layout = {
        title: 'Projection des relevés et des syntaxons de référence',
        xaxis: { title: 'Composante Principale 1' },
        yaxis: { title: 'Composante Principale 2' },
    };

    Plotly.newPlot(plotContainer, traces, layout);
}

function displayCooccurrenceTable(results) {
    const tableContainer = document.getElementById('cooccurrence-table-container');
    const tableData = results.cooccurrence_table;

    if (!tableData || tableData.length === 0) {
        tableContainer.innerHTML = '<p>Aucune donnée de co-occurrence à afficher.</p>';
        return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Créer l'en-tête
    const headers = Object.keys(tableData[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Créer le corps du tableau
    tableData.forEach(rowData => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowData[header];
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.innerHTML = '<h2>Tableau des co-occurrences</h2>';
    tableContainer.appendChild(table);
}
