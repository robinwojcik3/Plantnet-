function obtenirListeEspecesUniques() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getDataRange();
  var values = range.getValues();
  var speciesSet = {};
  for (var i = 1; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      var val = values[i][j];
      if (val) {
        speciesSet[val] = true;
      }
    }
  }
  var species = Object.keys(speciesSet).sort(function(a, b) {
    return a.toString().localeCompare(b.toString(), 'fr');
  });

  var html = '<div style="font-family:Arial, sans-serif">';
  html += '<h3>Liste des espèces uniques (' + species.length + ')</h3><ul>';
  species.forEach(function(s) {
    html += '<li>' + s + '</li>';
  });
  html += '</ul></div>';
  SpreadsheetApp.getUi()
    .showModalDialog(HtmlService.createHtmlOutput(html), 'Espèces uniques');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Scripts personnalisés')
    .addItem('Obtenir la liste des espèces uniques', 'obtenirListeEspecesUniques')
    .addToUi();
}
