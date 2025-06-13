// Simple PCA implementation in vanilla JS

function parseCSV(text) {
  let delimiter = ',';
  if (text.indexOf(';') !== -1 && text.indexOf(',') === -1) delimiter = ';';
  const rows = text.trim().split(/\r?\n/).map(r => r.split(delimiter));
  return rows;
}

function standardize(matrix) {
  const n = matrix.length;
  const m = matrix[0].length;
  const means = Array(m).fill(0);
  const stds = Array(m).fill(0);
  for (const row of matrix) {
    for (let j = 0; j < m; j++) means[j] += row[j];
  }
  for (let j = 0; j < m; j++) means[j] /= n;
  for (const row of matrix) {
    for (let j = 0; j < m; j++) stds[j] += Math.pow(row[j] - means[j], 2);
  }
  for (let j = 0; j < m; j++) stds[j] = Math.sqrt(stds[j] / (n - 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (stds[j] > 0) matrix[i][j] = (matrix[i][j] - means[j]) / stds[j];
      else matrix[i][j] = 0;
    }
  }
}

function multiplyMatrixVector(A, v) {
  const n = A.length;
  const res = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += A[i][j] * v[j];
    res[i] = sum;
  }
  return res;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v) {
  const norm = Math.sqrt(dot(v, v));
  if (norm === 0) return;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
}

function powerIteration(A, iters = 100) {
  const n = A.length;
  let v = Array(n).fill(0).map(() => Math.random());
  normalize(v);
  for (let k = 0; k < iters; k++) {
    const Av = multiplyMatrixVector(A, v);
    normalize(Av);
    v = Av;
  }
  const Av = multiplyMatrixVector(A, v);
  const lambda = dot(v, Av);
  return { value: lambda, vector: v };
}

function pca(matrix) {
  const n = matrix.length;
  const m = matrix[0].length;
  standardize(matrix);

  // covariance matrix
  const cov = Array(m).fill(0).map(() => Array(m).fill(0));
  for (const row of matrix) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < m; k++) cov[j][k] += row[j] * row[k];
    }
  }
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < m; k++) cov[j][k] /= (n - 1);
  }

  const eig1 = powerIteration(cov, 200);
  // deflate
  const A2 = cov.map((row, i) => row.map((val, j) => val - eig1.value * eig1.vector[i] * eig1.vector[j]));
  const eig2 = powerIteration(A2, 200);

  const components = [eig1.vector, eig2.vector];
  const eigvals = [eig1.value, eig2.value];

  // projection
  const coords = matrix.map(row => [dot(row, components[0]), dot(row, components[1])]);

  return { components, eigvals, coords };
}

function loadCSVAndRun(text) {
  const rows = parseCSV(text);
  const headers = rows[0];
  const dataRows = rows.slice(1).filter(r => r.length === headers.length);
  const species = dataRows.map(r => r[0]);
  const data = dataRows.map(r => r.slice(1).map(val => parseFloat(val.replace(',', '.')) || 0));

  const { components, eigvals, coords } = pca(data);
  const totalVar = eigvals.reduce((a, b) => a + b, 0);
  const ratios = eigvals.map(v => v / totalVar);

  displayResults(species, coords, headers.slice(1), components, eigvals, ratios);
  previewTable(headers, dataRows);
}

