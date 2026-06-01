
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
      },
    });
    
    const res = JSON.parse(respuesta.text || "{}");
    if (res.esDeporte && !res.consultaOptimizada) res.consultaOptimizada = consulta;
    return res;
  });
};


export const sintetizarReporteDeportivo = async (
  consulta: string, 
  fuentes: Fuente[], 
  historial: Mensaje[],
  archivoBinario?: { base64Data: string; mimeType: string },
  textoArchivo?: string // Para el contenido de archivos de texto plano (.txt, .csv)
): Promise<string> => {
  const historialReciente = historial.slice(-3).map(m => `${m.rol === 'usuario' ? 'U' : 'A'}: ${m.contenido}`).join('\n');
  
  //Formateamos el contexto que viene de internet
  const contextoInternet = fuentes.length > 0 
    ? fuentes.map(f => `[DATO DE INTERNET]: ${limpiarContenidoFuente(f.contenido)}`).join('\n\n')
    : "No se encontraron datos externos nuevos en internet.";

  //Formateamos el contexto exclusivo del archivo del usuario
  let contextoArchivoEspecial = "El usuario no ha adjuntado ningún archivo de texto para esta consulta.";
  if (textoArchivo) {
    contextoArchivoEspecial = `[CONTENIDO REAL DEL ARCHIVO DEL USUARIO]:\n${textoArchivo}`;
  }

  // Creamos un prompt estructurado por bloques inconfundibles
  const prompt = `
  HISTORIAL DE CONVERSACIÓN RECIENTE:
  ${historialReciente}

  =======================================================
  BLOQUE 1: INFORMACIÓN COMPLEMENTARIA DE INTERNET (WEB/WIKIPEDIA)
  =======================================================
  ${contextoInternet}

  =======================================================
  BLOQUE 2: CONTENIDO REAL DEL ARCHIVO SUBIDO POR EL USUARIO
  =======================================================
  ${contextoArchivoEspecial}
  ${archivoBinario ? "[Nota: Se ha adjuntado un archivo multimedia/PDF procesado en formato binario]" : ""}

  =======================================================
  PREGUNTA O MANDATO DEL USUARIO:
  "${consulta}"
  =======================================================`;

  const contenidosConsulta: any[] = [prompt];

  if (archivoBinario) {
    contenidosConsulta.unshift({
      inlineData: {
        mimeType: archivoBinario.mimeType,
        data: archivoBinario.base64Data
      }
    });
  }

  return conReintento(async () => {
    const usarThinking = prompt.length > 200;

    const respuesta = await ai.models.generateContent({
      model: MODELO_SINTETIZADOR,
      contents: contenidosConsulta,
      config: { 
        temperature: 0.4, //Bajamos levemente para asegurar rigurosidad con las fuentes
        ...(usarThinking ? { 
          maxOutputTokens: 4000,
          thinkingConfig: { thinkingBudget: 2000 } 
        } : {}),
        systemInstruction: `Eres un analista deportivo de élite con una personalidad profesional pero cercana.
        
        REGLAS CRÍTICAS DE CONTEXTO Y RAZONAMIENTO:
        1. Tienes dos bloques de datos: 'BLOQUE 1' (Internet) y 'BLOQUE 2' (El archivo del usuario). Son fuentes completamente distintas.
        2. Si el usuario te pregunta si el archivo habla de un tema o jugador específico, analiza estrictamente el 'BLOQUE 2'. Si el tema NO está ahí, debes declarar explícitamente que el archivo NO contiene esa información.
        3. ¡Usa el 'BLOQUE 1' (Internet) para enriquecer tu respuesta! Si el archivo no habla del jugador, puedes aclararlo y acto seguido aportar los datos del jugador obtenidos de internet para ayudar al usuario. 
           Ejemplo: "El archivo que subiste trata sobre tus prácticas en Teknei y no menciona a Robert Lewandowski. No obstante, revisando datos de actualidad, te comento que Lewandowski es un delantero polaco que juega en el F.C. Barcelona..."
        4. NUNCA asumas ni afirmes que los datos obtenidos en el Bloque 1 pertenecen o están escritos dentro del Bloque 2. Sé transparente con el usuario sobre la procedencia de cada dato.
        5. Mantén el foco deportivo, usa negritas en datos clave y nombres propios.`,
      }
    });

    return respuesta.text || "No se pudo generar la respuesta en este momento.";
  });
};