// PCA Habitat interactive module

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('csvInput');
  const defaultPath = 'PCA%20Habitat/data_ref.csv';

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) {
      file.text().then(text => processCSV(text));
    }
  });

  fetch(defaultPath)
    .then(resp => resp.text())
    .then(text => processCSV(text))
    .catch(() => {
      showNotification('Impossible de charger les données par défaut', 'error');
    });
});

function processCSV(text) {
  const parsed = Papa.parse(text.trim(), { header: true, dynamicTyping: true, delimiter: ';' });
  const rows = parsed.data.filter(r => Object.keys(r).length > 1);
  if (!rows.length) return;

  const allFields = parsed.meta.fields;
  const speciesKey = allFields[0];
  const varNames = allFields.slice(1);

  const species = rows.map(r => r[speciesKey]);
  const matrix = rows.map(r => varNames.map(v => parseFloat(r[v])));

  const { scores, loadings, variance } = pca(matrix);

  document.getElementById('varPc1').textContent = (variance[0]*100).toFixed(2) + '%';
  document.getElementById('varPc2').textContent = (variance[1]*100).toFixed(2) + '%';

  const previewHead = '<pre>' + allFields.join('\t') + '\n';
  const previewRows = rows.slice(0,5).map(r => allFields.map(f => r[f]).join('\t')).join('\n');
  document.getElementById('dataPreview').innerHTML = previewHead + previewRows + '</pre>';

  plotProjection(scores, species);
  plotCorrelation(loadings, varNames);
}

function pca(matrix) {
  const n = matrix.length;
  const m = matrix[0].length;
  const means = new Array(m).fill(0);
  const stds = new Array(m).fill(0);

  for (const row of matrix) {
    for (let j=0; j<m; j++) means[j] += row[j];
  }
  for (let j=0; j<m; j++) means[j] /= n;

  const centered = matrix.map(row => row.map((v,j) => v - means[j]));

  for (const row of centered) {
    for (let j=0; j<m; j++) stds[j] += row[j]*row[j];
  }
  for (let j=0; j<m; j++) stds[j] = Math.sqrt(stds[j]/(n-1));

  const normalized = centered.map(row => row.map((v,j) => stds[j] ? v/stds[j] : 0));

  const {u,v,q} = SVDJS.SVD(normalized);

  const eigenvals = q.map(val => (val*val)/(n-1));
  const total = eigenvals.reduce((a,b) => a+b, 0);
  const variance = eigenvals.map(val => val/total);

  const scores = normalized.map((row,i) => q.map((s,k) => u[i][k] * s));
  const loadings = v.slice(0, m).map(row => [row[0], row[1]]);

  return { scores, loadings, variance };
}

function plotProjection(scores, labels) {
  const x = scores.map(r => r[0]);
  const y = scores.map(r => r[1]);
  const trace = {
    x, y, text: labels,
    mode: 'markers',
    type: 'scatter',
    hovertemplate: '%{text}<br>PC1:%{x:.2f}<br>PC2:%{y:.2f}<extra></extra>'
  };
  Plotly.newPlot('scatter', [trace], {title:'Projection des espèces', xaxis:{title:'PC1'}, yaxis:{title:'PC2'}});
}

function plotCorrelation(loadings, names) {
  const circleX = [], circleY = [];
  for (let i=0;i<=100;i++){ circleX.push(Math.cos(2*Math.PI*i/100)); circleY.push(Math.sin(2*Math.PI*i/100)); }
  const circleTrace = {x:circleX, y:circleY, mode:'lines', name:'Cercle', line:{color:'lightgray'}};

  const varTraces = names.map((name,i) => ({
    x:[0, loadings[i][0]],
    y:[0, loadings[i][1]],
    mode:'lines+text',
    text:['', name],
    textposition:'top center',
    showlegend:false
  }));

  Plotly.newPlot('corr', [circleTrace, ...varTraces], {title:'Cercle de corrélation', xaxis:{title:'PC1', range:[-1.1,1.1]}, yaxis:{title:'PC2', range:[-1.1,1.1]}});
}
