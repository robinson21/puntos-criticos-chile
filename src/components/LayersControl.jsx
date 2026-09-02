import { useState } from 'react';

// URLs de las capas ambientales disponibles (tipo Zoom Earth).
// Cada entrada define cómo construir la TileLayer / WMS de Leaflet.
// La activación la gestiona el padre (MapView) mediante el state `activeLayers`.

export const CAPAS_AMBIENTALES = [
  {
    id: 'incendios',
    label: 'Incendios activos',
    icon: '🔥',
    color: '#dc2626',
    fuente: 'NASA FIRMS · 24h',
    descripcion: 'Focos activos detectados por satélite (MODIS + VIIRS) en las últimas 24 horas. Útil para evaluar riesgo de evacuación en faenas cercanas a incendios.',
    necesitaKey: false,
    default: true
  },
  {
    id: 'lluvia',
    label: 'Lluvia animada',
    icon: '🌧️',
    color: '#2563eb',
    fuente: 'RainViewer · Radar',
    descripcion: 'Lluvia real a través de radar meteorológico (animación últimas 2h + pronóstico). Identifica tormentas severas y frentes activos.',
    necesitaKey: false,
    default: true
  },
  {
    id: 'viento',
    label: 'Viento',
    icon: '💨',
    color: '#0891b2',
    fuente: 'OpenWeatherMap',
    descripcion: 'Viento en superficie (dirección e intensidad). Crítico para faenas con grúas, trabajos en altura y riesgo de incendios estructurales.',
    necesitaKey: true,
    default: false
  },
  {
    id: 'nubes',
    label: 'Nubes',
    icon: '☁️',
    color: '#64748b',
    fuente: 'OpenWeatherMap',
    descripcion: 'Cobertura nubosa actual. Útil para verificar visibilidad y condiciones generales de operación.',
    necesitaKey: true,
    default: false
  },
  {
    id: 'temperatura',
    label: 'Temperatura',
    icon: '🌡️',
    color: '#f97316',
    fuente: 'OpenWeatherMap',
    descripcion: 'Temperatura en superficie. Relevante para riesgo de golpe de calor y exposición a frío.',
    necesitaKey: true,
    default: false
  }
];

export default function LayersControl({ activeLayers, onToggle, hasOwmKey = false }) {
  const [open, setOpen] = useState(true);

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
            const bloqueado = c.necesitaKey && !hasOwmKey;
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
                ? '✅ OpenWeatherMap conectado'
                : '🔑 OpenWeatherMap: añade VITE_OWM_KEY en .env.local para viento, nubes y temperatura'}
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
