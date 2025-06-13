Absolument. Compris. L'objectif est de fournir un plan d'action clair, simple et séquentiel pour intégrer la fonctionnalité d'analyse PCA dans votre application Netlify existante, au sein d'un nouvel onglet "PCA Habitat", en se basant sur les captures d'écran fournies.

L'architecture change radicalement par rapport au prototype Streamlit. Nous allons adopter une approche client-serveur :
1.  **Front-End (Client)** : Votre application existante sur Netlify (`index.html`, `js`, etc.). Nous y ajouterons la page et la logique pour l'onglet "PCA Habitat".
2.  **Back-End (Serveur)** : Un nouveau service API en Python, qui exécutera les calculs de `core.py` et sera appelé par votre application Netlify.

Le script `app.py` (Streamlit) ne sera pas déployé. Il sert uniquement de référence pour la logique métier, notamment le tableau de co-occurrence.

Voici le plan d'implémentation détaillé, étape par étape.

---

### **Plan d'Implémentation : Intégration de "PCA Habitat"**

#### **Étape 1 : Créer la Page "PCA Habitat" (Front-End)**

L'objectif est de construire l'interface utilisateur visible dans les captures d'écran.

1.  **Modifier la navigation principale** :
    * Dans votre fichier `index.html` (ou là où est définie votre barre de navigation), ajoutez une nouvelle entrée pour "PCA Habitat". Inspirez-vous de la structure des autres onglets ("Relevé", "Herbier", etc.).
    * Ce nouvel onglet doit pointer vers une nouvelle page : `pca.html`.

2.  **Créer le contenu de `pca.html`** :
    * Créez le fichier `pca.html`. Ce fichier contiendra la structure de base de votre nouvel onglet.
    * En vous basant sur vos captures d'écran, ajoutez les éléments suivants dans le `<body>` de `pca.html` :
        * Un titre, par exemple : `<h1>Analyse en Composantes Principales (ACP) sur les Habitats</h1>`.
        * Un formulaire (`<form id="pca-form">`) qui contiendra les champs d'upload.
        * Deux champs de type "file" :
            ```html
            <label for="user_file">Relevés à analyser (CSV):</label>
            <input type="file" id="user_file" name="user_file" accept=".csv">

            <label for="ref_file">Référence phytosociologique (CSV):</label>
            <input type="file" id="ref_file" name="ref_file" accept=".csv">
            ```
        * Un bouton pour démarrer l'analyse : `<button type="submit">Lancer l'Analyse</button>`.
        * Des conteneurs vides pour afficher les résultats :
            ```html
            <div id="pca-plot-container"></div> <div id="cooccurrence-table-container"></div> ```

3.  **Lier le script `pca.js`** : Assurez-vous que votre page `pca.html` charge bien le fichier JavaScript `pca.js` avec une balise `<script src="pca.js" defer></script>`.

#### **Étape 2 : Mettre en place le Calculateur d'Analyse (Back-End API)**

Cette partie exécute la logique Python sur un serveur. Nous utiliserons FastAPI pour créer une API simple.

1.  **Créer le fichier de l'API** :
    * Dans le répertoire `PCA Habitat/`, créez un nouveau fichier `main.py`.
    * Installez les dépendances : `pip install fastapi "uvicorn[standard]" python-multipart`. Ajoutez-les à `requirements.txt`.

2.  **Développer le point de terminaison `/analyse`** :
    * Ouvrez `main.py` et copiez-y le code ci-dessous. Ce code crée un serveur web qui attend de recevoir deux fichiers.
    * **Action importante** : La logique pour le calcul de co-occurrence se trouve dans votre prototype `app.py`. Vous devrez extraire cette logique et l'intégrer dans la fonction `run_analysis_logic` ci-dessous pour qu'elle soit retournée avec les résultats de la PCA.

    **Contenu pour `PCA Habitat/main.py` :**
    ```python
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    import pandas as pd
    import io

    # Importez vos fonctions existantes depuis core.py
    from core import analyse, read_reference

    # Initialisation de l'API
    app = FastAPI()

    # Autoriser les requêtes depuis votre site Netlify (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # À restreindre à votre URL Netlify en production
        allow_methods=["POST"],
        allow_headers=["*"],
    )

    def run_analysis_logic(ref_df, user_df):
        """
        Fonction qui encapsule toute la logique d'analyse.
        """
        # 1. Logique de préparation des données (inspirée de app.py)
        # Assurez-vous de bien joindre user_df et ref_df comme dans le prototype.
        # Exemple simplifié :
        combined_df = pd.concat([ref_df.set_index('Espece'), user_df.set_index('Espece')]).fillna(0)
        
        # 2. Lancer l'analyse PCA de core.py
        labels, pca, coords, X_std = analyse(combined_df, n_clusters=3)

        # 3. TODO: Intégrer la logique de calcul de co-occurrence depuis app.py ici.
        # Calculez le dataframe de co-occurrence.
        cooccurrence_data = [{"espece": "Exemple", "voisin_1": "Voisin A - 5", "voisin_2": "Voisin B - 3"}] # À remplacer par le vrai calcul

        # 4. Formater les résultats pour l'envoi en JSON
        return {
            "pca_coordinates": coords.tolist(),
            "species_names": combined_df.index.tolist(),
            "cluster_labels": labels.tolist(),
            "cooccurrence_table": cooccurrence_data
        }

    @app.post("/analyse/")
    async def analyse_endpoint(ref_file: UploadFile = File(...), user_file: UploadFile = File(...)):
        """
        Point de terminaison de l'API qui reçoit les fichiers et retourne l'analyse.
        """
        try:
            ref_df = read_reference(io.BytesIO(await ref_file.read()))
            user_df = read_reference(io.BytesIO(await user_file.read()))
            
            results = run_analysis_logic(ref_df, user_df)
            return results
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse: {str(e)}")

    ```

#### **Étape 3 : Déployer l'API Python**

Cette étape est obligatoire car Netlify ne peut pas exécuter Python.

1.  **Créer un `Dockerfile`** : À la racine du projet, créez un fichier nommé `Dockerfile` (sans extension) pour empaqueter votre API.
    ```Dockerfile
    FROM python:3.11-slim
    WORKDIR /app
    COPY ./PCA Habitat/requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY ./PCA Habitat/ /app/
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
    ```
2.  **Héberger le conteneur** : Déployez cette API sur un service comme **Google Cloud Run**. C'est une solution simple et souvent gratuite pour un faible trafic. Le déploiement vous fournira une URL publique pour votre API (ex: `https://votre-api-unique.a.run.app`).

#### **Étape 4 : Connecter le Front-End à l'API (JavaScript)**

C'est ici que l'on fait le lien entre l'interface et le calculateur.

1.  **Modifier `pca.js`** : Remplacez le contenu de `pca.js` par le code suivant. Il gère l'envoi des fichiers à l'API et l'affichage des résultats.
2.  **Ajouter Plotly.js** : Pour afficher le graphique, vous devez inclure la bibliothèque Plotly.js dans votre `pca.html`. Ajoutez cette ligne dans le `<head>` : `<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>`.

**Contenu pour `pca.js` :**
```javascript
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
```
