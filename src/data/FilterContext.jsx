import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useData } from './DataContext';
import { leerUrl, escribirUrl } from './url';

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

  // Refleja región y filtros en la URL (replaceState: no ensucia el historial).
  // Se espera a que cargue la región pedida en la URL para no borrarla antes.
  const [listo, setListo] = useState(!inicial.region);
  useEffect(() => {
    if (!listo) {
      if (regionActual) setListo(true);
      return;
    }
    escribirUrl({ region: regionActual, comuna, causa, nivel, tipo: tipoSolucion });
  }, [listo, regionActual, comuna, causa, nivel, tipoSolucion]);

  const filtered = useMemo(() => {
    if (!records.length) return [];
    return records.filter(r =>
      !(comuna && r.c !== comuna) &&
      !(causa && r.cs !== causa) &&
      !(nivel && r.lv !== nivel) &&
      !(tipoSolucion && r.tp !== (tipoSolucion === SIN_INFO ? '' : tipoSolucion))
    );
  }, [records, comuna, causa, nivel, tipoSolucion]);

  const comunas = useMemo(() => [...new Set(records.map(r => r.c))].sort(), [records]);
  const causas = useMemo(() => [...new Set(records.map(r => r.cs).filter(Boolean))].sort(), [records]);
  const tipos = useMemo(() => [...new Set(records.map(r => r.tp).filter(Boolean))].sort(), [records]);
  const haySinTipo = useMemo(() => records.some(r => !r.tp), [records]);

  const value = {
    comuna, setComuna,
    causa, setCausa,
    nivel, setNivel,
    tipoSolucion, setTipoSolucion,
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
