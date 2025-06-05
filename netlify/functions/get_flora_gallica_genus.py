import json
import fitz  # PyMuPDF
import os
from pathlib import Path
import re

# Définissez le chemin de base où se trouvent vos PDF Flora Gallica
# Ce chemin doit être accessible depuis l'environnement de la fonction serverless.
# La manière la plus simple est de placer les PDF dans le même répertoire que cette fonction
# ou dans un sous-répertoire.
PDF_BASE_PATH = Path(__file__).parent.parent / 'assets' / 'flora_gallica_pdfs'

# Mapping entre les groupes de classification et les noms de fichiers PDF
PDF_FILES = {
    "Angiospermes Dicotylédon": "Flora Gallica - Angiospermes Dicotylédon.pdf",
    "Angiospermes Monocotylédon": "Flora Gallica - Angiospermes Monocotylédon.pdf",
    "Gymnospermes": "Flora Gallica - Gymnospermes.pdf",
    "Ptéridophytes": "Flora Gallica - Ptéridophytes.pdf"
}

def get_toc_bounds(doc, genus):
    """Trouve la plage de pages pour un genre donné dans la table des matières du PDF."""
    toc = doc.get_toc(simple=True)
    if not toc:
        raise RuntimeError("PDF sans table des matières exploitable.")

    start_page = -1
    end_page = -1
    next_genus_title = None
    genus_level = -1

    # Trouver la page de début et le niveau hiérarchique du genre
    for i, (level, title, page) in enumerate(toc):
        # Le titre dans la TdM est parfois "GENUS Famille"
        if re.match(rf"^{re.escape(genus)}\b", title.strip(), re.IGNORECASE):
            start_page = page - 1
            genus_level = level
            # Trouver le prochain titre de même niveau (ou supérieur) pour déterminer la fin
            for j in range(i + 1, len(toc)):
                next_level, next_title, next_page = toc[j]
                if next_level <= genus_level:
                    end_page = next_page - 2 # La page de fin est celle juste avant le début du genre suivant
                    break
            break
            
    if start_page == -1:
        raise ValueError(f"Genre '{genus}' introuvable dans la table des matières.")

    # Si on n'a pas trouvé de genre suivant, on va jusqu'à la fin du document
    if end_page == -1:
        end_page = doc.page_count - 1

    # Assurer que la page de fin n'est pas avant la page de début
    if end_page < start_page:
        end_page = start_page

    return start_page, end_page


def handler(event, context):
    """
    Fonction serverless Netlify pour extraire les pages d'un genre botanique.
    """
    # Récupérer les paramètres de la requête
    params = event.get('queryStringParameters', {})
    classification_group = params.get('group')
    genus = params.get('genus')

    if not classification_group or not genus:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': "Les paramètres 'group' et 'genus' sont requis."})
        }

    # Déterminer le fichier PDF à utiliser
    pdf_filename = PDF_FILES.get(classification_group)
    if not pdf_filename:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': f"Groupe de classification inconnu: {classification_group}"})
        }

    pdf_path = os.path.join(PDF_BASE_PATH, pdf_filename)

    try:
        # Ouvrir le document PDF source
        source_doc = fitz.open(pdf_path)
        
        # Trouver les pages correspondantes au genre
        start_page, end_page = get_toc_bounds(source_doc, genus)

        # Créer un nouveau document PDF en mémoire
        output_doc = fitz.open()
        
        # Insérer les pages extraites dans le nouveau document
        output_doc.insert_pdf(source_doc, from_page=start_page, to_page=end_page)
        
        # Sauvegarder le nouveau PDF dans un buffer de bytes
        pdf_buffer = output_doc.tobytes()

        source_doc.close()
        output_doc.close()

        # Retourner le fichier PDF
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'inline; filename="{genus}_Flora_Gallica.pdf"'
            },
            'body': pdf_buffer.hex(), # Netlify gère mieux la conversion hex/base64
            'isBase64Encoded': False # Indiquer que le corps est une chaîne hexadécimale
        }

    except FileNotFoundError:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': f"Fichier PDF introuvable sur le serveur pour le groupe '{classification_group}'."})
        }
    except ValueError as e:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': str(e)})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': f"Une erreur interne est survenue: {str(e)}"})
        }
