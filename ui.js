// Function to create and add the species table to the DOM
const createSpeciesTable = (speciesList) => {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  // Create table header
  const headerRow = document.createElement('tr');
  const headers = [
    'Nom scientifique',
    'Nom commun',
    'Famille',
    'Milieu',
    'Flora Gallica',
    'FloreAlpes',
    'OPEN Ops',
    'INPN',
    'Ajouter au carnet',
  ];
  headers.forEach((headerText) => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Create table rows for each species
  speciesList.forEach((taxon) => {
    const tr = document.createElement('tr');
    tr.appendChild(td(taxon.scientificName, 'scientific-name'));
    tr.appendChild(td(taxon.commonName));
    tr.appendChild(td(taxon.family));

    // Create a cell for the ecology
    const ecologyCell = document.createElement('td');
    const ecologyList = document.createElement('ul');
    taxon.ecology.forEach((eco) => {
      const ecologyItem = document.createElement('li');
      ecologyItem.textContent = eco;
      ecologyList.appendChild(ecologyItem);
    });
    ecologyCell.appendChild(ecologyList);
    tr.appendChild(ecologyCell);

    // Links
    tr.appendChild(
      tdLink(
        'page ' + taxon.floraGallicaPage,
        './viewer.html?pdf=assets/flora_gallica_pdfs/' +
          taxon.floraGallicaPdf +
          '&page=' +
          taxon.floraGallicaPage,
        null
      )
    );

    tr.appendChild(
      tdLink(
        'lien',
        'https://www.florealpes.com/fiche' +
          taxon.scientificName.toLowerCase().replace(/ /g, '') +
          '.php',
        null
      )
    );

    tr.appendChild(
      tdLink(
        'OPEN Obs',
        `https://openobs.mnhn.fr/projects/16/species/${taxon.scientificName}`,
        './assets/openobs.png'
      )
    );
    tr.appendChild(
      tdLink(
        'INPN',
        `https://inpn.mnhn.fr/espece/cd_nom/${taxon.cdNom}`,
        './assets/inpn.png'
      )
    );

    // Add to notebook button
    const addButtonCell = document.createElement('td');
    const addButton = document.createElement('button');
    addButton.textContent = '+';
    addButton.classList.add('add-button');
    addButton.onclick = () => addToNotebook(taxon);
    addButtonCell.appendChild(addButton);
    tr.appendChild(addButtonCell);

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  // Add the table to the container
  const tableContainer = document.getElementById('table-container');
  tableContainer.innerHTML = ''; // Clear previous table
  tableContainer.appendChild(table);
};

// Helper function to create a table cell
const td = (text, className) => {
  const td = document.createElement('td');
  if (text) {
    td.textContent = text;
  }
  if (className) {
    td.className = className;
  }
  return td;
};

// Helper function to create a table cell with a link
const tdLink = (text, url, imgSrc) => {
  const td = document.createElement('td');
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = text;
    img.classList.add('table-icon');
    a.appendChild(img);
  } else {
    a.textContent = text;
  }
  td.appendChild(a);
  return td;
};

// Function to add a species to the notebook
const addToNotebook = (taxon) => {
  const notebook = JSON.parse(localStorage.getItem('notebook')) || [];
  if (!notebook.find((item) => item.cdNom === taxon.cdNom)) {
    notebook.push(taxon);
    localStorage.setItem('notebook', JSON.stringify(notebook));
    alert(`${taxon.scientificName} a été ajouté au carnet.`);
  } else {
    alert(`${taxon.scientificName} est déjà dans le carnet.`);
  }
};
