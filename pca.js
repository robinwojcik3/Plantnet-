// Frontend logic for PCA Habitat module

document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('species-select');
  const runBtn = document.getElementById('run-pca-button');
  const circleDiv = document.getElementById('pca-correlation-circle-plot');
  const indDiv = document.getElementById('pca-individuals-plot');
  const tableDiv = document.getElementById('pca-results-table');

  // Populate species list
  fetch('/api/species')
    .then(r => r.json())
    .then(list => {
      list.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
    })
    .catch(() => {
      console.error('Impossible de charger la liste des espèces');
    });

  runBtn.addEventListener('click', () => {
    const selected = Array.from(select.selectedOptions).map(o => o.value);
    fetch('/api/run_pca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: selected })
    })
      .then(r => r.json())
      .then(data => {
        circleDiv.innerHTML = `<img src="${data.circle_plot}" alt="Cercle de corrélation">`;
        indDiv.innerHTML = `<img src="${data.individuals_plot}" alt="Projection des individus">`;

        const tbl = document.createElement('table');
        const header = document.createElement('tr');
        ['Nom', 'Contrib. PC1', 'Contrib. PC2'].forEach(t => {
          const th = document.createElement('th');
          th.textContent = t;
          header.appendChild(th);
        });
        tbl.appendChild(header);
        (data.variable_contrib || []).forEach(row => {
          const tr = document.createElement('tr');
          const nameTd = document.createElement('td');
          nameTd.textContent = row.name;
          const c1 = document.createElement('td');
          c1.textContent = row.pc1.toFixed(2);
          const c2 = document.createElement('td');
          c2.textContent = row.pc2.toFixed(2);
          tr.appendChild(nameTd);
          tr.appendChild(c1);
          tr.appendChild(c2);
          tbl.appendChild(tr);
        });
        tableDiv.innerHTML = '';
        tableDiv.appendChild(tbl);
      })
      .catch(() => {
        console.error('Erreur lors de l\'analyse PCA');
      });
  });
});
