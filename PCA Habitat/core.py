"""
Fonctions de lecture + analyses
"""

import csv
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy.cluster.hierarchy import linkage, fcluster


def read_reference(path_or_buffer) -> pd.DataFrame:
    """Lecture CSV (détection automatique du séparateur) + nettoyage."""
    try:  # tentative auto-détection
        df = pd.read_csv(
            path_or_buffer,
            sep=None,
            engine="python",
            on_bad_lines="error",
        )
    except pd.errors.ParserError:
        # fallback : séparateur « ; »
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

    # conversions numériques + imputation
    df.iloc[:, 1:] = df.iloc[:, 1:].apply(pd.to_numeric, errors="coerce")
    df.dropna(how="all", subset=df.columns[1:], inplace=True)
    df.iloc[:, 1:] = df.iloc[:, 1:].fillna(df.iloc[:, 1:].mean())

    return df


def analyse(df: pd.DataFrame, n_clusters: int = 3):
    """
    Standardise, clusterise (Ward) puis PCA 2 composantes
    Retourne : labels, pca, coords(n,2), X_standardisé
    """
    X = StandardScaler().fit_transform(df.iloc[:, 1:])
    labels = fcluster(linkage(X, method="ward"), n_clusters, criterion="maxclust")

    pca = PCA(n_components=min(2, X.shape[1])).fit(X)
    coords = pca.transform(X)

    return labels, pca, coords, X
