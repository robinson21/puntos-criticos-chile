import { useMemo } from 'react';
import AnimacionTiles from './AnimacionTiles';
import { imagenHora, limites } from '../data/pronosticoLluvia';
import { cuadrosRecientes, urlTiles, IMERG } from '../data/gibs';

// Radar en vivo (RainViewer): últimas ~2 h cada 10 min, paleta 6 (verde → amarillo → rojo, como la de NASA)
// y suavizado. El plan gratuito llega hasta zoom 7; más cerca se escala. Pocos radares en Chile.
const cargarRadar = async () => {
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!r.ok) throw new Error(`RainViewer HTTP ${r.status}`);
  const d = await r.json();
  const host = d.host || 'https://tilecache.rainviewer.com';
  return [...(d.radar?.past || []), ...(d.radar?.nowcast || [])].map(f => ({
    url: `${host}${f.path}/256/{z}/{x}/{y}/6/1_1.png`,
    tiempo: new Date(f.time * 1000).toISOString(),
  }));
};

// Lluvia estimada por satélite NASA IMERG: todo Chile y el mar, cada 30 min de las últimas 6 h disponibles.
const cargarNasa = async () =>
  (await cuadrosRecientes({ ...IMERG, horas: 14, cuadros: 12, cadaMin: 30, omitirUltimo: false }))
    .map(t => ({ url: urlTiles(t, IMERG.capa, IMERG.matriz), tiempo: t }));

export function LluviaRadar({ activo, tiempo, onCuadros }) {
  return <AnimacionTiles activo={activo} cargar={cargarRadar} tiempo={tiempo} onCuadros={onCuadros} maxNativeZoom={7}
    opacidad={0.8} attribution="© RainViewer" zIndex={320} className="capa-radar" />;
}

export function LluviaNasa({ activo, tiempo, onCuadros }) {
  return <AnimacionTiles activo={activo} cargar={cargarNasa} tiempo={tiempo} onCuadros={onCuadros} maxNativeZoom={IMERG.zoomNativo}
    opacidad={0.75} refrescoMs={30 * 60 * 1000} attribution="Lluvia: NASA GPM IMERG (GIBS)" zIndex={310} className="capa-imerg" />;
}

// Pronóstico de lluvia GFS: una imagen por hora desde ahora hasta +48 h (se dibuja en el navegador).
export function LluviaPronostico({ activo, tiempo, onCuadros, pronostico }) {
  const cargar = useMemo(() => async () => {
    if (!pronostico) throw new Error('pronóstico no disponible');
    const desde = Date.now() - 30 * 60e3;
    return pronostico.horas.filter(h => h.t >= desde)
      .map(h => ({ url: imagenHora(pronostico, h), tiempo: h.iso, limites: limites(pronostico) }));
  }, [pronostico]);
  return <AnimacionTiles activo={activo && Boolean(pronostico)} cargar={cargar} tiempo={tiempo} onCuadros={onCuadros}
    opacidad={0.8} refrescoMs={60 * 60 * 1000} attribution="Pronóstico: NOAA GFS" zIndex={315} className="capa-pronostico" />;
}
