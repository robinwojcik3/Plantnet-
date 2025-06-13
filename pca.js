// Frontend logic for PCA Habitat module - connects to the FastAPI backend

document.addEventListener('DOMContentLoaded', () => {
    createHabitatTable(20, 50);
    const form = document.getElementById('pca-form');
    if (form) {
        form.addEventListener('submit', handleAnalysis);
    }
});

function createHabitatTable(cols, rows) {
    const table = document.getElementById('habitat-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const headerRow = document.createElement('tr');
    for (let c = 1; c <= cols; c++) {
        const th = document.createElement('th');
        th.contentEditable = true;
        th.textContent = `Habitat ${c}`;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);

    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            td.contentEditable = true;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

async function handleAnalysis(event) {
    event.preventDefault();

    const plotContainer = document.getElementById('pca-plot-container');

    const data = tableToData();
    console.log('Données pour analyse', data);
    plotContainer.innerHTML = '<p>Données prêtes pour analyse (voir console).</p>';
}

function tableToData() {
    const table = document.getElementById('habitat-table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const columns = headers.map(() => []);
    rows.forEach(row => {
        Array.from(row.children).forEach((cell, idx) => {
            const txt = cell.textContent.trim();
            if (txt) columns[idx].push(txt);
        });
    });
    return headers.map((h, idx) => ({ habitat: h, species: columns[idx] }));
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
