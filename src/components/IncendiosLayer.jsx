import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';

const REFRESCO_MS = 30 * 60 * 1000; // el Worker cachea 30 min
const RADIO_KM = 5;

// Distancia aproximada en km (equirectangular: sobra para radios de pocos km).
function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

// Puntos críticos a menos de RADIO_KM de algún foco.
export function puntosCercaDeFocos(puntos, focos, radioKm = RADIO_KM) {
  if (!focos.length || !puntos.length) return 0;
  const margen = radioKm / 111; // grados de latitud
  return puntos.filter(p =>
    focos.some(f => Math.abs(f.lat - p.lat) < margen && distanciaKm(p, f) <= radioKm)
  ).length;
}

// Focos de incendio activos (NASA FIRMS, últimas 24 h) servidos por el Worker.
export default function IncendiosLayer({ proxy, activo, puntos, onResumen }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!activo || !proxy) return;
    let vivo = true;
    const cargar = () =>
      fetch(`${proxy}/api/firms`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(d => vivo && setData(d))
        .catch(e => vivo && setData({ error: e.message, focos: [] }));
    cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => { vivo = false; clearInterval(t); };
  }, [activo, proxy]);

  const focos = data?.focos || [];
  const cerca = useMemo(() => puntosCercaDeFocos(puntos, focos), [puntos, focos]);

  useEffect(() => {
    onResumen?.(activo && data ? { focos: focos.length, cerca, error: data.error, radioKm: RADIO_KM } : null);
  }, [activo, data, focos.length, cerca, onResumen]);

  if (!activo) return null;
  return focos.map((f, i) => (
    <CircleMarker
      key={i}
      center={[f.lat, f.lon]}
      radius={Math.min(10, 4 + Math.sqrt(f.frp || 0) / 2)}
      // Borde amarillo grueso para no confundirlos con los puntos de riesgo "Muy Alto".
      pathOptions={{ color: '#fde047', weight: 2.5, fillColor: f.frp > 30 ? '#b91c1c' : '#ea580c', fillOpacity: 0.95 }}
    >
      <Popup>
        <div className="popup-content">
          <div className="popup-comuna">🔥 Foco de calor activo</div>
          <div className="popup-row"><b>Detectado:</b> {f.fecha} {f.hora}</div>
          <div className="popup-row"><b>Potencia (FRP):</b> {f.frp} MW</div>
          {f.confianza && <div className="popup-row"><b>Confianza:</b> {{ l: 'baja', n: 'nominal', h: 'alta' }[f.confianza] || f.confianza}</div>}
          <div className="popup-row"><small>NASA FIRMS · VIIRS</small></div>
        </div>
      </Popup>
    </CircleMarker>
  ));
}
