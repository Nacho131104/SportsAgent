
from dotenv import load_dotenv
import os,  logging
import wikipediaapi
from tavily import TavilyClient
import re
import html
load_dotenv()
logging.basicConfig(
    filename="mcp_debug.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force= True
)

def limpiar_contenido_tavily(texto: str,quitar_urls: bool = True,quitar_markdown_links: bool = True,
    colapsar_blancos: bool = True, max_len: int | None = None) -> str:
    if not texto:
        return ""
    t = html.unescape(texto)
    t = t.replace("\\n", "\n").replace("\\t", "\t")

    #quitar enlaces
    if quitar_markdown_links:
        t = re.sub(r'\[([^\]]+)\]\((https?://[^\)]+)\)', r'\1', t)

    #quitar urls
    if quitar_urls:
        t = re.sub(r'https?://\S+', '', t)

    #quitar el resto de caractereres innecesarios
    t = re.sub(r'^\s*#{1,6}\s*', '', t, flags=re.MULTILINE)

    #colpasar espacios en blanco etc ....
    if colapsar_blancos:
        t = re.sub(r'[ \t]+', ' ', t)
        t = re.sub(r'\n{3,}', '\n\n', t)
        t = "\n".join([line.strip() for line in t.splitlines()])
        t = t.strip()

    #Cortar por longitud de texto si se pide
    if max_len is not None and len(t) > max_len:
        t = t[:max_len].rstrip() + "…"

    return t

def buscar_info(consulta: str, pedir_hasta: int = 5, include_raw_content: bool = True, include_answer: bool = True,
                search_depth: str = "advanced", longitud_max_por_fuente: int = 6000, aceptar_sin_contenido: bool = True ):
    """
    Llama a Tavily devolviendo las paginas y la info en ella, además de la answer si Tavily la genera. Limpia el texto antes de retornarlo.
    """
    try:
        api_key = os.getenv("API_KEY_TAVILY")
        if not api_key:
            raise ValueError("API_KEY_TAVILY no está definido en .env")

        tavily = TavilyClient(api_key=api_key)

        resp = tavily.search(
            query=consulta,
            max_results=pedir_hasta,        
            include_answer=include_answer,
            include_raw_content=include_raw_content,
            search_depth=search_depth
        )

        results = resp.get("results") or []

        #Intentamos coger el primer resultado sin contenido vacío
        primer_util = None
        for r in results:
            raw = r.get("raw_content") or r.get("content") or ""
            if raw and raw.strip():
                primer_util = r
                break

        #Se coge el primero si no
        if primer_util is None and aceptar_sin_contenido and results:
            primer_util = results[0]

        data = {
            "query": consulta,
            "answer": resp.get("answer"),
            "result": None
        }

        if primer_util:
            raw = primer_util.get("raw_content") or primer_util.get("content") or ""
            contenido_limpio = limpiar_contenido_tavily(raw, max_len=longitud_max_por_fuente) if include_raw_content else ""
            data["result"] = {
                "title": primer_util.get("title"),
                "url": primer_util.get("url"),
                "source": primer_util.get("source"),
                "published_date": primer_util.get("published_date"),
                "snippet": primer_util.get("snippet") or "",
                "content": contenido_limpio,   #limpiamos el contenido de los resultados
                "raw_len": len(raw)
            }

        logging.info(data)
        return {"status": "Okey", "data": data}

    except Exception as e:
        logging.exception("Error en buscar_info: %s", e)
        return {"status": "Error", "message": str(e)}





#Busqueda en wikipedia de varias entidades
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
        logging.info(resultados)
        return resultados
    except Exception as e:
        logging.error(e) 
        return {"error": f"Error inesperado: {e}"}
