# Google Apps Script : Obtenir la liste des espèces uniques

Ce script ajoute un menu personnalisé et une fonction permettant de collecter toutes les espèces uniques d'une feuille Google Sheets. Il ignore la première ligne qui contient les noms d'habitats.

## Installation
1. Ouvrez votre feuille Google Sheets.
2. Choisissez **Extensions > Apps Script** pour créer un nouveau projet.
3. Copiez le contenu du fichier [`unique_species_script.gs`](unique_species_script.gs) dans l'éditeur de script.
4. Enregistrez puis rechargez la feuille.
5. Un menu "Scripts personnalisés" apparaît en haut de la feuille. Utilisez l'élément **Obtenir la liste des espèces uniques** pour exécuter le script.

Vous pouvez également insérer un dessin ou un bouton et lui attribuer la fonction `obtenirListeEspecesUniques` pour lancer la recherche à l'aide d'un bouton visible au-dessus du tableau.

## Fonctionnement
- Le script lit toutes les cellules du tableau à partir de la deuxième ligne (ligne 2).
- Les valeurs vides sont ignorées.
- Les doublons sont supprimés à l'aide d'un objet `speciesSet`.
- Les espèces sont triées alphabétiquement avec `localeCompare('fr')`.
- Le résultat s'affiche dans une boîte de dialogue modale sous forme de liste.
