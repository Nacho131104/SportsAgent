
import { GoogleGenAI, Type } from "@google/genai";
import { Fuente, ResultadoOrquestacion, Mensaje } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODELO_ORQUESTADOR = 'gemini-flash-lite-latest'; 
const MODELO_SINTETIZADOR = 'gemini-3-flash-preview'; 

const limpiarContenidoFuente = (texto: string): string => {
  if (!texto) return "";
  return texto
    .replace(/!\[.*?\]\(.*?\)/g, '') 
    .replace(/\[.*?\]\(.*?\)/g, (match) => {
      const textMatch = match.match(/\[(.*?)\]/);
      return textMatch ? textMatch[1] : '';
    })
    .replace(/\s+/g, ' ') 
    .trim()
    .slice(0, 3500); 
};

const conReintento = async <T>(fn: () => Promise<T>, reintentos = 3, demora = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = String(error);
    const esErrorCuota = errorStr.includes('429');
    
    if (esErrorCuota && reintentos > 0) {
      console.warn(`Cuota excedida. Reintentando en ${demora}ms...`);
      await new Promise(resolve => setTimeout(resolve, demora));
      return conReintento(fn, reintentos - 1, demora * 2); 
    }
    throw error;
  }
};


/*
**funcion para que el llm para que se determine si la consulta es deportiva, 
**y para que se devuelva la consulta realizada optimizada y la ruta a llamar del back
*/
export const orquestarConsulta = async (consulta: string, historial: Mensaje[]): Promise<ResultadoOrquestacion> => {
  const historialReciente = historial.slice(-3).map(m => `${m.rol === 'usuario' ? 'U' : 'A'}: ${m.contenido}`).join('\n');
  
  const prompt = `
  HISTORIAL RECIENTE:
  ${historialReciente}

  PREGUNTA ACTUAL DEL USUARIO: "${consulta}"
  
  TAREA:
  Determina si la intención es deportiva O si es una interacción conversacional válida (saludos, presentaciones, qué puedes hacer, agradecimientos).
  
  REGLAS:
  1. Si es deporte o interacción cortés/conversacional relacionada contigo: esDeporte = true.
  2. Si es una pregunta fáctica de deporte que requiere datos externos: puntoFinal = 'busqueda' o 'wikipedia'.
  3. Si es un saludo o charla sobre ti mismo: puntoFinal = 'ninguno'.
  4. Si es un tema totalmente ajeno (ej. recetas, política, soporte técnico no deportivo): esDeporte = false.
  
  Devuelve JSON con esDeporte, puntoFinal, consultaOptimizada (en 3ra persona si es búsqueda) y razonamiento.`;

  return conReintento(async () => {
    const respuesta = await ai.models.generateContent({
      model: MODELO_ORQUESTADOR,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            esDeporte: { type: Type.BOOLEAN },
            puntoFinal: { type: Type.STRING },
            consultaOptimizada: { type: Type.STRING },
            razonamiento: { type: Type.STRING }
          },
          required: ["esDeporte", "puntoFinal", "consultaOptimizada", "razonamiento"]
        }
      }
    });
    
    const res = JSON.parse(respuesta.text || "{}");
    if (res.esDeporte && !res.consultaOptimizada) res.consultaOptimizada = consulta;
    return res;
  });
};


/*
funcion para que segun la consulta, las fuentes externas, y el historial de mensajes 
se genere la respuesta final al usuario sobre la consulta
*/
export const sintetizarReporteDeportivo = async (consulta: string, fuentes: Fuente[], historial: Mensaje[]): Promise<string> => {
  const historialReciente = historial.slice(-3).map(m => `${m.rol === 'usuario' ? 'U' : 'A'}: ${m.contenido}`).join('\n');
  
  const contextoLimpio = fuentes.length > 0 
    ? fuentes.map(f => `[CONTEXTO]: ${limpiarContenidoFuente(f.contenido)}`).join('\n\n')
    : "Sin datos externos nuevos. Usa tu conocimiento base o responde al saludo.";

  const prompt = `
  HISTORIAL:
  ${historialReciente}

  CONOCIMIENTO DISPONIBLE:
  ${contextoLimpio}

  PREGUNTA: "${consulta}"`;

  return conReintento(async () => {
    const usarThinking = prompt.length > 200;

    const respuesta = await ai.models.generateContent({
      model: MODELO_SINTETIZADOR,
      contents: prompt,
      config: { 
        temperature: 0.7, //Temperatura del modelo alta para que suene menos "robótico"
        ...(usarThinking ? { 
          maxOutputTokens: 4000,
          thinkingConfig: { thinkingBudget: 2000 } 
        } : {}),
        systemInstruction: `Eres un analista deportivo de élite con una personalidad profesional pero cercana.
        
        REGLAS DE RESPUESTA:
        1. Si el usuario te saluda o pregunta quién eres, preséntate como su Agente de Inteligencia Deportiva.
        2. Sé breve en interacciones puramente sociales.
        3. NO menciones fuentes ni procesos de búsqueda.
        4. Si el mensaje es una consulta deportiva, sé autoritario y preciso usando negritas en nombres y datos clave.
        5. Mantén siempre el foco en el mundo del deporte.
        6. Debes de aportar la máxima información posible que creas necesaria de la extraida externamente.`
      }
    });

    return respuesta.text || "No se pudo generar la respuesta en este momento.";
  });
};