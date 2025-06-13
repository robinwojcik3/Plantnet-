import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from scipy.spatial import ConvexHull
import numpy as np
import textwrap # Importé pour la mise en forme du texte de survol
from collections import defaultdict # Ajouté pour l'analyse de co-occurrence
import re # Ajouté pour parser les comptes dans les chaînes de caractères
from sklearn.preprocessing import StandardScaler # Conservé au cas où, mais la logique principale utilisera les communalités PCA

# Définition de MockCoreModule améliorée pour simuler une ACP plus complète
class MockCoreModule:
    class MockPCA: # Classe interne pour simuler l'objet PCA
        def __init__(self, n_features_actual, n_components_to_simulate):
            if n_features_actual > 0 and n_components_to_simulate > 0:
                # Simuler les composantes (vecteurs propres)
                # Chaque colonne est un vecteur propre, chaque ligne une variable originale
                sim_components_t = np.random.rand(n_features_actual, n_components_to_simulate) 
                if sim_components_t.size > 0:
                    # Normaliser les vecteurs propres (optionnel mais bonne pratique pour certaines interprétations)
                    sim_components_t = sim_components_t / np.linalg.norm(sim_components_t, axis=0, keepdims=True)
                self.components_ = sim_components_t.T # components_ est (n_components, n_features)
                
                # Simuler la variance expliquée (valeurs propres)
                sim_explained_variance = np.sort(np.random.rand(n_components_to_simulate))[::-1] # Trié décroissant
                # S'assurer que la somme n'est pas nulle pour éviter la division par zéro
                if sim_explained_variance.sum() > 0:
                    # Ajuster pour que la variance expliquée soit plausible (ex: total < n_features)
                    sim_explained_variance = (sim_explained_variance / sim_explained_variance.sum()) * min(n_components_to_simulate, n_features_actual) * 0.7 
                else:
                    sim_explained_variance = np.zeros(n_components_to_simulate)
                self.explained_variance_ = sim_explained_variance
            else:
                self.components_ = np.array([])
                self.explained_variance_ = np.array([])

    def analyse(self, sub_df_prepared_for_core, n_clusters):
        print("MockCoreModule.analyse (version améliorée) appelée.")
        n_samples = len(sub_df_prepared_for_core)
        
        # Si pas d'échantillons ou pas de colonnes de traits (Espece + au moins 1 trait)
        if n_samples == 0 or sub_df_prepared_for_core.shape[1] <= 1:
            mock_pca_obj = self.MockPCA(n_features_actual=0, n_components_to_simulate=0)
            # X_scaled_data n'est plus utilisé activement par app.py pour le dendrogramme,
            # mais on le retourne pour la compatibilité de la signature si core.py le fait.
            return np.array([]), mock_pca_obj, pd.DataFrame(index=sub_df_prepared_for_core.index), np.array([]).reshape(0,1)

        # Exclure la colonne 'Espece' pour l'ACP, ne garder que les traits numériques
        numeric_cols_for_pca_df = sub_df_prepared_for_core.select_dtypes(include=np.number)
        n_features = numeric_cols_for_pca_df.shape[1]

        if n_features == 0: # Aucune colonne numérique pour l'ACP
            mock_pca_obj = self.MockPCA(n_features_actual=0, n_components_to_simulate=0)
            return np.array([]), mock_pca_obj, pd.DataFrame(index=sub_df_prepared_for_core.index), np.array([]).reshape(0,1)

        # Simuler les coordonnées PCA (généralement les 2 premières composantes pour un biplot)
        n_pcs_to_simulate_coords = min(2, n_features) 
        coords_array = np.random.rand(n_samples, n_pcs_to_simulate_coords) * 10 # Valeurs arbitraires
        pc_cols = [f"PC{i+1}" for i in range(coords_array.shape[1])]
        coords_df = pd.DataFrame(coords_array, columns=pc_cols, index=sub_df_prepared_for_core.index)

        # Simuler les labels de clustering
        labels = np.array([])
        if n_samples > 0 and n_clusters > 0:
            if n_samples < n_clusters : 
                labels = np.arange(n_samples) # Chaque échantillon est son propre cluster
            else:
                labels = np.random.randint(0, n_clusters, n_samples)
        
        # Simuler X_scaled (données standardisées) pour la compatibilité de la signature
        X_scaled_sim = np.array([]).reshape(n_samples, 0) 
        if not numeric_cols_for_pca_df.empty:
            # Standardisation simple
            X_scaled_temp_sim = (numeric_cols_for_pca_df - numeric_cols_for_pca_df.mean()) / numeric_cols_for_pca_df.std()
            X_scaled_sim = X_scaled_temp_sim.fillna(0).values 
        elif n_samples > 0 : # Si pas de traits numériques mais des échantillons, simuler avec une colonne
             X_scaled_sim = np.random.rand(n_samples, 1) 
        
        if X_scaled_sim.ndim == 1 and n_samples > 0 : # Assurer 2D si 1D
            X_scaled_sim = X_scaled_sim.reshape(-1,1)
        elif X_scaled_sim.size == 0 and n_samples == 0: # Cas où il n'y a aucun échantillon
             X_scaled_sim = np.array([]).reshape(0,n_features if n_features > 0 else 1)

        # Créer l'objet PCA simulé avec les composantes et variances expliquées
        # Le nombre de composantes simulées pour l'objet PCA peut être différent de celui pour les coords_df
        # Par exemple, on peut vouloir calculer les communalités sur plus de 2 PCs.
        n_pcs_for_pca_object = min(n_features, 5) # Simuler jusqu'à 5 PCs pour l'objet PCA
        mock_pca_obj = self.MockPCA(n_features_actual=n_features, n_components_to_simulate=n_pcs_for_pca_object)
        
        num_components_in_pca_obj = mock_pca_obj.components_.shape[0] if mock_pca_obj.components_.ndim == 2 else 0
        
        if num_components_in_pca_obj > 0 and coords_df.shape[1] > num_components_in_pca_obj :
            coords_df = coords_df.iloc[:, :num_components_in_pca_obj]
            new_pc_cols = [f"PC{i+1}" for i in range(num_components_in_pca_obj)]
            coords_df.columns = new_pc_cols
        elif num_components_in_pca_obj == 0 and not coords_df.empty: 
            coords_df = pd.DataFrame(index=sub_df_prepared_for_core.index) 

        return labels, mock_pca_obj, coords_df, X_scaled_sim


_real_core_imported = False
_core_module_usable = False
try:
    import core as actual_core_module 
    if hasattr(actual_core_module, "read_reference") and hasattr(actual_core_module, "analyse"):
        core = actual_core_module 
        _real_core_imported = True
        _core_module_usable = True 
    else:
        st.warning("Module 'core.py' trouvé mais semble incomplet. Simulation activée.")
        core = MockCoreModule() 
except ImportError:
    st.warning("Le module 'core.py' est introuvable. Simulation activée.")
    core = MockCoreModule() 


# ---------------------------------------------------------------------------- #
# CONFIGURATION UI
# ---------------------------------------------------------------------------- #
st.set_page_config(page_title="Analyse de Relevés Floristiques", layout="wide")
st.markdown("<h1 style='text-align: center;'>Analyse Interactive de Relevés Floristiques et Syntaxons</h1>", unsafe_allow_html=True)

