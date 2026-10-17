import AnimacionTiles from './AnimacionTiles';
import { cuadrosRecientes, urlTiles, IMERG } from '../data/gibs';

// Radar en vivo (RainViewer): últimas ~2 h cada 10 min. El plan gratuito llega hasta zoom 7;
// más cerca se escala el tile de z7. Cobertura limitada en Chile (pocos radares).
const cargarRadar = async () => {
  const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!r.ok) throw new Error(`RainViewer HTTP ${r.status}`);
  const d = await r.json();
  const host = d.host || 'https://tilecache.rainviewer.com';
  return [...(d.radar?.past || []), ...(d.radar?.nowcast || [])].map(f => ({
    url: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
    tiempo: new Date(f.time * 1000).toISOString(),
  }));
};

// Lluvia estimada por satélite NASA IMERG: todo Chile y el mar, cada 30 min de las últimas 6 h disponibles.
const cargarNasa = async () =>
  (await cuadrosRecientes({ ...IMERG, horas: 14, cuadros: 12, cadaMin: 30, omitirUltimo: false }))
    .map(t => ({ url: urlTiles(t, IMERG.capa, IMERG.matriz), tiempo: t }));

export function LluviaRadar({ activo, onEstado }) {
  return <AnimacionTiles activo={activo} cargar={cargarRadar} onEstado={onEstado} maxNativeZoom={7}
    opacidad={0.75} pasoMs={600} attribution="© RainViewer" zIndex={320} />;
}

export function LluviaNasa({ activo, onEstado }) {
  return <AnimacionTiles activo={activo} cargar={cargarNasa} onEstado={onEstado} maxNativeZoom={IMERG.zoomNativo}
    opacidad={0.7} pasoMs={700} refrescoMs={30 * 60 * 1000} attribution="Lluvia: NASA GPM IMERG (GIBS)" zIndex={310} />;
}
