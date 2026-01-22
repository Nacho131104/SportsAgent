
# backend/app/fastapi_app.py (extracto usando cliente MCP SSE)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .tools import consulta_wikipedia,buscar_info
from .agent import separar_entidades, obtener_entidades, obtener_respuesta
import logging

logging.basicConfig(
    filename="mcp_debug.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    force=True,
)


app = FastAPI(title="Sports Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción, limita al dominio del front
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
async def status():
    return {
        "status":"ok",
        "message":"API conectada correctamente"
    }

@app.get("/wikipedia")
async def wikipedia(q: str):

    #se obtienen las entidades de la consulta
    entidades_juntas = obtener_entidades(q)
    logging.info(entidades_juntas)
    entidades = separar_entidades(entidades_juntas)

    #obtenemos la info de la wikipedia de todas las entidades
    info_wikipedia = consulta_wikipedia(entidades)
    return info_wikipedia

@app.get("/search")
async def search(q: str):
    respuesta_json = buscar_info(q)
    return respuesta_json
