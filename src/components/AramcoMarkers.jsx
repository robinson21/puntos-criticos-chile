import { useEffect, useMemo, useRef } from 'react';
import { Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEstaciones } from '../data/EstacionesContext';
import { EXPOSICION, NIVELES, RADIO_INCENDIO_KM, fmtKm, regionSenapred } from '../data/estaciones';

// Ícono ⛽ con el color de su nivel de exposición (cacheado por color y tamaño)
const iconos = {};
function icono(color, grande) {
  const k = color + grande;
  if (!iconos[k]) {
    const s = grande ? 30 : 22;
    iconos[k] = new L.Icon({
      iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14.5" fill="${color}" stroke="#fff" stroke-width="${grande ? 3 : 2}"/><text x="16" y="21" text-anchor="middle" font-size="15">⛽</text></svg>`),
      iconSize: [s, s],
      iconAnchor: [s / 2, s / 2],
      popupAnchor: [0, -s / 2],
    });
  }
  return iconos[k];
}
const COLOR_BASE = '#0e7490';

export function PopupEstacion({ e, a, radioKm }) {
  return (
    <div className="popup-content">
      <div className="popup-comuna">⛽ {e.name}</div>
      <div className="popup-linea">{e.address}</div>
      {e.schedule && <div className="popup-linea"><small>{e.schedule}</small></div>}
      {a && (
        <>
          <div className="popup-linea" style={{ marginTop: 6 }}>
            <b>Exposición:</b> <span style={{ color: EXPOSICION[a.nivel].color, fontWeight: 700 }}>{EXPOSICION[a.nivel].texto}</span>
          </div>
          <div className="popup-linea">
            <b>Puntos críticos a ≤ {fmtKm(radioKm)}:</b> {a.puntos.total}
            {a.puntos.total > 0 && ` (${NIVELES.filter(n => a.puntos.porNivel[n]).map(n => `${a.puntos.porNivel[n]} ${n}`).join(', ')}) · más cercano a ${fmtKm(a.puntos.masCercano)}`}
          </div>
          {a.alertas.length > 0 && <div className="popup-linea"><b>DMC:</b> {a.alertas.map(x => `${x.tipo} ${x.fenomeno}`).join(' · ')}</div>}
          {a.incendios.cantidad > 0 && <div className="popup-linea" style={{ color: '#dc2626' }}><b>🔥 {a.incendios.cantidad} focos a ≤ {RADIO_INCENDIO_KM} km</b> · más cercano a {fmtKm(a.incendios.masCercano)}</div>}
        </>
      )}
    </div>
  );
}

function IrA({ a, radioKm }) {
  const map = useMap();
  useEffect(() => {
    if (!a) return;
    const zoom = radioKm <= 0.5 ? 16 : radioKm <= 1 ? 15 : radioKm <= 2 ? 14 : 12;
    map.flyTo([a.pos.lat, a.pos.lon], zoom, { duration: 0.8 });
  }, [a, radioKm, map]);
  return null;
}

export default function AramcoMarkers({ comuna, region }) {
  const { estaciones, porId, radioKm, seleccion, visibles, setVisibles } = useEstaciones();
  const refs = useRef({});

  // Si hay región: solo sus estaciones (y de la comuna, si se eligió). Sin región: todas.
  const lista = useMemo(() => {
    if (!region) return estaciones;
    return estaciones.filter(e => regionSenapred(e.region) === region && (!comuna || porId[e.id]));
  }, [estaciones, region, comuna, porId]);

  const sel = seleccion != null ? porId[seleccion] : null;
  useEffect(() => {
    if (sel) setTimeout(() => refs.current[sel.estacion.id]?.openPopup(), 900);
  }, [sel]);

  if (!estaciones.length) return null;
  const expuestas = lista.filter(e => porId[e.id] && porId[e.id].nivel !== 'sin').length;

  return (
    <>
      <button type="button" className={`aramco-toggle ${visibles ? 'on' : ''}`} onClick={() => setVisibles(v => !v)}
        aria-pressed={visibles} title="Mostrar u ocultar las estaciones de servicio">
        <span aria-hidden>⛽</span> Estaciones <span className="aramco-num">{lista.length}</span>
        {expuestas > 0 && <span className="aramco-alerta">{expuestas} expuestas</span>}
      </button>

      {visibles && lista.map(e => {
        const a = porId[e.id];
        const elegida = sel?.estacion.id === e.id;
        return (
          <Marker key={e.id} position={[e.coords.lat, e.coords.lng]} icon={icono(a ? EXPOSICION[a.nivel].color : COLOR_BASE, elegida)}
            zIndexOffset={elegida ? 1000 : a ? EXPOSICION[a.nivel].orden * 100 : 0} ref={r => { refs.current[e.id] = r; }}>
            <Popup><PopupEstacion e={e} a={a} radioKm={radioKm} /></Popup>
          </Marker>
        );
      })}
      {visibles && sel && (
        <Circle center={[sel.pos.lat, sel.pos.lon]} radius={radioKm * 1000}
          pathOptions={{ color: EXPOSICION[sel.nivel].color, weight: 2, fillOpacity: 0.08, dashArray: '6 4' }} />
      )}
      <IrA a={sel} radioKm={radioKm} />
    </>
  );
}
