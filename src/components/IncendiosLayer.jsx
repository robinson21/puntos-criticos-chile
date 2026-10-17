import { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { CLASE_INCENDIO, TIPO_INCENDIO, focosReales } from '../data/incendios';

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
  const margen = radioKm / 111;
  return puntos.filter(p =>
    focos.some(f => Math.abs(f.lat - p.lat) < margen && distanciaKm(p, f) <= radioKm)
  ).length;
}

const fecha = iso => (iso ? new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' }) : '—');
const iconoGran = L.divIcon({ className: 'icono-gran-incendio', html: '<span>🔥</span>', iconSize: [34, 34], iconAnchor: [17, 17] });

function PopupEvento({ e }) {
  const c = CLASE_INCENDIO[e.clase];
  return (
    <Popup>
      <div className="popup-content">
        <div className="popup-comuna">{c.icono} {e.tipo === 'industrial' ? 'Fuente de calor' : c.texto}{e.activo ? ' · activo' : ' · sin detecciones en 24 h'}</div>
        <div className="popup-linea"><b>Tipo:</b> {TIPO_INCENDIO[e.tipo].texto}</div>
        <div className="popup-linea"><b>Área detectada:</b> {String(e.area_km2).replace('.', ',')} km² · extensión ~{String(e.extension_km).replace('.', ',')} km</div>
        <div className="popup-linea"><b>Detecciones:</b> {e.detecciones} · potencia máx. por paso {Math.round(e.frp_pase)} MW</div>
        <div className="popup-linea"><b>Primera / última:</b> {fecha(e.primera)} → {fecha(e.ultima)}</div>
        <div className="popup-linea"><small>NASA FIRMS · VIIRS, focos de las últimas 72 h agrupados a ≤ 1,5 km</small></div>
      </div>
    </Popup>
  );
}

// Incendios (focos NASA FIRMS agrupados en eventos) y focos sueltos, de las últimas 72 h
export default function IncendiosLayer({ data, activo, puntos, onResumen }) {
  const eventos = data?.eventos || [];
  const reales24 = useMemo(() => focosReales(data, 24), [data]);
  const cerca = useMemo(() => puntosCercaDeFocos(puntos, reales24), [puntos, reales24]);

  useEffect(() => {
    if (!activo || !data) { onResumen?.(null); return; }
    const reales = eventos.filter(e => e.tipo !== 'industrial');
    onResumen?.({
      grandes: reales.filter(e => e.clase === 'gran' && e.activo && e.tipo === 'vegetacion').length,
      incendios: reales.filter(e => e.clase === 'incendio' && e.activo).length,
      focos: reales.filter(e => e.clase === 'foco' && e.activo).length,
      industriales: eventos.length - reales.length,
      cerca, radioKm: RADIO_KM, actualizado: data.actualizado,
    });
  }, [activo, data, eventos, cerca, onResumen]);

  if (!activo || !data) return null;
  const ahora = Date.now();
  return (
    <>
      {/* Focos individuales: más tenues si tienen más de 24 h o son de fuentes industriales */}
      {data.focos.map((f, i) => {
        const t = Date.parse(`${f.fecha}T${(f.hora || '').slice(0, 5)}:00Z`);
        const viejo = Number.isFinite(t) && ahora - t > 24 * 3600e3;
        return (
          <CircleMarker key={`f${i}`} center={[f.lat, f.lon]} radius={f.ind ? 2.5 : Math.min(7, 3 + Math.sqrt(f.frp || 0) / 3)}
            pathOptions={f.ind
              ? { color: '#94a3b8', weight: 1, fillColor: '#64748b', fillOpacity: 0.6 }
              : { color: '#fde047', weight: viejo ? 1 : 2, fillColor: f.frp > 30 ? '#b91c1c' : '#ea580c', fillOpacity: viejo ? 0.45 : 0.95 }} />
        );
      })}
      {/* Eventos: área aproximada coloreada por clase; industriales en gris punteado */}
      {eventos.filter(e => e.clase !== 'foco').map(e => (
        <Circle key={`e${e.id}`} center={[e.lat, e.lon]} radius={Math.max(700, e.extension_km * 500 + 400)}
          pathOptions={e.tipo === 'industrial'
            ? { color: '#94a3b8', weight: 1.5, dashArray: '4 4', fillOpacity: 0.05 }
            : { color: CLASE_INCENDIO[e.clase].color, weight: e.clase === 'gran' ? 3 : 2, dashArray: e.tipo === 'desierto' ? '6 4' : null,
              fillColor: CLASE_INCENDIO[e.clase].color, fillOpacity: e.activo ? 0.18 : 0.06 }}>
          <PopupEvento e={e} />
        </Circle>
      ))}
      {eventos.filter(e => e.clase === 'gran' && e.tipo === 'vegetacion' && e.activo).map(e => (
        <Marker key={`g${e.id}`} position={[e.lat, e.lon]} icon={iconoGran} zIndexOffset={2000}><PopupEvento e={e} /></Marker>
      ))}
    </>
  );
}
