from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
from collections import defaultdict

# Import existing functions
from core import analyse, read_reference

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

def normalize_species_name(species_name):
    if pd.isna(species_name) or str(species_name).strip() == "":
        return None
    return " ".join(str(species_name).strip().split()[:2]).lower()

def load_syntaxon_data(file_path="data_villaret.csv"):
    try:
        df = pd.read_csv(file_path, sep=';', header=None, encoding='utf-8-sig', keep_default_na=False, na_values=[''])
    except FileNotFoundError:
        return []
    processed = []
    for _, row in df.iterrows():
        if len(row) < 2:
            continue
        species_set = set()
        if len(row) > 2:
            for val in row.iloc[2:]:
                norm = normalize_species_name(val)
                if norm:
                    species_set.add(norm)
        processed.append({'species_set': species_set})
    return processed

def run_analysis_logic(ref_df, user_df):
    """Run PCA and co-occurrence analysis."""
    combined_df = pd.concat([
        ref_df.set_index('Espece'),
        user_df.set_index('Espece')
    ]).fillna(0)

    labels, pca, coords, X_std = analyse(combined_df, n_clusters=3)

    syntaxons = load_syntaxon_data(os.path.join(os.path.dirname(__file__), 'data_villaret.csv'))
    cooccurrence_results = []
    for sp in user_df['Espece'].unique():
        norm_sp = normalize_species_name(sp)
        if not norm_sp:
            continue
        co_counts = defaultdict(int)
        for syn in syntaxons:
            if norm_sp in syn['species_set']:
                for other_norm in syn['species_set']:
                    if other_norm != norm_sp:
                        co_counts[other_norm] += 1
        row = {'espece': sp}
        if co_counts:
            sorted_co = sorted(co_counts.items(), key=lambda x: x[1], reverse=True)
            for i in range(3):
                if i < len(sorted_co):
                    row[f'voisin_{i+1}'] = f"{sorted_co[i][0].capitalize()} - {sorted_co[i][1]}"
                else:
                    row[f'voisin_{i+1}'] = "-"
        else:
            for i in range(3):
                row[f'voisin_{i+1}'] = "-"
        cooccurrence_results.append(row)

    return {
        'pca_coordinates': coords.tolist(),
        'species_names': combined_df.index.tolist(),
        'cluster_labels': labels.tolist(),
        'cooccurrence_table': cooccurrence_results
    }

@app.post('/analyse/')
async def analyse_endpoint(ref_file: UploadFile = File(...), user_file: UploadFile = File(...)):
    """Endpoint receiving files and returning analysis results."""
    try:
        ref_df = read_reference(io.BytesIO(await ref_file.read()))
        user_df = read_reference(io.BytesIO(await user_file.read()))
        results = run_analysis_logic(ref_df, user_df)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse: {str(e)}")
