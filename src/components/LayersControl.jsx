import { useState } from 'react';

// URLs de las capas ambientales disponibles (tipo Zoom Earth).
// Cada entrada define cómo construir la TileLayer / WMS de Leaflet.
// La activación la gestiona el padre (MapView) mediante el state `activeLayers`.
// `keyName` indica qué flag del padre la desbloquea (OWM via proxy o FIRMS).

export const CAPAS_AMBIENTALES = [
  {
    id: 'incendios',
    label: 'Incendios activos',
    icon: '🔥',
    color: '#dc2626',
    fuente: 'NASA FIRMS · 24h',
    descripcion: 'Focos de calor activos detectados por los satélites VIIRS en las últimas 24 horas. Se actualizan cada 3 h con la Map Key gratuita de NASA FIRMS (secreto FIRMS_MAP_KEY del repo).',
    necesitaKey: true,
    keyName: 'FIRMS',
    default: false
  },
  {
    id: 'lluviaNasa',
    label: 'Lluvia satelital NASA',
    icon: '🌧️',
    color: '#16a34a',
    fuente: 'NASA IMERG · 30 min · ~6 h atraso',
    descripcion: 'Lluvia estimada por satélites (NASA GPM IMERG) en todo Chile y el mar, cada 30 minutos de las últimas 6 horas disponibles. Llega con ~5-6 h de retraso, pero cubre todo el país.',
    necesitaKey: false,
    default: true
  },
  {
    id: 'pronostico',
    label: 'Pronóstico de lluvia',
    icon: '🔮',
    color: '#a78bfa',
    fuente: 'NOAA GFS · hora a hora · 48 h',
    descripcion: 'Lluvia pronosticada por el modelo GFS de NOAA (~25 km) para las próximas 48 horas. Es una orientación: no ve chubascos muy locales; las alertas oficiales son las de la DMC.',
    necesitaKey: false,
    default: true
  },
  {
    id: 'lluvia',
    label: 'Lluvia radar en vivo',
    icon: '📡',
    color: '#2563eb',
    fuente: 'RainViewer · Radar · 10 min',
    descripcion: 'Radar meteorológico casi en tiempo real (últimas ~2 h). En Chile hay pocos radares: donde no hay cobertura no se ve lluvia aunque llueva; usa la capa NASA para todo el país.',
    necesitaKey: false,
    default: true
  },
  {
    id: 'satelite',
    label: 'Nubes satélite animadas',
    icon: '🛰️',
    color: '#94a3b8',
    fuente: 'GOES-East · NASA GIBS',
    descripcion: 'Imágenes reales del satélite GOES-East de las últimas ~2 horas (color real de día, infrarrojo de noche). Muestra el avance de sistemas frontales y nubosidad.',
    necesitaKey: false,
    default: false
  },
  {
    id: 'viento',
    label: 'Viento',
    icon: '💨',
    color: '#0891b2',
    fuente: 'OpenWeatherMap (proxy)',
    descripcion: 'Viento en superficie (dirección e intensidad). Crítico para faenas con grúas, trabajos en altura y riesgo de incendios estructurales.',
    necesitaKey: false,
    default: false
  },
  {
    id: 'nubes',
    label: 'Nubes',
    icon: '☁️',
    color: '#64748b',
    fuente: 'OpenWeatherMap (proxy)',
    descripcion: 'Cobertura nubosa actual. Útil para verificar visibilidad y condiciones generales de operación.',
    necesitaKey: false,
    default: false
  },
  {
    id: 'temperatura',
    label: 'Temperatura',
    icon: '🌡️',
    color: '#f97316',
    fuente: 'OpenWeatherMap (proxy)',
    descripcion: 'Temperatura en superficie. Relevante para riesgo de golpe de calor y exposición a frío.',
    necesitaKey: false,
    default: false
  }
];

export default function LayersControl({ activeLayers, onToggle, hasOwmKey = false, hasFirmsKey = false }) {
  // Abierto en escritorio; en pantallas angostas parte cerrado para no tapar el mapa.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 700);

  return (
    <div className={`layers-control ${open ? 'open' : 'closed'}`}>
      <button
        className="layers-toggle"
        onClick={() => setOpen(o => !o)}
        title={open ? 'Ocultar capas' : 'Mostrar capas'}
        aria-label="Panel de capas ambientales"
      >
        {open ? '✕' : '🌐'}
      </button>

      {open && (
        <div className="layers-panel">
          <div className="layers-head">
            <strong>🛰️ Capas ambientales</strong>
            <small>estilo Zoom Earth</small>
          </div>
          {CAPAS_AMBIENTALES.map(c => {
            const activo = activeLayers.includes(c.id);
            const bloqueado = c.necesitaKey && !(c.keyName === 'FIRMS' ? hasFirmsKey : hasOwmKey);
            return (
              <label
                key={c.id}
                className={`layers-row ${activo ? 'on' : ''} ${bloqueado ? 'locked' : ''}`}
                title={c.descripcion}
              >
                <input
                  type="checkbox"
                  checked={activo}
                  disabled={bloqueado}
                  onChange={() => !bloqueado && onToggle(c.id)}
                />
                <span className="layers-icon" style={{ color: c.color }}>{c.icon}</span>
                <span className="layers-label">
                  <b>{c.label}</b>
                  <small>{c.fuente}{bloqueado && ' · 🔑'}</small>
                </span>
              </label>
            );
          })}
          <div className="layers-foot">
            <small>
              {hasOwmKey
                ? '✅ OWM servido por proxy backend (sin key en navegador)'
                : '🔑 Configura VITE_TILE_PROXY o VITE_OWM_KEY para viento/nubes/temperatura'}
              <br />
              {hasFirmsKey
                ? '✅ Incendios NASA FIRMS conectado'
                : '🔑 Incendios: falta la Map Key gratuita de NASA FIRMS (secreto FIRMS_MAP_KEY del repo).'}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
