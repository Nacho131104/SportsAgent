
import React, { useState, useRef, useEffect } from 'react';
import { Trophy, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Mensaje, EstadoAgente, Fuente, EntradaRegistroPensamiento, SesionChat } from './types';
import { obtenerConexion, obtenerDatosBusqueda, obtenerDatosWikipedia } from './services/api';
import { orquestarConsulta, sintetizarReporteDeportivo } from './services/gemini';
import { StatusIndicator } from './components/StatusIndicator';
import './App.css';

const CLAVE_STORAGE = 'sports_intel_historial_v1';

const formatearMarkdown = (texto: string) => {
  return texto.split('\n').map((linea, i) => {
    const partes = linea.split(/(\*\*.*?\*\*)/g);
    const contenido = partes.map((parte, j) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        return <strong key={j}>{parte.slice(2, -2)}</strong>;
      }
      return parte;
    });
    
    if (linea.startsWith('#')) {
      const nivel = linea.match(/^#+/)?.[0].length || 1;
      const textoLimpio = linea.replace(/^#+\s*/, '');
      const estilos = ['24px', '20px', '18px', '16px'];
      return <div key={i} className="markdown-h" style={{ fontSize: estilos[nivel-1] }}>{textoLimpio}</div>;
    }
    
    return <p key={i} className="markdown-p">{contenido}</p>;
  });
};
// Función auxiliar para convertir el archivo del navegador a Base64
const ConvertirArchivoABase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

const App: React.FC = () => {
  const [idSesionActual, setIdSesionActual] = useState<string>(Date.now().toString());
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [registrosActuales, setRegistrosActuales] = useState<EntradaRegistroPensamiento[]>([]);
  const [entrada, setEntrada] = useState('');
  const [estado, setEstado] = useState<EstadoAgente>(EstadoAgente.INACTIVO);
  const [backendActivo, setBackendActivo] = useState<boolean | null>(null);
  const [pestanaSidebar, setPestanaSidebar] = useState<'proceso' | 'historial'>('historial');
  const [historialSesiones, setHistorialSesiones] = useState<SesionChat[]>([]);
  const scrollReferencia = useRef<HTMLDivElement>(null);

  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (guardado) {
      try { setHistorialSesiones(JSON.parse(guardado)); } catch (e) { console.error(e); }
    }
    const verificarConexion = async () => { setBackendActivo(await obtenerConexion()); };
    verificarConexion();
  }, []);

  useEffect(() => {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(historialSesiones));
  }, [historialSesiones]);

  useEffect(() => {
    if (mensajes.length === 0) return;
    setHistorialSesiones(prev => {
      const index = prev.findIndex(s => s.id === idSesionActual);
      const nuevaSesion: SesionChat = {
        id: idSesionActual,
        titulo: prev[index]?.titulo || (mensajes[0]?.contenido.slice(0, 30) + "..."),
        mensajes,
        registros: registrosActuales,
        fechaActualizacion: Date.now()
      };
      if (index >= 0) {
        const copia = [...prev]; copia[index] = nuevaSesion;
        return copia.sort((a, b) => b.fechaActualizacion - a.fechaActualizacion);
      } else { return [nuevaSesion, ...prev]; }
    });
  }, [mensajes, registrosActuales]);

  useEffect(() => {
    if (scrollReferencia.current) scrollReferencia.current.scrollTop = scrollReferencia.current.scrollHeight;
  }, [mensajes, estado]);

  const agregarRegistro = (modulo: EntradaRegistroPensamiento['modulo'], mensaje: string, estadoRegistro: EntradaRegistroPensamiento['estado'] = 'info') => {
    const nuevoRegistro: EntradaRegistroPensamiento = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      modulo, mensaje, estado: estadoRegistro
    };
    setRegistrosActuales(prev => [...prev, nuevoRegistro]);
  };


  //opcion de crear una nueva consulta, con su historial de mensajes
  const nuevaConsulta = () => {
    setIdSesionActual(Date.now().toString());
    setMensajes([]); setRegistrosActuales([]); setEntrada(''); setEstado(EstadoAgente.INACTIVO);
  };


  //opcion de seleccionar el chat 
  const cargarSesion = (sesion: SesionChat) => {
    setIdSesionActual(sesion.id); setMensajes(sesion.mensajes); setRegistrosActuales(sesion.registros);
  };

  //opcion de borrar un chat
  const borrarSesion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistorialSesiones(prev => prev.filter(s => s.id !== id));
    if (idSesionActual === id) nuevaConsulta();
  };

