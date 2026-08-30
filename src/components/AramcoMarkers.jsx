import { useState, useEffect, useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const ICON = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#0e7490" stroke="#22d3ee" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="16" fill="#fff">⛽</text></svg>'),
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const ICON_HIGHLIGHT = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f97316" stroke="#fef08a" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="16" fill="#fff">⛽</text></svg>'),
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export default function AramcoMarkers({ comuna, region }) {
  const [stations, setStations] = useState([]);
  const [visible, setVisible] = useState(false);
  const map = useMap();

  useEffect(() => {
    fetch('./data/aramco_estaciones.json')
      .then(r => r.json())
      .then(d => setStations(d))
      .catch(() => {});
  }, []);

  // Mapeo de nombre app → nombre Aramco
  const REGION_MAP = {
    'metropolitana de santiago': 'metropolitana',
    'la araucania': 'la araucania',
    'libertador general bernardo ohiggins': "libertador general bernardo o'higgins",
    'aysen del general carlos ibanez del campo': 'aysen',
    'magallanes y de la antartica chilena': 'magallanes y la antartica chilena',
  };

  // Normalizar strings para comparación
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, "'").trim();

  const nomRegion = (r) => {
    const n = norm(r);
    return REGION_MAP[n] || n;
  };

  // Estaciones filtradas por región y comuna
  const filtradas = useMemo(() => {
    if (!stations.length) return { enComuna: [], enRegion: [], totalRegion: 0, totalComuna: 0 };
    const regionTarget = nomRegion(region);
    const comunaTarget = norm(comuna);

    const enRegion = stations.filter(s => regionTarget ? norm(s.region).includes(regionTarget) : true);
    const enComuna = enRegion.filter(s => comunaTarget ? norm(s.locality).includes(comunaTarget) : false);

    return {
      enComuna,
      enRegion,
      totalRegion: enRegion.length,
      totalComuna: enComuna.length,
    };
  }, [stations, region, comuna]);

  const { enComuna, enRegion, totalRegion, totalComuna } = filtradas;

  // Mostrar estaciones: si hay comuna seleccionada, solo las de esa comuna; si no, todas las de la región
  const mostrar = visible
    ? (comuna && region ? enComuna : region ? enRegion : stations)
    : [];

  return (
    <>
      {/* Toggle button */}
      {stations.length > 0 && (
        <>
          <div className="aramco-toggle" onClick={() => setVisible(v => !v)} style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1000,
            background: visible ? '#0e7490' : '#1e293b', color: '#fff',
            border: visible ? '1px solid #22d3ee' : '1px solid #334155',
            borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,.4)',
            userSelect: 'none',
          }}>
            <span>⛽</span>
            <span>Aramco</span>
            <span style={{ fontSize: 10, opacity: .7 }}>
              {comuna && region ? totalComuna : region ? totalRegion : stations.length}
            </span>
          </div>

          {visible && region && (
            <div style={{
              position: 'absolute', top: 48, left: 12, zIndex: 1000,
              background: 'rgba(15,23,42,.85)', color: '#fff',
              border: '1px solid #334155', borderRadius: 8, padding: '8px 12px',
              fontSize: 11, lineHeight: 1.5, boxShadow: '0 2px 8px rgba(0,0,0,.4)',
              backdropFilter: 'blur(4px)', minWidth: 160,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>⛽ Estaciones Aramco</div>
              <div>En región: <b>{totalRegion}</b></div>
              {comuna && <div>En {comuna}: <b style={{color: '#f97316'}}>{totalComuna}</b> {totalComuna > 0 ? '🚨' : ''}</div>}
              {comuna && totalComuna > 0 && totalComuna <= 5 && <div style={{color:'#fbbf24', fontSize:10}}>⚠️ Pocas estaciones en comuna</div>}
            </div>
          )}
        </>
      )}

      {/* Marcadores: todas las estaciones de la región */}
      {visible && mostrar.map(s => {
        // Determinar si esta estación está en la comuna seleccionada
        const enComunaSeleccionada = comuna && region &&
          norm(s.region).includes(norm(region)) &&
          norm(s.locality).includes(norm(comuna));
        const icon = enComunaSeleccionada ? ICON_HIGHLIGHT : ICON;

        return (
          <Marker key={s.id} position={[s.coords.lat, s.coords.lng]} icon={icon}>
            <Popup>
              <b>⛽ {s.name}</b><br/>
              {s.address}<br/>
              {s.locality && <span style={{fontSize:11, color:'#94a3b8'}}>{s.locality}, {s.region}</span>}<br/>
              <span style={{ color: '#22d3ee', fontSize: 11 }}>{s.services?.join(' · ')}</span>
              {enComunaSeleccionada && <div style={{color:'#f97316', fontWeight:600, marginTop:4, fontSize:12}}>⚠️ En tu comuna seleccionada</div>}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
