
import React from 'react';
import { EstadoAgente } from '../types';
import { Loader2 } from 'lucide-react';

type PropiedadesIndicadorEstado = {
  estado: EstadoAgente;
};


//funcion para indicar el estado del agente segun el cambio de estado que se haya realizado en algun momento
export const StatusIndicator: React.FC<PropiedadesIndicadorEstado> = ({ estado }) => {
  if (estado === EstadoAgente.INACTIVO) return null;

  const etiquetas = {
    [EstadoAgente.PENSANDO]: "Pensando...",
    [EstadoAgente.OBTENIENDO_DATOS]: "Investigando fuentes...",
    [EstadoAgente.SINTETIZANDO]: "Redactando reporte...",
    [EstadoAgente.ERROR]: "Error de cuota/red"
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-blue-50 border border-blue-100 shadow-sm animate-in fade-in zoom-in-95">
      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
        {etiquetas[estado] || "Cargando..."}
      </span>
    </div>
  );
};


