"""
Fonctions de lecture + analyses
"""

import csv
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy.cluster.hierarchy import linkage, fcluster
import io # Module importé pour la gestion des flux de données

def read_reference(path_or_buffer) -> pd.DataFrame:
    """Lecture CSV (détection automatique du séparateur) + nettoyage."""

    # --- DÉBUT DE LA CORRECTION ---
    # Si l'entrée est un flux de fichier (comme celui envoyé par FastAPI),
    # il est lu et décodé en texte (UTF-8).
    # pandas peut alors le lire comme s'il s'agissait d'un fichier texte normal.
    if hasattr(path_or_buffer, 'read'):
        path_or_buffer = io.StringIO(path_or_buffer.read().decode('utf-8'))
    # --- FIN DE LA CORRECTION ---

    try:  # tentative auto-détection du séparateur
        df = pd.read_csv(
            path_or_buffer,
            sep=None,
            engine="python",
            on_bad_lines="error",
        )
    except pd.errors.ParserError:
        # fallback : séparateur « ; » si l'auto-détection échoue
        # La ligne seek(0) est nécessaire si la première lecture a échoué sur un buffer
        if hasattr(path_or_buffer, 'seek'):
            path_or_buffer.seek(0)
        df = pd.read_csv(
            path_or_buffer,
            sep=";",
            engine="python",
            quoting=csv.QUOTE_MINIMAL,
            on_bad_lines="warn",
        )

    # harmonisation nom de la colonne espèces
    first_col = df.columns[0]
    if first_col != "Espece":
        df.rename(columns={first_col: "Espece"}, inplace=True)

    # conversions numériques + imputation des valeurs manquantes par la moyenne
    df.iloc[:, 1:] = df.iloc[:, 1:].apply(pd.to_numeric, errors="coerce")
    df.dropna(how="all", subset=df.columns[1:], inplace=True)
    df.iloc[:, 1:] = df.iloc[:, 1:].fillna(df.iloc[:, 1:].mean())

    return df


def analyse(df: pd.DataFrame, n_clusters: int = 3):
    """
    Standardise, clusterise (Ward) puis PCA 2 composantes
    Retourne : labels, pca, coords(n,2), X_standardisé
    """
    # Vérification qu'il y a des données numériques à analyser
    if df.shape[1] < 2:
        raise ValueError("Le DataFrame doit contenir au moins une colonne de données en plus de la colonne d'espèces.")
        
    X = StandardScaler().fit_transform(df.iloc[:, 1:])
    
    # S'assurer qu'il y a assez de données pour le clustering
    if X.shape[0] < n_clusters:
        # Si moins d'échantillons que de clusters demandés, on ajuste
        n_clusters = X.shape[0]

    labels = fcluster(linkage(X, method="ward"), n_clusters, criterion="maxclust")

    # S'assurer qu'il y a assez de features pour une PCA à 2 composantes
    n_components = min(2, X.shape[1])
    pca = PCA(n_components=n_components).fit(X)
    coords = pca.transform(X)
    
    # Si la PCA n'a qu'une composante, on ajoute une colonne de zéros pour le graphique 2D
    if coords.shape[1] < 2:
        coords = np.c_[coords, np.zeros(coords.shape[0])]

    return labels, pca, coords, X
