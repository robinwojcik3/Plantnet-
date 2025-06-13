Absolument. Voici la version mise à jour du fichier `PLAN.md` qui inclut ces précisions contextuelles importantes.

---

### **PLAN.md**

#### **Objectif : Implémenter l'onglet 'PCA Habitat' de manière incrémentale**

Ce document détaille les étapes séquentielles pour intégrer la nouvelle fonctionnalité d'Analyse en Composantes Principales dans l'application Streamlit. Chaque étape doit être complétée et validée avant de passer à la suivante.

#### **Contexte et Source des Fichiers**

**Note importante :** Ce plan d'action (`PLAN.md`) est situé dans le répertoire `Plantnet-/PCA Habitat/`. L'ensemble du code et des fonctionnalités à implémenter pour l'onglet **'PCA Habitat'** doivent être une reproduction fidèle de la logique et des scripts déjà présents dans ce même répertoire. Les étapes ci-dessous servent à guider l'intégration structurée de ces éléments existants dans l'application principale `app.py`.

---

### **Étape 1 : Mise en place de la structure de l'onglet**

1.  **Modifier `app.py`** pour introduire une structure à onglets avec `st.tabs`.
2.  **Créer deux onglets** :
    * Le premier, nommé **'Analyse Syntaxonomique'**, contiendra l'ensemble du code existant de l'application.
    * Le second, nommé **'PCA Habitat'**, sera initialement vide.
3.  **Vérifier** que l'application se lance correctement avec les deux onglets et que le contenu original est entièrement fonctionnel dans le premier onglet.

---

### **Étape 2 : Implémentation du chargement des données**

1.  Dans l'onglet **'PCA Habitat'**, ajouter un titre principal, par exemple : `st.title("Analyse en Composantes Principales des Habitats")`.
2.  **Intégrer un widget `st.file_uploader`** pour permettre à l'utilisateur de téléverser un fichier CSV.
3.  **Implémenter la logique de sélection de données** :
    * Si un fichier est téléversé par l'utilisateur, utiliser ce fichier.
    * Sinon, charger par défaut le fichier `data_ecologie_espece.csv`.
4.  Utiliser la fonction `core.read_reference()` pour lire et préparer le DataFrame, quelle que soit sa source.
5.  **Afficher le DataFrame** chargé dans un `st.expander` pour permettre la vérification des données.

---

### **Étape 3 : Exécution de l'analyse et affichage des résultats de base**

1.  Après le chargement des données, appeler la fonction `core.analyse()` avec le DataFrame pour effectuer la PCA.
2.  Récupérer les résultats de la fonction : l'objet PCA et les coordonnées des points.
3.  **Afficher les informations de base** de l'analyse : le pourcentage de variance expliquée par les deux premiers axes principaux. Utiliser `st.metric` ou `st.info` pour une présentation claire.

---

### **Étape 4 : Création du graphique de projection des espèces**

1.  Utiliser la bibliothèque **Plotly** pour créer une première visualisation.
2.  **Générer un nuage de points (scatter plot)** représentant le plan factoriel :
    * Axe X : Coordonnées de la première composante principale (PC1).
    * Axe Y : Coordonnées de la seconde composante principale (PC2).
    * Chaque point représente une espèce.
    * Au survol de la souris (hover), afficher le nom de l'espèce.
3.  **Afficher ce graphique** dans l'application à l'aide de `st.plotly_chart`.

---

### **Étape 5 : Création du graphique du cercle de corrélation**

1.  Toujours avec **Plotly**, créer la seconde visualisation.
2.  **Générer le cercle de corrélation** des variables :
    * Dessiner un cercle de rayon 1 centré à l'origine (0,0).
    * Pour chaque variable écologique (ex: 'Lumière', 'Humidité'), tracer une flèche partant de l'origine jusqu'à ses coordonnées sur le plan factoriel.
    * Ajouter une étiquette avec le nom de la variable au bout de chaque flèche.
3.  **Afficher ce second graphique** dans l'application, idéalement à côté du premier en utilisant `st.columns`.

---

### **Étape 6 : Finalisation et nettoyage**

1.  **Vérifier l'agencement** de tous les éléments de l'onglet pour une expérience utilisateur logique et intuitive.
2.  **Ajouter des titres et des descriptions** claires pour chaque section et chaque graphique afin de guider l'utilisateur.
3.  **Relire le code** pour s'assurer qu'il est propre, commenté et qu'il respecte les bonnes pratiques.
4.  **Effectuer un test complet** du nouvel onglet avec et sans chargement de fichier externe pour valider la robustesse de l'implémentation.
