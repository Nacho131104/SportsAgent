
from fastmcp import FastMCP
from dotenv import load_dotenv
import os, requests, logging
import wikipediaapi
load_dotenv()
logging.basicConfig(
    filename="mcp_debug.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force= True
)
mcp = FastMCP("Sports Agent 🏟️")

# --- TOOL 1: Buscar info en Google News ---
@mcp.tool(description="Busca noticias en Google News usando SearchAPI.io")
def buscar_info(consulta: str) -> dict:
    try:
        API_KEY = os.getenv("API_KEY_IO")
        if not API_KEY:
            raise ValueError("API_KEY_IO no está definido en .env")

        url = "https://www.searchapi.io/api/v1/search"
        params = {
            "engine": "google_news",
            "q": consulta,
            "api_key": API_KEY,
            "language": "es"
        }

        response = requests.get(url, params=params, timeout=5)
        data = response.json()

        resultados = []
        for item in data.get("organic_results", [])[:5]:
            titulo = item.get("title", "")
            snippet = item.get("snippet", "")
            link = item.get("link", "")
            resultados.append(f"{titulo}: {snippet} (Fuente: {link})")

        if not resultados:
            return {"status": "ok", "data": "No se encontraron resultados relevantes."}

        texto_para_llm = "\n".join(resultados)
        logging.info(f"Resultados: {texto_para_llm}")
        return {"status": "ok", "data": texto_para_llm}

    except Exception as e:
        logging.error(f"Error en buscar_info: {e}")
        return {"status": "error", "message": str(e)}


# --- TOOL 4: Consulta Wikipedia para múltiples entidades ---
@mcp.tool(description="Busca información en Wikipedia para varias entidades")
def consulta_wikipedia(entidades):
    try:
        wiki_wiki = wikipediaapi.Wikipedia(
            user_agent='AgenteDeportivo/1.0 (contacto: nacholopezamat@gmail.com)',
            language='es',
        )

        resultados = {}
        for entidad in entidades:
            page = wiki_wiki.page(entidad)
            if not page.exists():
                resultados[entidad] = {"error": f"No se encontró la página para {entidad}."}
                continue

            contenido = {"Texto": page.text}
            resultados[entidad] = contenido

        return resultados
    except Exception as e:
        logging.error(e) 
        return {"error": f"Error inesperado: {e}"}





if __name__ == "__main__":
    mcp.run()  # STDIO

