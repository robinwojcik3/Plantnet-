import json
import os
from pathlib import Path

def handler(event, context):
    """
    Une fonction de débogage pour inspecter l'environnement d'exécution sur Netlify.
    Elle liste les fichiers et les chemins pour nous aider à trouver le bon chemin pour les PDF.
    """
    debug_info = {}

    try:
        # 1. Quel est le répertoire de travail actuel ?
        cwd = os.getcwd()
        debug_info['repertoire_travail_actuel'] = cwd
        debug_info['fichiers_dans_repertoire_travail'] = os.listdir(cwd)

        # 2. Où se trouve le script lui-même ?
        script_path = Path(__file__).resolve()
        script_dir = script_path.parent
        debug_info['repertoire_du_script'] = str(script_dir)
        debug_info['fichiers_dans_repertoire_script'] = os.listdir(script_dir)

        # 3. Tentons d'accéder au dossier des PDF tel que nous l'avions défini
        proposed_pdf_path = script_dir / 'flora_gallica_pdfs'
        debug_info['chemin_pdf_teste'] = str(proposed_pdf_path)
        
        if proposed_pdf_path.exists() and proposed_pdf_path.is_dir():
            debug_info['contenu_dossier_pdf'] = os.listdir(proposed_pdf_path)
        else:
            debug_info['contenu_dossier_pdf'] = "ERREUR: Le dossier n'existe pas ou n'est pas un dossier."

        # 4. Listons le contenu d'un répertoire parent pour voir la structure globale
        parent_dir = script_dir.parent
        debug_info['repertoire_parent'] = str(parent_dir)
        debug_info['fichiers_dans_repertoire_parent'] = os.listdir(parent_dir)

    except Exception as e:
        debug_info['erreur_execution_debug'] = str(e)

    # Retourner toutes ces informations au format JSON
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json'
        },
        'body': json.dumps(debug_info, indent=2, ensure_ascii=False)
    }