st.markdown("""
<style>
/* Style général pour l'éditeur de données */
div[data-testid="stDataEditor"] {
    font-size: 14px;
}
div[data-testid="stDataEditor"] .glideDataEditor-header {
    font-size: 15px !important;
}
div[data-testid="stDataEditor"] table, 
div[data-testid="stDataEditor"] th, 
div[data-testid="stDataEditor"] td {
    font-size: 14px !important;
}

/* Style pour la première ligne du st.data_editor (noms des habitats) */
div[data-testid="stDataEditor"] .glideDataEditor-body .dvn-scroll-inner > div:first-child > div[data-cell^="[0,"] > div {
    background-color: #22272f !important; 
    color: #e1e1e1 !important;       
    font-weight: bold !important;
}
/* Style pour la cellule de la première ligne en mode édition */
div[data-testid="stDataEditor"] .glideDataEditor-body .dvn-scroll-inner > div:first-child > div[data-cell^="[0,"] > div > .gdg-input {
    background-color: #ffffff !important; 
    color: #000000 !important;       
    font-weight: normal !important;   
}

.habitat-select-button button, .syntaxon-select-button button { /* Ajout de .syntaxon-select-button */
    font-size: 13px !important;
    padding: 0.25rem 0.6rem !important; 
    line-height: 1.4;
    width: 100%; 
    border-radius: 0.5rem; 
    margin-bottom: 5px; /* Ajout d'un petit espace en bas des boutons de syntaxon */
}

/* Style pour les lignes verticales entre les colonnes de syntaxons à l'Étape 3 */
#syntaxon-display-area div[data-testid="stHorizontalBlock"] > div:not(:last-child) {
    border-right: 2px solid red;
    padding-right: 1rem; /* Espace pour la ligne et avant le contenu suivant */
    margin-right: 1rem; /* Espace supplémentaire pour mieux séparer visuellement */
}

</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------- #
# CONSTANTES ET CHARGEMENT DE DONNÉES INITIALES
# ---------------------------------------------------------------------------- #
MIN_POINTS_FOR_HULL = 3
COLOR_SEQUENCE = px.colors.qualitative.Plotly 
LABEL_FONT_SIZE_ON_PLOTS = 15 
HOVER_SPECIES_FONT_SIZE = 15  
HOVER_ECOLOGY_TITLE_FONT_SIZE = 14 
HOVER_ECOLOGY_TEXT_FONT_SIZE = 13  
CENTROID_MARKER_SIZE = 15 
SPECIES_MARKER_SIZE = 8   


@st.cache_data
def load_data(file_path="data_ref.csv"):
    data_loaded = None
    try:
        if hasattr(core, "read_reference"):
            data_loaded = core.read_reference(file_path)
            if _core_module_usable and not isinstance(core, MockCoreModule): 
                if data_loaded is not None and not data_loaded.empty:
                    pass 
                elif data_loaded is None or data_loaded.empty:
                    st.warning(f"core.py réel a retourné des données vides pour '{file_path}'.")
        else:
            st.error("Erreur inattendue: la variable 'core' n'a pas de fonction 'read_reference'.")
            raise AttributeError("'core.read_reference' non trouvée.")

        if data_loaded is None or data_loaded.empty:
            st.warning(f"Les données de '{file_path}' sont vides ou n'ont pu être lues (même par la simulation de core). Passage à la simulation interne.")
            raise ValueError("Données vides ou non chargées, utilisation de la simulation interne.")
        return data_loaded

    except (FileNotFoundError, ValueError, AttributeError, Exception) as e:
        if isinstance(e, FileNotFoundError) and _core_module_usable and not isinstance(core, MockCoreModule):
             st.error(f"ERREUR CRITIQUE (via core.py réel): Fichier de données de traits '{file_path}' non trouvé. Simulation interne activée.")
        elif isinstance(core, MockCoreModule) and isinstance(e, FileNotFoundError) :
             st.warning(f"MockCoreModule a tenté de lire '{file_path}'. Simulation interne activée (ceci peut être normal).")
        elif isinstance(e, (ValueError, AttributeError)):
             st.warning(f"Problème lors du chargement des données de traits depuis '{file_path}' ou données vides. Simulation interne activée. Détail: {e}")
        else: 
             st.error(f"Erreur inattendue lors du chargement de '{file_path}': {e}. Simulation interne activée.")

        st.warning(f"Activation de la simulation interne pour le chargement de '{file_path}'.")
        example_species_sim = [f"Espece Alpha (Sim interne) {i}" for i in range(1, 11)] + \
                              [f"Espece Beta (Sim interne) {i}" for i in range(1, 11)] + \
                              [f"Espece Gamma (Sim interne) {i}" for i in range(1, 11)]
        data_sim = pd.DataFrame({
            'Espece': example_species_sim,
            'Trait_Num_1': np.random.rand(30) * 10,
            'Trait_Num_2': np.random.randint(1, 100, 30),
            'Trait_Cat_1': np.random.choice(['X', 'Y', 'Z'], 30),
            'Humidité_édaphique': np.random.rand(30) * 5 + 1,
            'Matière_organique': np.random.rand(30) * 10,
            'Lumière': np.random.rand(30) * 1000,
            'CC Rhoméo': np.random.randint(0,5,30) 
        })
        data_sim.loc[len(data_sim)] = ['Rhamnus pumila (Sim interne)', 5.0, 50, 'X', 3, 5, 500, 2]
        data_sim.loc[len(data_sim)] = ['Vulpia sp. (Sim interne)', 2.0, 20, 'Y', 2, 2, 800, 4]
        
        if data_sim.empty: 
            st.error("La simulation interne des données de traits a également échoué. L'application risque de ne pas fonctionner.")
            return pd.DataFrame() 
        st.success("Données de référence chargées via simulation interne.")
        return data_sim

ref_original = load_data()
ref = ref_original.copy() 

if 'CC Rhoméo' in ref.columns:
    ref.rename(columns={'CC Rhoméo': 'Perturbation CC'}, inplace=True)
    ref['Perturbation CC'] = pd.to_numeric(ref['Perturbation CC'], errors='coerce')
elif 'Perturbation CC' not in ref.columns: 
    st.warning("La variable 'CC Rhoméo' (ou 'Perturbation CC') n'a pas été trouvée dans les données de référence.")


ref_binom_series = pd.Series(dtype='str')
if not ref.empty and 'Espece' in ref.columns:
    ref_binom_series = (
        ref["Espece"]
        .astype(str) 
        .str.split()
        .str[:2] 
        .str.join(" ")
        .str.lower() 
    )
else:
    if ref.empty:
        st.warning("Le DataFrame de référence 'ref' est vide après chargement/simulation. Impossible de créer 'ref_binom_series'.")
    elif 'Espece' not in ref.columns:
        st.warning("La colonne 'Espece' est manquante dans le DataFrame de référence 'ref' (même après simulation si applicable). Impossible de créer 'ref_binom_series'.")

def format_ecology_for_hover(text, line_width_chars=65):
    if pd.isna(text) or str(text).strip() == "":
        return "Description écologique non disponible."
    wrapped_lines = textwrap.wrap(str(text), width=line_width_chars) 
    return "<br>".join(wrapped_lines)

@st.cache_data
def load_ecology_data(file_path="data_ecologie_espece.csv"):
    try:
        eco_data = pd.read_csv(
            file_path, sep=';', header=None, usecols=[0, 1], 
            names=['Espece', 'Description_Ecologie'], encoding='utf-8-sig', 
            keep_default_na=False, na_values=[''] )
        eco_data = eco_data.dropna(subset=['Espece']) 
        eco_data['Espece'] = eco_data['Espece'].astype(str).str.strip() 
        eco_data = eco_data[eco_data['Espece'] != ""] 
        if eco_data.empty:
            st.warning(f"Le fichier écologique '{file_path}' est vide ou ne contient aucune donnée d'espèce valide.")
            return pd.DataFrame(columns=['Description_Ecologie']).set_index(pd.Index([], name='Espece_norm'))
        eco_data['Espece_norm'] = (eco_data['Espece'].str.split().str[:2].str.join(" ").str.lower())
        eco_data = eco_data.drop_duplicates(subset=['Espece_norm'], keep='first') 
        eco_data = eco_data.set_index('Espece_norm') 
        return eco_data[["Description_Ecologie"]] 
    except FileNotFoundError:
        print(f"AVERTISSEMENT: Fichier de données écologiques '{file_path}' non trouvé.")
        st.toast(f"Fichier écologique '{file_path}' non trouvé.", icon="⚠️")
        return pd.DataFrame(columns=['Description_Ecologie']).set_index(pd.Index([], name='Espece_norm'))
    except pd.errors.EmptyDataError: 
        st.warning(f"Le fichier écologique '{file_path}' est vide.")
        return pd.DataFrame(columns=['Description_Ecologie']).set_index(pd.Index([], name='Espece_norm'))
    except ValueError as ve: 
        print(f"AVERTISSEMENT: Erreur de valeur lors de la lecture du fichier '{file_path}'. Détails: {ve}.")
        st.toast(f"Erreur format fichier écologique '{file_path}'.", icon="🔥")
        return pd.DataFrame(columns=['Description_Ecologie']).set_index(pd.Index([], name='Espece_norm'))
    except Exception as e: 
        print(f"AVERTISSEMENT: Impossible de charger les données écologiques depuis '{file_path}': {e}.")
        st.toast(f"Erreur chargement fichier écologique.", icon=" ")
        return pd.DataFrame(columns=['Description_Ecologie']).set_index(pd.Index([], name='Espece_norm'))
ecology_df = load_ecology_data()

def normalize_species_name(species_name): 
    if pd.isna(species_name) or str(species_name).strip() == "": return None
    return " ".join(str(species_name).strip().split()[:2]).lower()

@st.cache_data
def load_syntaxon_data(file_path="data_villaret.csv"):
    try:
        df = pd.read_csv(file_path, sep=';', header=None, encoding='utf-8-sig', keep_default_na=False, na_values=[''])
        if df.empty:
            st.warning(f"Le fichier des syntaxons '{file_path}' est vide.")
            return []
        
        processed_syntaxons = []
        for index, row in df.iterrows():
            if len(row) < 2: 
                continue

            syntaxon_id = str(row.iloc[0]).strip()
            syntaxon_name_latin = str(row.iloc[1]).strip()
            syntaxon_description = "Description non disponible."
            species_start_index = 2 

            if len(row) > 2: 
                description_candidate = str(row.iloc[2]).strip()
                if len(description_candidate.split()) > 3 or len(description_candidate) > 50 : 
                    syntaxon_description = description_candidate
                    species_start_index = 3
                elif not any(char.isdigit() for char in description_candidate) and normalize_species_name(description_candidate) is None : 
                    syntaxon_description = description_candidate
                    species_start_index = 3


            species_in_row_set = set()
            if len(row) > species_start_index: 
                for species_cell_value in row.iloc[species_start_index:]:
                    normalized_species = normalize_species_name(species_cell_value)
                    if normalized_species:
                        species_in_row_set.add(normalized_species)
            
            if syntaxon_id and syntaxon_name_latin: 
                processed_syntaxons.append({
                    'id': syntaxon_id, 
                    'name_latin': syntaxon_name_latin, 
                    'description': syntaxon_description if syntaxon_description else "Description non disponible.",
                    'species_set': species_in_row_set
                })
        
        if not processed_syntaxons:
            st.warning(f"Aucun syntaxon (avec ID et Nom) n'a été trouvé dans '{file_path}'.")
        return processed_syntaxons
    except FileNotFoundError:
        st.error(f"ERREUR CRITIQUE: Fichier des syntaxons '{file_path}' non trouvé.")
        return []
    except pd.errors.EmptyDataError: 
        st.warning(f"Le fichier des syntaxons '{file_path}' est vide (EmptyDataError).")
        return []
    except Exception as e: 
        st.error(f"ERREUR CRITIQUE: Impossible de charger les données des syntaxons depuis '{file_path}': {e}")
        return []
syntaxon_data_list = load_syntaxon_data()

default_session_states = {
    'x_axis_trait_interactive': None, 'y_axis_trait_interactive': None,
    'run_main_processing_once': False, 'trait_exploration_df': pd.DataFrame(), 
    'trait_exploration_df_snapshot': pd.DataFrame(), 'sub': pd.DataFrame(), 
    'numeric_trait_names_for_interactive_plot': [], 'selected_habitats_indices': [], 
    'previous_num_cols': 0, 'processing_has_run_for_current_selection': False, 
    'top_matching_syntaxons': [], 'selected_syntaxon_ids': [],
    'pca_results_obj': None, 'coords_df_pca': pd.DataFrame(), 'labels_pca': np.array([])
}
for key, value in default_session_states.items():
    if key not in st.session_state: st.session_state[key] = value

if 'releves_df' not in st.session_state or not isinstance(st.session_state.releves_df, pd.DataFrame):
    num_placeholder_cols = 15; num_placeholder_rows_total = 11 
    header = [f"Habitat {j+1}" for j in range(num_placeholder_cols)] 
    placeholder_rows = [["" for _ in range(num_placeholder_cols)] for _ in range(num_placeholder_rows_total -1)]
    st.session_state.releves_df = pd.DataFrame([header] + placeholder_rows)
    st.session_state.releves_df.columns = [str(col) for col in st.session_state.releves_df.columns] 
    st.session_state.previous_num_cols = num_placeholder_cols

st.markdown("---"); st.subheader("Étape 1: Importation et Sélection des Relevés Floristiques")
st.info("Copiez-collez vos données de relevés. La première ligne = noms d'habitats. Lignes suivantes = espèces.")
if not all(isinstance(col, str) for col in st.session_state.releves_df.columns):
    st.session_state.releves_df.columns = [str(col) for col in st.session_state.releves_df.columns]
edited_releves_df_from_editor = st.data_editor(st.session_state.releves_df, num_rows="dynamic", use_container_width=True, key="releves_data_editor_key" )
if not edited_releves_df_from_editor.equals(st.session_state.releves_df):
    st.session_state.releves_df = edited_releves_df_from_editor.copy() 
    if len(st.session_state.releves_df.columns) != st.session_state.previous_num_cols:
        current_max_col_index = len(st.session_state.releves_df.columns) - 1
        st.session_state.selected_habitats_indices = [idx for idx in st.session_state.selected_habitats_indices if idx <= current_max_col_index]
        if not st.session_state.selected_habitats_indices: 
            st.session_state.processing_has_run_for_current_selection = False
            st.session_state.run_main_processing_once = False 
            st.session_state.selected_syntaxon_ids = [] 
        st.session_state.previous_num_cols = len(st.session_state.releves_df.columns) 
    st.rerun() 
current_releves_df_for_selection = st.session_state.releves_df.copy() 
if not current_releves_df_for_selection.empty and len(current_releves_df_for_selection.columns) > 0 and len(current_releves_df_for_selection) > 0:
    habitat_names_from_df = current_releves_df_for_selection.iloc[0].astype(str).tolist()
    num_actual_cols = len(current_releves_df_for_selection.columns) 
    st.markdown("**Cliquez sur le nom d'un habitat ci-dessous pour le sélectionner/désélectionner :**") 
    st.session_state.selected_habitats_indices = [idx for idx in st.session_state.selected_habitats_indices if idx < num_actual_cols]
    valid_habitat_buttons_info = []
    for i in range(num_actual_cols):
        species_in_col = current_releves_df_for_selection.iloc[1:, i].dropna().astype(str).str.strip().replace('', np.nan).dropna()
        if not species_in_col.empty: 
            habitat_name_for_button = habitat_names_from_df[i] if pd.notna(habitat_names_from_df[i]) and str(habitat_names_from_df[i]).strip() != "" else f"Relevé {i+1}"
            valid_habitat_buttons_info.append({'index': i, 'name': habitat_name_for_button})
    if valid_habitat_buttons_info: 
        num_buttons_to_show = len(valid_habitat_buttons_info)
        button_cols_layout = st.columns(num_buttons_to_show) 
        for k, habitat_info in enumerate(valid_habitat_buttons_info):
            col_idx = habitat_info['index']; habitat_name_display = habitat_info['name'] 
            is_selected = (col_idx in st.session_state.selected_habitats_indices) 
            button_type = "primary" if is_selected else "secondary"; button_key = f"habitat_select_button_{col_idx}" 
            with button_cols_layout[k]: 
                st.markdown(f'<div class="habitat-select-button">', unsafe_allow_html=True)
                if st.button(habitat_name_display, key=button_key, type=button_type, use_container_width=True):
                    if is_selected: st.session_state.selected_habitats_indices.remove(col_idx) 
                    else: st.session_state.selected_habitats_indices.append(col_idx) 
                    st.session_state.run_main_processing_once = False 
                    st.session_state.processing_has_run_for_current_selection = False 
                    st.session_state.selected_syntaxon_ids = [] 
                    st.rerun() 
                st.markdown('</div>', unsafe_allow_html=True)
    elif num_actual_cols > 0 : st.info("Aucune colonne ne contient de données d'espèces pour la sélection.")
    else: st.info("Ajoutez des colonnes au tableau pour pouvoir sélectionner des relevés.")
else: st.warning("Le tableau de données est vide ou ne contient pas de colonnes.")

if st.session_state.selected_habitats_indices and not ref.empty and not st.session_state.get('processing_has_run_for_current_selection', False): 
    st.session_state.run_main_processing_once = True 
    st.session_state.processing_has_run_for_current_selection = True 
    st.session_state.sub = pd.DataFrame(); st.session_state.trait_exploration_df = pd.DataFrame()
    st.session_state.numeric_trait_names_for_interactive_plot = []; st.session_state.top_matching_syntaxons = []
    st.session_state.pca_results_obj = None; st.session_state.coords_df_pca = pd.DataFrame(); st.session_state.labels_pca = np.array([])

    all_species_data_for_processing = []; species_not_found_in_ref_detailed = {} 
    df_for_species_extraction = st.session_state.releves_df.copy() 
    habitat_names_from_header = df_for_species_extraction.iloc[0].astype(str).tolist() if not df_for_species_extraction.empty else []
    for habitat_idx in st.session_state.selected_habitats_indices:
        if habitat_idx < len(df_for_species_extraction.columns): 
            habitat_name = habitat_names_from_header[habitat_idx] if habitat_idx < len(habitat_names_from_header) and pd.notna(habitat_names_from_header[habitat_idx]) and str(habitat_names_from_header[habitat_idx]).strip() != "" else f"Relevé {habitat_idx+1}"
            species_in_col_series = df_for_species_extraction.iloc[1:, habitat_idx]
            species_raw_in_current_habitat = species_in_col_series.dropna().astype(str).str.strip().replace('', np.nan).dropna().tolist()
            species_not_found_in_ref_detailed[habitat_name] = [] 
            if not species_raw_in_current_habitat: st.warning(f"Aucune espèce listée dans l'habitat sélectionné : {habitat_name}"); continue 
            for raw_species_name in species_raw_in_current_habitat:
                if not raw_species_name or len(raw_species_name.split()) == 0: continue
                binom_species_name = normalize_species_name(raw_species_name) 
                if not ref_binom_series.empty: 
                    match_in_ref = ref_binom_series[ref_binom_series == binom_species_name]
                    if not match_in_ref.empty: 
                        ref_idx = match_in_ref.index[0]
                        trait_data = ref.loc[ref_idx].to_dict() 
                        trait_data['Source_Habitat'] = habitat_name
                        trait_data['Espece_Ref_Original'] = ref_original.loc[ref_idx, 'Espece']
                        trait_data['Espece_User_Input_Raw'] = raw_species_name 
                        normalized_ref_for_eco = normalize_species_name(trait_data['Espece_Ref_Original'])
                        if not ecology_df.empty and normalized_ref_for_eco in ecology_df.index:
                             trait_data['Ecologie_raw'] = ecology_df.loc[normalized_ref_for_eco, 'Description_Ecologie']
                        else: trait_data['Ecologie_raw'] = None 
                        trait_data['Ecologie'] = format_ecology_for_hover(trait_data['Ecologie_raw'])
                        all_species_data_for_processing.append(trait_data)
                    else: species_not_found_in_ref_detailed[habitat_name].append(raw_species_name)
                else: species_not_found_in_ref_detailed[habitat_name].append(raw_species_name)
    
    if not all_species_data_for_processing: 
        st.error("Aucune espèce valide correspondante aux traits n'a été trouvée."); st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False 
    else: 
        st.session_state.sub = pd.DataFrame(all_species_data_for_processing); st.session_state.sub.reset_index(drop=True, inplace=True) 
        for habitat_name, not_found_list in species_not_found_in_ref_detailed.items():
            if not_found_list: st.warning(f"Espèces de '{habitat_name}' non trouvées: " + ", ".join(not_found_list), icon="⚠️")
        
        if st.session_state.sub.empty: 
            st.error("Aucune espèce avec traits. Traitement impossible."); st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False;
        elif st.session_state.sub.shape[0] < 1: 
            st.error(f"Au moins 1 instance d'espèce nécessaire. {st.session_state.sub.shape[0]} trouvée(s)."); st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False;
        else:
            try:
                numeric_trait_names_from_ref = ref.select_dtypes(include=np.number).columns.tolist()
                if 'Espece' in numeric_trait_names_from_ref: numeric_trait_names_from_ref.remove('Espece')

                actual_numeric_traits_for_pca = [
                    trait for trait in numeric_trait_names_from_ref 
                    if trait in st.session_state.sub.columns and pd.to_numeric(st.session_state.sub[trait], errors='coerce').notna().any()
                ]

                if not actual_numeric_traits_for_pca or st.session_state.sub[actual_numeric_traits_for_pca].dropna().empty:
                    st.error("Pas assez de données numériques valides pour l'ACP après filtrage des NaN.")
                    st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False;
                else:
                    sub_for_core = st.session_state.sub[['Espece_Ref_Original'] + actual_numeric_traits_for_pca].copy()
                    sub_for_core.rename(columns={'Espece_Ref_Original': 'Espece'}, inplace=True)
                    
                    for trait in actual_numeric_traits_for_pca:
                        sub_for_core[trait] = pd.to_numeric(sub_for_core[trait], errors='coerce')
                        if sub_for_core[trait].isnull().any():
                             sub_for_core[trait].fillna(sub_for_core[trait].mean(), inplace=True)
                    
                    if sub_for_core[actual_numeric_traits_for_pca].isnull().any().any():
                        st.error("Des valeurs manquantes subsistent dans les traits numériques après imputation. ACP impossible.")
                        st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False;
                    else:
                        n_clusters_main = 3 
                        labels, pca_obj, coords_df, _ = core.analyse(sub_for_core, n_clusters_main)
                        
                        st.session_state.pca_results_obj = pca_obj
                        st.session_state.coords_df_pca = coords_df
                        st.session_state.labels_pca = labels
                        st.session_state.numeric_trait_names_for_interactive_plot = actual_numeric_traits_for_pca

                        communalities_data = []
                        if hasattr(pca_obj, 'components_') and hasattr(pca_obj, 'explained_variance_') and \
                           isinstance(pca_obj.components_, np.ndarray) and pca_obj.components_.size > 0 and \
                           isinstance(pca_obj.explained_variance_, np.ndarray) and pca_obj.explained_variance_.size > 0 and \
                           pca_obj.components_.shape[1] == len(actual_numeric_traits_for_pca): 

                            loadings = pca_obj.components_.T * np.sqrt(pca_obj.explained_variance_)
                            communal = (loadings**2).sum(axis=1)
                            communal_percent = (communal * 100).round(0).astype(int) 
                            communal_percent_clipped = np.clip(communal_percent, 0, 100)

                            for trait_name, com_val in zip(actual_numeric_traits_for_pca, communal_percent_clipped):
                                communalities_data.append({"Variable": trait_name, "Communalité (%)": com_val})
                        else:
                            st.warning("Résultats PCA incomplets. Communalités approximées par variance simple.")
                            scaler = StandardScaler()
                            # S'assurer que les données sont bien numériques avant scaling
                            sub_numeric_for_fallback = st.session_state.sub[actual_numeric_traits_for_pca].apply(pd.to_numeric, errors='coerce').fillna(0)
                            if not sub_numeric_for_fallback.empty:
                                scaled_traits_fallback = scaler.fit_transform(sub_numeric_for_fallback)
                                variances_fallback = np.var(scaled_traits_fallback, axis=0)
                                total_variance_fallback = np.sum(variances_fallback)
                                if total_variance_fallback > 0:
                                    for i, trait_name in enumerate(actual_numeric_traits_for_pca):
                                        contribution = (variances_fallback[i] / total_variance_fallback) * 100
                                        communalities_data.append({"Variable": trait_name, "Communalité (%)": contribution})
                                else: 
                                    for trait_name in actual_numeric_traits_for_pca:
                                        communalities_data.append({"Variable": trait_name, "Communalité (%)": 0.0})
                            else: # Si sub_numeric_for_fallback est vide
                                for trait_name in actual_numeric_traits_for_pca:
                                    communalities_data.append({"Variable": trait_name, "Communalité (%)": 0.0})


                        communalities_df_sorted = pd.DataFrame(communalities_data).sort_values("Communalité (%)", ascending=False)
                        
                        exploration_df_data = []
                        for _, row in communalities_df_sorted.iterrows():
                            exploration_df_data.append({
                                "Variable": row["Variable"], 
                                "Communalité (%)": row["Communalité (%)"], 
                                "Axe X": False, 
                                "Axe Y": False
                            })
                        st.session_state.trait_exploration_df = pd.DataFrame(exploration_df_data)

                        default_x_init, default_y_init = None, None
                        if len(communalities_df_sorted) > 0:
                            default_x_init = communalities_df_sorted.iloc[0]["Variable"]
                        if len(communalities_df_sorted) > 1:
                            default_y_init = communalities_df_sorted.iloc[1]["Variable"]
                        elif default_x_init: 
                            default_y_init = default_x_init
                        
                        st.session_state.x_axis_trait_interactive = default_x_init
                        st.session_state.y_axis_trait_interactive = default_y_init

                        if not st.session_state.trait_exploration_df.empty:
                            st.session_state.trait_exploration_df["Axe X"] = (st.session_state.trait_exploration_df["Variable"] == default_x_init)
                            st.session_state.trait_exploration_df["Axe Y"] = (st.session_state.trait_exploration_df["Variable"] == default_y_init)
                        
                        st.session_state.trait_exploration_df_snapshot = st.session_state.trait_exploration_df.copy()

            except Exception as e: 
                st.error(f"Erreur lors du traitement principal ou de l'analyse PCA: {e}"); st.exception(e)
                st.session_state.run_main_processing_once = False; st.session_state.processing_has_run_for_current_selection = False;

elif not st.session_state.selected_habitats_indices and not ref.empty: 
    st.info("Sélectionnez habitat(s) à l'Étape 1.")
elif ref.empty: 
    st.warning("Données de référence non chargées/simulées. Traitement désactivé si données réelles manquantes.")


# ÉTAPE 2: EXPLORATION INTERACTIVE DES TRAITS
if st.session_state.run_main_processing_once and not st.session_state.get('sub', pd.DataFrame()).empty: 
    st.markdown("---"); st.subheader("Étape 2: Exploration Interactive des Traits")
    col_interactive_table, col_interactive_graph = st.columns([1, 2]) 
    
    with col_interactive_table: 
        st.markdown("##### Sélection des traits pour le graphique")
        df_editor_source_interactive = st.session_state.get('trait_exploration_df', pd.DataFrame())
        if not df_editor_source_interactive.empty:
            # S'assurer que le snapshot est à jour si la structure des colonnes change ou si le contenu a changé (ex: recalcul des communalités)
            if 'trait_exploration_df_snapshot' not in st.session_state or \
               list(st.session_state.get('trait_exploration_df_snapshot', pd.DataFrame()).columns) != list(df_editor_source_interactive.columns) or \
               not st.session_state.trait_exploration_df_snapshot.equals(df_editor_source_interactive) : 
                st.session_state.trait_exploration_df_snapshot = df_editor_source_interactive.copy()

            edited_df_interactive = st.data_editor(
                df_editor_source_interactive, 
                column_config={
                    "Variable": st.column_config.TextColumn("Trait disponible", disabled=True), 
                    "Communalité (%)": st.column_config.NumberColumn("Communalité (%)", format="%.0f%%", disabled=True), # Format entier pour %
                    "Axe X": st.column_config.CheckboxColumn("Axe X"), 
                    "Axe Y": st.column_config.CheckboxColumn("Axe Y")
                }, 
                key="interactive_trait_exploration_editor_key", # Clé unique
                use_container_width=True, 
                hide_index=True, 
                num_rows="fixed"
            )
            made_change_in_interactive_axes = False 
            current_x_selection_from_state = st.session_state.x_axis_trait_interactive
            x_vars_checked_in_editor = edited_df_interactive[edited_df_interactive["Axe X"]]["Variable"].tolist()
            new_x_selection_candidate = current_x_selection_from_state 
            if not x_vars_checked_in_editor: 
                if current_x_selection_from_state is not None: new_x_selection_candidate = None; made_change_in_interactive_axes = True
            elif len(x_vars_checked_in_editor) == 1: 
                if x_vars_checked_in_editor[0] != current_x_selection_from_state: new_x_selection_candidate = x_vars_checked_in_editor[0]; made_change_in_interactive_axes = True
            else: 
                potential_new_x = [v for v in x_vars_checked_in_editor if v != current_x_selection_from_state]
                new_x_selection_candidate = potential_new_x[0] if potential_new_x else x_vars_checked_in_editor[-1]; made_change_in_interactive_axes = True
            st.session_state.x_axis_trait_interactive = new_x_selection_candidate
            
            current_y_selection_from_state = st.session_state.y_axis_trait_interactive
            y_vars_checked_in_editor = edited_df_interactive[edited_df_interactive["Axe Y"]]["Variable"].tolist()
            new_y_selection_candidate = current_y_selection_from_state 
            if not y_vars_checked_in_editor: 
                if current_y_selection_from_state is not None: new_y_selection_candidate = None; made_change_in_interactive_axes = True
            elif len(y_vars_checked_in_editor) == 1: 
                if y_vars_checked_in_editor[0] != current_y_selection_from_state: new_y_selection_candidate = y_vars_checked_in_editor[0]; made_change_in_interactive_axes = True
            else: 
                potential_new_y = [v for v in y_vars_checked_in_editor if v != current_y_selection_from_state]
                new_y_selection_candidate = potential_new_y[0] if potential_new_y else y_vars_checked_in_editor[-1]; made_change_in_interactive_axes = True
            st.session_state.y_axis_trait_interactive = new_y_selection_candidate
            
            if made_change_in_interactive_axes:
                df_updated_for_editor = df_editor_source_interactive.copy() 
                df_updated_for_editor["Axe X"] = (df_updated_for_editor["Variable"] == st.session_state.x_axis_trait_interactive)
                df_updated_for_editor["Axe Y"] = (df_updated_for_editor["Variable"] == st.session_state.y_axis_trait_interactive)
                st.session_state.trait_exploration_df = df_updated_for_editor 
                st.session_state.trait_exploration_df_snapshot = df_updated_for_editor.copy(); st.rerun() 
            elif not edited_df_interactive.equals(st.session_state.trait_exploration_df_snapshot): 
                   st.session_state.trait_exploration_df_snapshot = edited_df_interactive.copy() 
        else: st.info("Tableau de sélection des traits disponible après traitement si traits numériques identifiés.")

    with col_interactive_graph: 
        st.markdown("##### Graphique d'exploration des traits")
        x_axis_plot = st.session_state.x_axis_trait_interactive; y_axis_plot = st.session_state.y_axis_trait_interactive 
        sub_plot_releve = st.session_state.get('sub', pd.DataFrame()) 
        selected_syntaxon_ids_for_plot = st.session_state.get('selected_syntaxon_ids', [])
        syntaxons_to_plot_data = [s for s in st.session_state.get('top_matching_syntaxons', []) if s['id'] in selected_syntaxon_ids_for_plot]
        
        all_plot_data_list = []
        species_plot_data_list = []

        if not sub_plot_releve.empty and x_axis_plot and y_axis_plot and \
           x_axis_plot in sub_plot_releve.columns and y_axis_plot in sub_plot_releve.columns:
            required_cols_releve = ['Espece_User_Input_Raw', 'Ecologie', 'Source_Habitat']
            if all(col in sub_plot_releve.columns for col in required_cols_releve):
                cols_for_releve_plot = [x_axis_plot, y_axis_plot] + required_cols_releve
                if all(col in sub_plot_releve.columns for col in cols_for_releve_plot):
                    releve_plot_df_species = sub_plot_releve[cols_for_releve_plot].copy()
                    releve_plot_df_species['Source_Donnee'] = 'Relevé Utilisateur'
                    releve_plot_df_species['Nom_Affichage'] = releve_plot_df_species['Espece_User_Input_Raw']
                    releve_plot_df_species['Groupe_Affichage'] = releve_plot_df_species['Source_Habitat'] 
                    releve_plot_df_species['Symbole'] = 'circle'
                    releve_plot_df_species['marker_size'] = SPECIES_MARKER_SIZE
                    species_plot_data_list.append(releve_plot_df_species)
                else:
                    st.warning(f"Certaines colonnes pour le graphique des relevés sont manquantes dans 'sub_plot_releve': {x_axis_plot}, {y_axis_plot}")


        if syntaxons_to_plot_data and not ref.empty and 'Espece' in ref.columns and x_axis_plot and y_axis_plot:
            for i, syntaxon_info in enumerate(syntaxons_to_plot_data): 
                syntaxon_name_for_graph = syntaxon_info.get('name_latin_short', f"Syntaxon {syntaxon_info.get('id', i+1)}")
                current_syntaxon_species_list = []
                for species_norm in syntaxon_info.get('species_set', []):
                    match_in_ref = ref[ref_binom_series == species_norm] 
                    if not match_in_ref.empty:
                        ref_idx = match_in_ref.index[0]; 
                        trait_data_syntaxon_sp = ref.loc[ref_idx].to_dict() 
                        
                        if x_axis_plot in trait_data_syntaxon_sp and y_axis_plot in trait_data_syntaxon_sp:
                            eco_desc_raw = ecology_df.loc[species_norm, 'Description_Ecologie'] if not ecology_df.empty and species_norm in ecology_df.index else None
                            espece_original_name_for_display = ref_original.loc[ref_idx, 'Espece'] if ref_idx in ref_original.index else species_norm.capitalize()

                            current_syntaxon_species_list.append({
                                x_axis_plot: trait_data_syntaxon_sp[x_axis_plot], 
                                y_axis_plot: trait_data_syntaxon_sp[y_axis_plot],
                                'Espece_User_Input_Raw': espece_original_name_for_display, 
                                'Ecologie': format_ecology_for_hover(eco_desc_raw),
                                'Source_Habitat': syntaxon_name_for_graph, 
                                'Source_Donnee': f"Syntaxon: {syntaxon_name_for_graph}",
                                'Nom_Affichage': espece_original_name_for_display, 
                                'Groupe_Affichage': f"Syntaxon: {syntaxon_name_for_graph}",
                                'Symbole': 'triangle-up', 
                                'marker_size': SPECIES_MARKER_SIZE 
                            })
                if current_syntaxon_species_list: 
                    species_plot_data_list.append(pd.DataFrame(current_syntaxon_species_list))
        
        if species_plot_data_list:
            final_species_df = pd.concat(species_plot_data_list, ignore_index=True).dropna(subset=[x_axis_plot, y_axis_plot]) 
            
            if not final_species_df.empty:
                plot_data_for_species_jitter = final_species_df.copy()
                temp_x_col_grp = "_temp_x_species"; temp_y_col_grp = "_temp_y_species"
                plot_data_for_species_jitter[temp_x_col_grp] = plot_data_for_species_jitter[x_axis_plot]
                plot_data_for_species_jitter[temp_y_col_grp] = plot_data_for_species_jitter[y_axis_plot]
                duplicates_mask_species = plot_data_for_species_jitter.duplicated(subset=[temp_x_col_grp, temp_y_col_grp], keep=False)
                if duplicates_mask_species.any():
                    x_min_s, x_max_s = plot_data_for_species_jitter[x_axis_plot].min(), plot_data_for_species_jitter[x_axis_plot].max()
                    y_min_s, y_max_s = plot_data_for_species_jitter[y_axis_plot].min(), plot_data_for_species_jitter[y_axis_plot].max()
                    x_range_s = (x_max_s - x_min_s) if pd.notna(x_max_s) and pd.notna(x_min_s) and (x_max_s - x_min_s) > 0 else 1.0
                    y_range_s = (y_max_s - y_min_s) if pd.notna(y_max_s) and pd.notna(y_min_s) and (y_max_s - y_min_s) > 0 else 1.0
                    
                    jitter_x_val_s = x_range_s*0.015 
                    jitter_y_val_s = y_range_s*0.015 

                    if abs(jitter_x_val_s) <1e-9: jitter_x_val_s=0.015 
                    if abs(jitter_y_val_s) <1e-9: jitter_y_val_s=0.015

                    for _, group_df_s in plot_data_for_species_jitter[duplicates_mask_species].groupby([temp_x_col_grp, temp_y_col_grp]):
                        if len(group_df_s) > 1: 
                            if not pd.api.types.is_float_dtype(plot_data_for_species_jitter[x_axis_plot]): plot_data_for_species_jitter[x_axis_plot] = plot_data_for_species_jitter[x_axis_plot].astype(float)
                            if not pd.api.types.is_float_dtype(plot_data_for_species_jitter[y_axis_plot]): plot_data_for_species_jitter[y_axis_plot] = plot_data_for_species_jitter[y_axis_plot].astype(float)
                            for i_jitter_s, idx_jitter_s in enumerate(group_df_s.index): 
                                angle_s = 2 * np.pi * i_jitter_s / len(group_df_s) 
                                plot_data_for_species_jitter.loc[idx_jitter_s, x_axis_plot] += jitter_x_val_s * np.cos(angle_s)
                                plot_data_for_species_jitter.loc[idx_jitter_s, y_axis_plot] += jitter_y_val_s * np.sin(angle_s)
                plot_data_for_species_jitter.drop(columns=[temp_x_col_grp, temp_y_col_grp], inplace=True)
                all_plot_data_list.append(plot_data_for_species_jitter)
                
                centroid_data_list = []
                if x_axis_plot and y_axis_plot:
                    for group_label_centroid in final_species_df["Groupe_Affichage"].unique():
                        group_data_orig = final_species_df[final_species_df["Groupe_Affichage"] == group_label_centroid]
                        if not group_data_orig.empty and x_axis_plot in group_data_orig.columns and y_axis_plot in group_data_orig.columns:
                            mean_x = group_data_orig[x_axis_plot].mean()
                            mean_y = group_data_orig[y_axis_plot].mean()
                            if pd.notna(mean_x) and pd.notna(mean_y): 
                                centroid_data_list.append({
                                    x_axis_plot: mean_x, y_axis_plot: mean_y,
                                    'Groupe_Affichage': group_label_centroid,
                                    'Nom_Affichage': f"Centroïde {group_label_centroid}",
                                    'Symbole': 'circle-cross-open', 
                                    'marker_size': CENTROID_MARKER_SIZE, 
                                    'Source_Donnee': "Centroïde", 
                                    'Ecologie': "Centre de gravité du groupe", 
                                    'Source_Habitat': group_label_centroid 
                                })
                if centroid_data_list:
                    all_plot_data_list.append(pd.DataFrame(centroid_data_list))
            else: 
                 st.info("Aucune donnée d'espèce valide à afficher sur le graphique après suppression des valeurs manquantes pour les axes sélectionnés.")


        if all_plot_data_list:
            plot_data_to_use = pd.concat(all_plot_data_list, ignore_index=True)
            if not plot_data_to_use.empty and x_axis_plot in plot_data_to_use.columns and y_axis_plot in plot_data_to_use.columns:
                unique_groups_fig = sorted(plot_data_to_use["Groupe_Affichage"].unique())
                extended_color_sequence_fig = COLOR_SEQUENCE * (len(unique_groups_fig) // len(COLOR_SEQUENCE) + 1)
                group_color_map_fig = {
                    group_label: extended_color_sequence_fig[i % len(extended_color_sequence_fig)]
                    for i, group_label in enumerate(unique_groups_fig)
                }

                fig_interactive = px.scatter(plot_data_to_use, x=x_axis_plot, y=y_axis_plot, 
                                             color="Groupe_Affichage", 
                                             color_discrete_map=group_color_map_fig, 
                                             symbol='Symbole', size='marker_size',
                                             text="Nom_Affichage", hover_name="Nom_Affichage", 
                                             custom_data=["Nom_Affichage", "Ecologie", "Source_Habitat", "Source_Donnee"], 
                                             template="plotly_dark", height=600,
                                             size_max=CENTROID_MARKER_SIZE + 5) 
                
                fig_interactive.update_traces(textposition="top center", 
                                              marker=dict(opacity=0.8, line=dict(width=0.5, color='DarkSlateGrey')), 
                                              textfont=dict(size=LABEL_FONT_SIZE_ON_PLOTS), 
                                              hovertemplate=(f"<span style='font-size: {HOVER_SPECIES_FONT_SIZE}px;'><b>%{{customdata[0]}}</b></span><br>Source: %{{customdata[3]}}<br>Habitat/Syntaxon: %{{customdata[2]}}<br><br><span style='font-size: {HOVER_ECOLOGY_TITLE_FONT_SIZE}px;'><i>Écologie:</i></span><br><span style='font-size: {HOVER_ECOLOGY_TEXT_FONT_SIZE}px;'>%{{customdata[1]}}</span><extra></extra>" ))
                
                for trace in fig_interactive.data: 
                    if trace.name in group_color_map_fig: 
                        if hasattr(trace.marker, 'symbol') and trace.marker.symbol == 'circle-cross-open': 
                            trace.marker.line.color = group_color_map_fig[trace.name] 
                            trace.marker.line.width = 2 

                if 'plot_data_for_species_jitter' in locals() and not plot_data_for_species_jitter.empty:
                    unique_groups_for_hulls = sorted(plot_data_for_species_jitter["Groupe_Affichage"].unique())
                    for grp_lbl_hull in unique_groups_for_hulls: 
                        grp_df_hull = plot_data_for_species_jitter[plot_data_for_species_jitter["Groupe_Affichage"] == grp_lbl_hull]
                        if x_axis_plot in grp_df_hull and y_axis_plot in grp_df_hull:
                            hull_pts_raw = grp_df_hull[[x_axis_plot, y_axis_plot]].dropna().drop_duplicates()
                            if not hull_pts_raw.empty:
                                hull_pts = hull_pts_raw.values
                                if len(hull_pts) >= MIN_POINTS_FOR_HULL: 
                                    try:
                                        hull = ConvexHull(hull_pts); hull_path_data = hull_pts[np.append(hull.vertices, hull.vertices[0])]
                                        hull_clr = group_color_map_fig.get(grp_lbl_hull, COLOR_SEQUENCE[0]) 
                                        fig_interactive.add_trace(go.Scatter(x=hull_path_data[:, 0], y=hull_path_data[:, 1], 
                                                                             fill="toself", fillcolor=hull_clr, 
                                                                             line=dict(color=hull_clr, width=1.5), 
                                                                             mode='lines', name=f'{grp_lbl_hull} Hull', opacity=0.2, 
                                                                             showlegend=False, hoverinfo='skip' ))
                                    except Exception as e_hull: print(f"Erreur Hull {grp_lbl_hull}: {e_hull}")
                fig_interactive.update_layout(title_text=f"{y_axis_plot} vs. {x_axis_plot}", title_x=0.5, 
                                              xaxis_title=x_axis_plot, yaxis_title=y_axis_plot, 
                                              dragmode='pan', legend_title_text="Groupe" )
                st.plotly_chart(fig_interactive, use_container_width=True, config={'scrollZoom': True})
            else:
                st.info("Aucune donnée à afficher sur le graphique pour les axes sélectionnés.")
        else: st.info("Préparez les données et sélectionnez les axes pour afficher le graphique interactif.")
elif st.session_state.run_main_processing_once and st.session_state.get('sub', pd.DataFrame()).empty :
    st.markdown("---"); st.subheader("Étape 2: Exploration Interactive des Traits")
    st.warning("Traitement principal sans données suffisantes pour cette section.")

# ÉTAPE 3: IDENTIFICATION ET SÉLECTION DES SYNTAXONS PERTINENTS
if st.session_state.run_main_processing_once and not st.session_state.get('sub', pd.DataFrame()).empty and syntaxon_data_list:
    st.markdown("---"); st.subheader("Étape 3: Identification et Sélection des Syntaxons Pertinents")
    
    st.markdown('<div id="syntaxon-display-area">', unsafe_allow_html=True)

    releve_species_normalized = set(normalize_species_name(sp) for sp in st.session_state.sub['Espece_Ref_Original'].unique()); releve_species_normalized.discard(None) 
    if not releve_species_normalized: st.warning("Aucune espèce normalisée issue des relevés pour comparaison.")
    else:
        syntaxon_matches = []
        for syntaxon in syntaxon_data_list:
            common_species = releve_species_normalized.intersection(syntaxon['species_set'])
            score = len(common_species) 
            if score > 0: 
                syntaxon_matches.append({
                    'id': syntaxon['id'], 
                    'name_latin': syntaxon['name_latin'], 
                    'name_latin_short': ' '.join(syntaxon['name_latin'].split()[:3]), 
                    'description': syntaxon.get('description', "Description non disponible."), 
                    'species_set': syntaxon['species_set'], 
                    'common_species_set': common_species, 
                    'score': score
                })
        sorted_syntaxons = sorted(syntaxon_matches, key=lambda x: (-x['score'], x['name_latin']))
        st.session_state.top_matching_syntaxons = sorted_syntaxons[:5] 

        if not st.session_state.top_matching_syntaxons: st.info("Aucun syntaxon correspondant trouvé (avec au moins une espèce en commun).")
        else:
            st.markdown(f"Cliquez sur un syntaxon pour le sélectionner/désélectionner pour le graphique de l'Étape 2.")
            st.markdown(f"Les **{len(st.session_state.top_matching_syntaxons)} syntaxons les plus probables** sont :")
            
            valid_top_syntaxon_ids = {s['id'] for s in st.session_state.top_matching_syntaxons}
            st.session_state.selected_syntaxon_ids = [sid for sid in st.session_state.selected_syntaxon_ids if sid in valid_top_syntaxon_ids]

            num_syntaxons_to_show = len(st.session_state.top_matching_syntaxons)
            cols_syntaxon_display = st.columns(num_syntaxons_to_show if num_syntaxons_to_show > 0 else 1)
            
            selection_changed_in_syntaxons = False
            for i, matched_syntaxon in enumerate(st.session_state.top_matching_syntaxons):
                with cols_syntaxon_display[i % num_syntaxons_to_show if num_syntaxons_to_show > 0 else 0]:
                    is_syntaxon_selected = matched_syntaxon['id'] in st.session_state.selected_syntaxon_ids
                    button_syntaxon_type = "primary" if is_syntaxon_selected else "secondary"
                    button_syntaxon_label = f"{matched_syntaxon.get('name_latin_short', matched_syntaxon['id'])} ({matched_syntaxon['score']})"
                    
                    st.markdown(f'<div class="syntaxon-select-button">', unsafe_allow_html=True)
                    if st.button(button_syntaxon_label, key=f"syntaxon_select_{matched_syntaxon['id']}", type=button_syntaxon_type, use_container_width=True):
                        if is_syntaxon_selected:
                            st.session_state.selected_syntaxon_ids.remove(matched_syntaxon['id'])
                        else:
                            st.session_state.selected_syntaxon_ids.append(matched_syntaxon['id'])
                        selection_changed_in_syntaxons = True
                    st.markdown('</div>', unsafe_allow_html=True)
                    
                    st.markdown(f"**{matched_syntaxon['id']}**")
                    st.markdown(f"*{matched_syntaxon['name_latin']}*")
                    st.caption(matched_syntaxon.get('description', "Description non disponible."))

                    present_species_set = matched_syntaxon['common_species_set']
                    all_syntaxon_species_set = matched_syntaxon['species_set']
                    absent_species_set = all_syntaxon_species_set.difference(present_species_set)

                    col_present, col_absent = st.columns(2)

                    with col_present:
                        st.markdown(f"**{len(present_species_set)} Taxons Présents**")
                        if present_species_set:
                            html_present_list = "<ul>"
                            for species_name_norm in sorted(list(present_species_set)):
                                species_display_name = species_name_norm.capitalize()
                                html_present_list += f"<li>{species_display_name}</li>"
                            html_present_list += "</ul>"
                            st.markdown(html_present_list, unsafe_allow_html=True)
                        else:
                            st.markdown("_(Aucun)_")
                    
                    with col_absent:
                        st.markdown(f"**{len(absent_species_set)} Taxons Absents**")
                        if absent_species_set:
                            html_absent_list = "<ul>"
                            for species_name_norm in sorted(list(absent_species_set)):
                                species_display_name = species_name_norm.capitalize()
                                html_absent_list += f"<li>{species_display_name}</li>"
                            html_absent_list += "</ul>"
                            st.markdown(html_absent_list, unsafe_allow_html=True)
                        else:
                            st.markdown("_(Aucun)_")
            
            if selection_changed_in_syntaxons: st.rerun()
    
    st.markdown('</div>', unsafe_allow_html=True) # Close syntaxon-display-area

elif st.session_state.run_main_processing_once and not syntaxon_data_list:
    st.markdown("---"); st.subheader("Étape 3: Identification et Sélection des Syntaxons Pertinents")
    st.warning("Données des syntaxons non chargées/vides. Identification impossible.")

# ÉTAPE 4: ANALYSE DES CO-OCCURRENCES D'ESPÈCES
def style_cooccurrence_row_parsing(row, max_overall_count, vmin_count=1):
    styles = pd.Series('', index=row.index); color_start_rgb = (40,40,40); color_end_rgb = (200,50,50)   
    for col_name in ['Voisin 1', 'Voisin 2', 'Voisin 3']: 
        if col_name in row.index:
            cell_value = str(row[col_name]); current_count = 0 
            match = re.search(r' - (\d+)$', cell_value)
            if match: current_count = int(match.group(1))
            if current_count > 0:
                if max_overall_count == vmin_count: ratio = 1.0 if current_count >= vmin_count else 0.0
                elif max_overall_count > vmin_count: ratio = max(0.0, min((current_count - vmin_count) / (max_overall_count - vmin_count), 1.0)) 
                else: ratio = 0.0
                r,g,b = (int(color_start_rgb[j] + ratio * (color_end_rgb[j] - color_start_rgb[j])) for j in range(3))
                styles[col_name] = f'background-color: rgb({r},{g},{b})'
            else: styles[col_name] = 'background-color: none' 
    return styles

if st.session_state.run_main_processing_once and not st.session_state.get('sub', pd.DataFrame()).empty and syntaxon_data_list:
    st.markdown("---"); st.subheader("Étape 4: Analyse des Co-occurrences d'Espèces (basée sur listes de syntaxons)")
    principal_species_original_names = st.session_state.sub['Espece_Ref_Original'].unique()
    raw_cooccurrence_data = []
    for principal_sp_orig in principal_species_original_names:
        principal_sp_norm = normalize_species_name(principal_sp_orig)
        if not principal_sp_norm: continue
        co_counts = defaultdict(int)
        for syntaxon_rec in syntaxon_data_list:
            if principal_sp_norm in syntaxon_rec['species_set']:
                for other_sp_norm in syntaxon_rec['species_set']:
                    if other_sp_norm != principal_sp_norm: co_counts[other_sp_norm] += 1
        if co_counts:
            sorted_co = sorted(co_counts.items(), key=lambda item: item[1], reverse=True)
            for i in range(3):
                if i < len(sorted_co): raw_cooccurrence_data.append({'count': sorted_co[i][1]}) 
    all_counts = [item['count'] for item in raw_cooccurrence_data if item['count'] > 0]
    max_cooccurrence = max(all_counts) if all_counts else 0; min_cooccurrence_color = 1 
    cooccurrence_display = []
    for principal_sp_orig in principal_species_original_names:
        principal_sp_norm = normalize_species_name(principal_sp_orig)
        if not principal_sp_norm: continue 
        co_counts = defaultdict(int) 
        for syntaxon_rec in syntaxon_data_list:
            if principal_sp_norm in syntaxon_rec['species_set']:
                for other_sp_norm in syntaxon_rec['species_set']:
                    if other_sp_norm != principal_sp_norm: co_counts[other_sp_norm] += 1
        row_dict = {'Espèce Principale (issue des relevés)': principal_sp_orig}
        if co_counts:
            sorted_co = sorted(co_counts.items(), key=lambda item: item[1], reverse=True)
            for i in range(3): 
                col = f'Voisin {i+1}'
                row_dict[col] = f"{str(sorted_co[i][0]).capitalize()} - {sorted_co[i][1]}" if i < len(sorted_co) else "-"
        else: 
            for i in range(3): row_dict[f'Voisin {i+1}'] = "-"
        cooccurrence_display.append(row_dict)
    if cooccurrence_display:
        cooccurrence_df = pd.DataFrame(cooccurrence_display)
        st.markdown("Tableau des co-occurrences (3 plus fréquentes) pour chaque espèce des relevés, basé sur les syntaxons de référence. Couleur = intensité.")
        styled_df = cooccurrence_df.style.apply(style_cooccurrence_row_parsing, max_overall_count=max_cooccurrence, vmin_count=min_cooccurrence_color, axis=1).format(na_rep="-")
        st.dataframe(styled_df, use_container_width=True)
    else: st.info("Aucune donnée de co-occurrence à afficher.")
elif st.session_state.run_main_processing_once and not syntaxon_data_list:
    st.markdown("---"); st.subheader("Étape 4: Analyse des Co-occurrences d'Espèces")
    st.warning("Données des syntaxons non chargées/vides. Analyse de co-occurrence impossible.")
