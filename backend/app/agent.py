
# app/agent.py
import os
import logging
from dotenv import load_dotenv
from google import genai  # SDK nuevo
load_dotenv()
logging.basicConfig(
    filename="mcp_debug.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force=True,
)

API_KEY = os.getenv("API_KEY_GEMINI")
if not API_KEY:
    raise RuntimeError("Falta API_KEY_GEMINI en el entorno o .env")


def prompt_entidades (consulta):
    return f""" Eres un agente de ia deportivo,
    Devuelve unicamente las entidades encontradas en la consulta aportada por el usuario
    La respuesta debe de ser una lista de nombres, por ejemplo: Lionel Messi, Paris Saint Germain
    -Consulta aportada por el usuario: {consulta}
""" 

def prompt_info(consulta,info):
    return f"""Eres un agente de IA deportivo,
    A partir de la consulta realizada por el usuario, dada continuacion: {consulta}
    Se ha extraido informacion relevante sobre las entidades de la consulta, dada a continuacion: {info}
    Teniendo en cuenta los datos aportados y tus datos sobre la consulta,
    genera una respuesta clara para el usuario
    """
client = genai.Client(api_key=API_KEY)

MODEL_NAME = "gemini-flash-lite-latest"
# "gemini-1.5-flash-latest" (rápido)
# "gemini-1.5-pro-latest" (más razonamiento)
# "gemini-2.0-flash" (según disponibilidad)
# "gemini-3-flash-preview" (preview, puede cambiar)
# gemini-flash-lite-latest

def obtener_respuesta(prompt) :
    """
    Genera una respuesta textual usando `google.genai`.
    Devuelve texto (str). Maneja errores de forma controlada.
    """
    logging.info(f"Prompt: {prompt}")
    try:

        #file = client.files.upload()
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=(
                "Eres un agente de IA de consultas deportivas. ",
                "Responde a lo pedidod a continuacion de forma que sigas las indicaciones dadas",
                f"{prompt}"
            ),
        )
        text = (response.text or "").strip()
        logging.info(f"Respuesta (len={len(text)}): {text[:120]}...")
        return text
    except Exception as e:
        logging.exception("Error llamando a Gemini (google.genai)")
        return f"Error al generar respuesta: {e}"
    

def obtener_entidades ( consulta):
    prompt = prompt_entidades(consulta)
    entidades = obtener_respuesta(prompt)
    return entidades


def separar_entidades(text: str):
    """ Separa las entidades del modelo LLM  y devuelve un array con cada una"""
    if not isinstance(text, str):
        return []

    return [
        item.strip()
        for item in text.split(",")
        if item.strip()
    ]
