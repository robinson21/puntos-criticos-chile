import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useData } from './DataContext';
import { leerUrl, escribirUrl } from './url';
import { useAlertas, alertasDeRegion, esOperacional, puntoRelacionado } from './alertas';

const FilterContext = createContext(null);

// Valor del filtro de tipo para los puntos sin tipo de solución ('' en los datos).
export const SIN_INFO = 'sin-info';

export function FilterProvider({ children, records }) {
  const { regionActual } = useData();
  const [inicial] = useState(leerUrl);
  const [comuna, setComuna] = useState(inicial.comuna || '');
  const [causa, setCausa] = useState(inicial.causa || '');
  const [nivel, setNivel] = useState(inicial.nivel || '');
  const [tipoSolucion, setTipoSolucion] = useState(inicial.tipo || '');
  const [provincia, setProvincia] = useState(inicial.provincia || '');
  // Solo los puntos que SENAPRED marca como afectados en el período (este invierno)
  const [soloAfectados, setSoloAfectados] = useState(inicial.afectados === '1');
  // Puntos que una alerta DMC vigente puede activar: '' (sin filtro), 'todas' o el id de una alerta
  const [filtroAlerta, setFiltroAlerta] = useState(inicial.alerta || '');
  const { data: alertasData } = useAlertas();

  // Refleja región y filtros en la URL (replaceState: no ensucia el historial).
  // Se espera a que cargue la región pedida en la URL para no borrarla antes.
  const [listo, setListo] = useState(!inicial.region);
  useEffect(() => {
    if (!listo) {
      if (regionActual) setListo(true);
      return;
    }
    escribirUrl({ region: regionActual, provincia, comuna, causa, nivel, tipo: tipoSolucion, afectados: soloAfectados ? '1' : '', alerta: filtroAlerta });
  }, [listo, regionActual, provincia, comuna, causa, nivel, tipoSolucion, soloAfectados, filtroAlerta]);

  // Alertas de la región que tienen causas relacionadas (las operacionales no filtran puntos)
  const alertasConCausas = useMemo(
    () => alertasDeRegion(alertasData?.alertas, regionActual).filter(a => !esOperacional(a)),
    [alertasData, regionActual]
  );
  const alertasFiltro = useMemo(() => {
    if (!filtroAlerta) return null;
    return filtroAlerta === 'todas' ? alertasConCausas : alertasConCausas.filter(a => String(a.id) === String(filtroAlerta));
  }, [filtroAlerta, alertasConCausas]);

  const filtered = useMemo(() => {
    if (!records.length) return [];
    return records.filter(r =>
      !(provincia && r.pv !== provincia) &&
      !(soloAfectados && !r.af) &&
      !(alertasFiltro && !alertasFiltro.some(a => puntoRelacionado(a, r, regionActual))) &&
      !(comuna && r.c !== comuna) &&
      !(causa && r.cs !== causa) &&
      !(nivel && r.lv !== nivel) &&
      !(tipoSolucion && r.tp !== (tipoSolucion === SIN_INFO ? '' : tipoSolucion))
    );
  }, [records, provincia, soloAfectados, alertasFiltro, regionActual, comuna, causa, nivel, tipoSolucion]);

  const provincias = useMemo(() => [...new Set(records.map(r => r.pv).filter(Boolean))].sort(), [records]);
  const hayAfectados = useMemo(() => records.some(r => r.af), [records]);
  const comunas = useMemo(() => [...new Set(records.filter(r => !provincia || r.pv === provincia).map(r => r.c))].sort(), [records, provincia]);
  const causas = useMemo(() => [...new Set(records.map(r => r.cs).filter(Boolean))].sort(), [records]);
  const tipos = useMemo(() => [...new Set(records.map(r => r.tp).filter(Boolean))].sort(), [records]);
  const haySinTipo = useMemo(() => records.some(r => !r.tp), [records]);

  const value = {
    comuna, setComuna,
    causa, setCausa,
    nivel, setNivel,
    tipoSolucion, setTipoSolucion,
    provincia, setProvincia, provincias,
    soloAfectados, setSoloAfectados, hayAfectados,
    filtroAlerta, setFiltroAlerta, alertasConCausas,
    filtered,
    comunas,
    causas,
    tipos,
    haySinTipo,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be inside FilterProvider');
  return ctx;
}