function previewTable(headers, rows) {
  const container = document.getElementById('data-preview');
  container.innerHTML = '';
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Aperçu des données';
  details.appendChild(summary);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.slice(0, 5).forEach(r => {
    const tr = document.createElement('tr');
    r.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); details.appendChild(table); container.appendChild(details);
}

function displayResults(species, coords, featNames, components, eigvals, ratios) {
  document.getElementById('var-pc1').textContent = (ratios[0] * 100).toFixed(2) + '%';
  document.getElementById('var-pc2').textContent = (ratios[1] * 100).toFixed(2) + '%';

  drawScatter(species, coords);
  drawCorrelationCircle(featNames, components, eigvals);
}

function drawScatter(species, coords) {
  const container = document.getElementById('scatter');
  container.innerHTML = '';
  const width = 400, height = 400, margin = 40;
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const xScale = x => margin + (x - xmin) / (xmax - xmin) * (width - 2 * margin);
  const yScale = y => height - margin - (y - ymin) / (ymax - ymin) * (height - 2 * margin);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const axisX = document.createElementNS(svg.namespaceURI, 'line');
  axisX.setAttribute('x1', margin); axisX.setAttribute('y1', height/2);
  axisX.setAttribute('x2', width-margin); axisX.setAttribute('y2', height/2);
  axisX.setAttribute('stroke', '#999');
  svg.appendChild(axisX);
  const axisY = document.createElementNS(svg.namespaceURI, 'line');
  axisY.setAttribute('x1', width/2); axisY.setAttribute('y1', margin);
  axisY.setAttribute('x2', width/2); axisY.setAttribute('y2', height-margin);
  axisY.setAttribute('stroke', '#999');
  svg.appendChild(axisY);

  coords.forEach((c, i) => {
    const circle = document.createElementNS(svg.namespaceURI, 'circle');
    circle.setAttribute('cx', xScale(c[0]));
    circle.setAttribute('cy', yScale(c[1]));
    circle.setAttribute('r', 4);
    circle.setAttribute('fill', '#388e3c');
    const title = document.createElementNS(svg.namespaceURI, 'title');
    title.textContent = species[i];
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

function drawCorrelationCircle(featNames, components, eigvals) {
  const container = document.getElementById('correlation');
  container.innerHTML = '';
  const width = 400, height = 400, margin = 40;
  const radius = (width - 2 * margin) / 2;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const cx = width / 2, cy = height / 2;

  const circle = document.createElementNS(svg.namespaceURI, 'circle');
  circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', radius);
  circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', '#ccc');
  svg.appendChild(circle);

  const axisX = document.createElementNS(svg.namespaceURI, 'line');
  axisX.setAttribute('x1', margin); axisX.setAttribute('y1', cy);
  axisX.setAttribute('x2', width-margin); axisX.setAttribute('y2', cy);
  axisX.setAttribute('stroke', '#999');
  svg.appendChild(axisX);
  const axisY = document.createElementNS(svg.namespaceURI, 'line');
  axisY.setAttribute('x1', cx); axisY.setAttribute('y1', margin);
  axisY.setAttribute('x2', cx); axisY.setAttribute('y2', height-margin);
  axisY.setAttribute('stroke', '#999');
  svg.appendChild(axisY);

  const scale = val => radius * val;
  const sqrtEig = eigvals.map(Math.sqrt);
  featNames.forEach((name, i) => {
    const x = components[0][i] * sqrtEig[0];
    const y = components[1][i] * sqrtEig[1];
    const line = document.createElementNS(svg.namespaceURI, 'line');
    line.setAttribute('x1', cx); line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + scale(x));
    line.setAttribute('y2', cy - scale(y));
    line.setAttribute('stroke', '#1f77b4');
    svg.appendChild(line);
    const text = document.createElementNS(svg.namespaceURI, 'text');
    text.setAttribute('x', cx + scale(x));
    text.setAttribute('y', cy - scale(y));
    text.setAttribute('font-size', '10');
    text.textContent = name;
    svg.appendChild(text);
  });

  container.appendChild(svg);
}

document.addEventListener('DOMContentLoaded', () => {
  const uploader = document.getElementById('csv-input');
  const demoBtn = document.getElementById('demo-data');

  uploader.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => loadCSVAndRun(reader.result);
      reader.readAsText(file);
    }
  });

  demoBtn.addEventListener('click', () => {
    fetch('PCA Habitat/data_ecologie_espece.csv')
      .then(r => r.text())
      .then(txt => loadCSVAndRun(txt))
      .catch(() => showNotification('Erreur chargement des données', 'error'));
  });
});

