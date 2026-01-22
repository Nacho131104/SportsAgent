
import { ResultadoBusqueda, ResultadoWikipedia, Fuente } from '../types';

// Obtenemos la URL del backend desde el entorno, inyectada por Vite
const URL_BASE_RAW = process.env.BACKEND_URL || 'http://localhost:8000';
const URL_BASE = URL_BASE_RAW.replace(/\/$/, '');



//funcion para comprobar la conexion al backend, con un endpoint que retorna un status ok
export const obtenerConexion = async (): Promise<boolean> => {
  try {
    const respuesta = await fetch(`${URL_BASE}/health`);
    if (!respuesta.ok) return false;
    const datos = await respuesta.json();
    return datos.status === "ok";
  } catch {
    return false;
  }
};


//funcion que obtiene datos de búsqueda desde el backend con soporte para múltiples resultados.
export const obtenerDatosBusqueda = async (consulta: string): Promise<Fuente[]> => {
  if (!consulta) return [];
  
  try {
    const respuesta = await fetch(`${URL_BASE}/search?q=${encodeURIComponent(consulta)}`);
    if (!respuesta.ok) throw new Error(`Error en servidor: ${respuesta.status}`);
    
    const resultado: ResultadoBusqueda = await respuesta.json();
    const fuentes: Fuente[] = [];

    if (resultado.data) {
      // 1. Añadir respuesta inteligente si existe
      if (resultado.data.answer) {
        fuentes.push({
          tipo: 'noticias',
          titulo: 'Resumen Inteligente',
          contenido: resultado.data.answer
        });
      }

      // 2. Añadir resultado individual si existe
      if (resultado.data.result) {
        fuentes.push({
          tipo: 'noticias',
          titulo: resultado.data.result.title,
          contenido: resultado.data.result.content || resultado.data.result.snippet,
          enlace: resultado.data.result.url
        });
      }

      // 3. Añadir lista de resultados (lo que devuelve la api de tavily)
      if (Array.isArray(resultado.data.results)) {
        resultado.data.results.forEach(res => {
          fuentes.push({
            tipo: 'noticias',
            titulo: res.title,
            contenido: res.content || res.snippet,
            enlace: res.url
          });
        });
      }
    }
    
    return fuentes;
  } catch (error) {
    console.error("Error al obtener datos de búsqueda:", error);
    return [];
  }
};


//funcion que obtiene datos de Wikipedia desde el backend.

export const obtenerDatosWikipedia = async (consulta: string): Promise<Fuente[]> => {
  if (!consulta) return [];

  try {
    const respuesta = await fetch(`${URL_BASE}/wikipedia?q=${encodeURIComponent(consulta)}`);
    if (!respuesta.ok) throw new Error("Error en Wikipedia");
    const resultado: ResultadoWikipedia = await respuesta.json();
    
    const fuentes: Fuente[] = [];
    Object.entries(resultado).forEach(([entidad, contenido]) => {
      if (!contenido.error && contenido.Texto) {
        fuentes.push({
          tipo: 'wiki',
          titulo: entidad,
          contenido: contenido.Texto
        });
      }
    });
    return fuentes;
  } catch (error) {
    console.error("Error al obtener datos de Wikipedia:", error);
    return [];
  }
};