const manejarEnvio = async () => {
  if (!entrada.trim() && !archivoSeleccionado) return; // Permite enviar si hay solo texto o solo archivo

  const consultaUsuario = entrada;
  const instantaneaHistorial = [...mensajes];
  let moduloActual: EntradaRegistroPensamiento['modulo'] = 'ORQUESTADOR';
  
  // Mostrar feedback visual de lo que se envía
  const textoMensaje = archivoSeleccionado 
    ? `${consultaUsuario} [Archivo adjunto: ${archivoSeleccionado.name}]`.trim()
    : consultaUsuario;

  setMensajes(prev => [...prev, { id: Date.now().toString(), rol: 'usuario', contenido: textoMensaje }]);
  setEntrada('');
  setRegistrosActuales([]);
  
  try {
    setEstado(EstadoAgente.PENSANDO);
    agregarRegistro('ORQUESTADOR', 'Analizando intención...');
    const plan = await orquestarConsulta(consultaUsuario || "Analiza el archivo adjunto", instantaneaHistorial);
    
    if (!plan.esDeporte) {
      setMensajes(prev => [...prev, { id: Date.now().toString(), rol: 'asistente', contenido: "Lo siento, solo respondo temas deportivos." }]);
      setEstado(EstadoAgente.INACTIVO); return;
    }

    agregarRegistro('ORQUESTADOR', `Búsqueda: "${plan.consultaOptimizada}"`, 'exito');
    
    let fuentesRecolectadas: Fuente[] = [];
    if (plan.puntoFinal !== 'ninguno') {
      moduloActual = 'BACKEND';
      setEstado(EstadoAgente.OBTENIENDO_DATOS);
      agregarRegistro('BACKEND', `Consultando datos externos...`);
      fuentesRecolectadas = plan.puntoFinal === 'wikipedia' 
        ? await obtenerDatosWikipedia(plan.consultaOptimizada)
        : await obtenerDatosBusqueda(plan.consultaOptimizada);
      
      fuentesRecolectadas = fuentesRecolectadas.filter(f => f.contenido && f.contenido.trim().length > 0);
      agregarRegistro('BACKEND', `${fuentesRecolectadas.length} fuentes encontradas.`, 'exito');
    }

    // --- PROCESAMIENTO DEL ARCHIVO ---
    let datosArchivo = undefined;
    if (archivoSeleccionado) {
      agregarRegistro('SINTETIZADOR', `Procesando archivo: ${archivoSeleccionado.name}...`);
      const base64Data = await ConvertirArchivoABase64(archivoSeleccionado);
      datosArchivo = {
        base64Data,
        mimeType: archivoSeleccionado.type
      };
    }

    moduloActual = 'SINTETIZADOR';
    setEstado(EstadoAgente.SINTETIZANDO);
    agregarRegistro('SINTETIZADOR', 'Generando reporte deportivo...');
    
    // Pasamos los datos del archivo al sintetizador
    const reporte = await sintetizarReporteDeportivo(consultaUsuario, fuentesRecolectadas, instantaneaHistorial, datosArchivo);
    
    setMensajes(prev => [...prev, {
      id: Date.now().toString(), rol: 'asistente', contenido: reporte 
    }]);
    
    // Limpiamos el archivo seleccionado tras enviarlo correctamente
    setArchivoSeleccionado(null);
    setEstado(EstadoAgente.INACTIVO);

  } catch (error: any) {
    agregarRegistro(moduloActual, 'ERROR DE PROCESAMIENTO', 'error');
    setMensajes(prev => [...prev, {
      id: Date.now().toString(), rol: 'asistente',
      contenido: "Hubo un problema técnico al procesar tu reporte deportivo. Intenta de nuevo en unos momentos."
    }]);
    setEstado(EstadoAgente.INACTIVO);
  }
};

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <button onClick={nuevaConsulta} className="btn-new-query">
            <Plus size={16} /> Nueva Consulta
          </button>
        </div>
        <div className="sidebar-tabs">
          <button 
            onClick={() => setPestanaSidebar('historial')} 
            className={`sidebar-tab ${pestanaSidebar === 'historial' ? 'sidebar-tab-active' : ''}`}
          >
            Historial
          </button>
          <button 
            onClick={() => setPestanaSidebar('proceso')} 
            className={`sidebar-tab ${pestanaSidebar === 'proceso' ? 'sidebar-tab-active-process' : ''}`}
          >
            Proceso
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '0.5rem' }}>
          {pestanaSidebar === 'historial' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {historialSesiones.map(sesion => (
                <button 
                  key={sesion.id} 
                  onClick={() => cargarSesion(sesion)} 
                  className={`session-item ${idSesionActual === sesion.id ? 'session-item-active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <MessageSquare size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
                    <span style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sesion.titulo}</span>
                  </div>
                  <Trash2 onClick={(e) => borrarSesion(e, sesion.id)} size={14} className="trash-icon" />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1rem' }}>
              {registrosActuales.map(log => (
                <div key={log.id} className="log-entry">
                  <span className={`log-badge ${log.modulo === 'ORQUESTADOR' ? 'badge-orquestador' : log.modulo === 'SINTETIZADOR' ? 'badge-sintetizador' : 'badge-backend'}`}>{log.modulo}</span>
                  <p style={{ margin: '0.25rem 0', color: log.estado === 'error' ? 'var(--color-red-400)' : log.estado === 'exito' ? 'var(--color-emerald-400)' : 'var(--color-slate-400)' }}>{log.mensaje}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-slate-800)', display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: 'var(--color-slate-500)', textTransform: 'uppercase' }}>
          <span>Servidor</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: backendActivo ? 'var(--color-emerald-500)' : 'var(--color-red-500)' }} />
        </div>
      </aside>

      <main className="main-layout">
        <header className="top-header">
          <div className="header-title">
            <Trophy size={24} color="var(--color-blue-600)" />
            <h1>Agente deportivo Inteligente</h1>
          </div>
          <StatusIndicator estado={estado} />
        </header>

        <div ref={scrollReferencia} className="chat-viewport">
          {mensajes.length === 0 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-slate-400)' }}>
              <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '2rem', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Trophy size={64} style={{ marginBottom: '1.5rem', opacity: 0.1 }} />
                <p style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--color-slate-900)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Agente de Inteligencia</p>
                <p style={{ fontSize: '12px', textAlign: 'center', maxWidth: '240px' }}>Consulta estadísticas, resultados o noticias deportivas en tiempo real.</p>
              </div>
            </div>
          )}
          {mensajes.map((m) => (
            <div key={m.id} className={`message-wrapper ${m.rol === 'usuario' ? 'message-user' : 'message-assistant'}`}>
              <div className={`bubble ${m.rol === 'usuario' ? 'bubble-user' : 'bubble-assistant'}`}>
                {m.rol === 'usuario' ? m.contenido : formatearMarkdown(m.contenido)}
              </div>
            </div>
          ))}
        </div>

        <div className="input-section">
          {/* Indicador visual si hay un archivo cargado listo para enviarse */}
          {archivoSeleccionado && (
            <div style={{ padding: '4px 12px', marginBottom: '8px', background: 'var(--color-slate-800)', borderRadius: '8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}>
              <span style={{ color: 'var(--color-emerald-400)' }}>📎 {archivoSeleccionado.name}</span>
              <button onClick={() => setArchivoSeleccionado(null)} style={{ background: 'none', border: 'none', color: 'var(--color-red-400)', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
            </div>
          )}

          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Input de archivo oculto pero controlable */}
            <label className="btn-file-upload" style={{ cursor: 'pointer', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-slate-800)', borderRadius: '50%' }}>
              <Plus size={18} color="var(--color-slate-400)" />
              <input 
                type="file" 
                onChange={(e) => e.target.files && setArchivoSeleccionado(e.target.files[0])}
                accept=".pdf, .png, .jpg, .jpeg, .csv, .txt"
                style={{ display: 'none' }} 
              />
            </label>

            <input 
              type="text" value={entrada} onChange={(e) => setEntrada(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && manejarEnvio()}
              placeholder="¿Cómo va la liga o analiza este archivo...?"
              className="text-input"
              style={{ flex: 1 }}
            />
            <button onClick={manejarEnvio} disabled={estado !== EstadoAgente.INACTIVO || (!entrada.trim() && !archivoSeleccionado)} className="btn-send">
              Consultar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

