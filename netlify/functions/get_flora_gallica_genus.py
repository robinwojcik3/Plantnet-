import json
import fitz  # PyMuPDF
import os
from pathlib import Path
import re
import base64
import unicodedata

# Chemin vers le dossier des PDF, situé au même niveau que ce script
PDF_BASE_PATH = Path(__file__).parent / 'flora_gallica_pdfs'

# Mapping entre les groupes de classification et les noms de fichiers PDF
PDF_FILES = {
    "Angiospermes Dicotylédon": "Flora Gallica - Angiospermes Dicotylédon.pdf",
    "Angiospermes Monocotylédon": "Flora Gallica - Angiospermes Monocotylédon.pdf",
    "Gymnospermes": "Flora Gallica - Gymnospermes.pdf",
    "Ptéridophytes": "Flora Gallica - Ptéridophytes.pdf"
}

def normalize_str_for_matching(s):
    """Normalise une chaîne : minuscules, sans accents, pour une comparaison robuste."""
    if not isinstance(s, str):
        return ""
    # Décompose les caractères accentués et supprime les marques diacritiques
    return "".join(
        c for c in unicodedata.normalize('NFKD', s)
        if unicodedata.category(c) != 'Mn'
    ).lower()

def get_toc_bounds(doc, genus):
    """Trouve la plage de pages pour un genre donné dans la table des matières du PDF."""
    toc = doc.get_toc(simple=False)
    if not toc:
        raise RuntimeError("Le PDF ne contient pas de table des matières exploitable.")

    start_page = -1
    end_page = -1
    genus_level = -1

    # Recherche de la page de début et du niveau du genre
    for i, (level, title, page, _) in enumerate(toc):
        if re.match(rf"^\s*{re.escape(genus)}\b", title.strip(), re.IGNORECASE):
            start_page = page - 1
            genus_level = level
            
            # Recherche du prochain titre de même niveau (ou supérieur) pour définir la fin
            for j in range(i + 1, len(toc)):
                next_level, _, next_page, _ = toc[j]
                if next_level <= genus_level:
                    end_page = next_page - 2  # La fin est juste avant le début du suivant
                    break
            break
            
    if start_page == -1:
        raise ValueError(f"Le genre '{genus}' est introuvable dans la table des matières du PDF sélectionné.")

    if end_page == -1:
        end_page = doc.page_count - 1

    if end_page < start_page:
        end_page = start_page

    return start_page, end_page

def handler(event, context):
    """
    Fonction serverless Netlify pour extraire et renvoyer les pages d'un genre botanique.
    """
    params = event.get('queryStringParameters', {})
    classification_group_raw = params.get('group')
    genus = params.get('genus')

    if not classification_group_raw or not genus:
        return {'statusCode': 400, 'body': json.dumps({'error': "Les paramètres 'group' et 'genus' sont requis."})}

    # --- MODIFICATION CLÉ ---
    # Rendre la correspondance entre le résultat de Gemini et le nom de fichier flexible
    normalized_group = normalize_str_for_matching(classification_group_raw)
    pdf_filename = None

    if "dicotyledon" in normalized_group:
        pdf_filename = PDF_FILES["Angiospermes Dicotylédon"]
    elif "monocotyledon" in normalized_group:
        pdf_filename = PDF_FILES["Angiospermes Monocotylédon"]
    elif "gymnosperme" in normalized_group:
        pdf_filename = PDF_FILES["Gymnospermes"]
    elif "pteridophyte" in normalized_group:
        pdf_filename = PDF_FILES["Ptéridophytes"]
    # --- FIN DE LA MODIFICATION ---

    if not pdf_filename:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f"Le groupe de classification '{classification_group_raw}' n'a pas pu être associé à un fichier PDF."})
        }

    pdf_path = os.path.join(PDF_BASE_PATH, pdf_filename)

    try:
        source_doc = fitz.open(pdf_path)
        start_page, end_page = get_toc_bounds(source_doc, genus)
        
        output_doc = fitz.open()
        output_doc.insert_pdf(source_doc, from_page=start_page, to_page=end_page)
        
        pdf_buffer = output_doc.tobytes()

        source_doc.close()
        output_doc.close()

        # Retourner le fichier PDF encodé en Base64 pour le transit via API Gateway
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'inline; filename="{genus}_Flora_Gallica.pdf"'
            },
            'body': base64.b64encode(pdf_buffer).decode('utf-8'),
            'isBase64Encoded': True
        }

    except FileNotFoundError:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': f"Fichier PDF introuvable sur le serveur : '{pdf_filename}'. Vérifiez que les PDF sont bien dans 'netlify/functions/flora_gallica_pdfs/'."})
        }
    except ValueError as e:
        return {'statusCode': 404, 'body': json.dumps({'error': str(e)})}
    except Exception as e:
        return {'statusCode': 500, 'body': json.dumps({'error': f"Une erreur interne est survenue lors du traitement du PDF : {str(e)}"}) }
