import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useData } from './DataContext';
import { useFilters } from './FilterContext';
import { useAlertas } from './alertas';
import { analizarEstaciones } from './estaciones';
import { usePronosticoLluvia } from './pronosticoLluvia';
import { useIncendios, focosReales, grandesActivos } from './incendios';

const EstacionesContext = createContext(null);

// Estaciones, su exposición (calculada con los puntos filtrados) y la estación seleccionada,
// compartidas entre el mapa y el panel de estaciones expuestas.
export function EstacionesProvider({ children }) {
  const { regionActual } = useData();
  const { filtered, comuna } = useFilters();
  const { data: alertas } = useAlertas();
  const pronostico = usePronosticoLluvia();
  const incendios = useIncendios();
  const focos = useMemo(() => focosReales(incendios, 24), [incendios]);
  const grandes = useMemo(() => grandesActivos(incendios), [incendios]);
  const [estaciones, setEstaciones] = useState([]);
  const [radioKm, setRadioKm] = useState(1);
  const [seleccion, setSeleccion] = useState(null);
  const [visibles, setVisibles] = useState(true);

  useEffect(() => {
    fetch('./data/aramco_estaciones.json').then(r => r.json()).then(d => setEstaciones(Array.isArray(d) ? d.filter(e => e.coords) : [])).catch(() => {});
  }, []);

  useEffect(() => { setSeleccion(null); }, [regionActual, comuna]);

  const analisis = useMemo(
    () => analizarEstaciones({ estaciones, region: regionActual, comuna, puntos: filtered, alertas: alertas?.alertas, focos, grandes, radioKm, pronostico }),
    [estaciones, regionActual, comuna, filtered, alertas, focos, grandes, radioKm, pronostico]
  );
  const porId = useMemo(() => Object.fromEntries(analisis.map(a => [a.estacion.id, a])), [analisis]);

  const seleccionar = id => {
    setSeleccion(id);
    if (id != null) setVisibles(true);
  };

  return (
    <EstacionesContext.Provider value={{ estaciones, analisis, porId, radioKm, setRadioKm, seleccion, seleccionar, visibles, setVisibles, focos }}>
      {children}
    </EstacionesContext.Provider>
  );
}

export function useEstaciones() {
  const ctx = useContext(EstacionesContext);
  if (!ctx) throw new Error('useEstaciones debe usarse dentro de EstacionesProvider');
  return ctx;
}
