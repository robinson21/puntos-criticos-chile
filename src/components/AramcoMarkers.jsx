import { useState, useEffect } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';

const ICON = new (typeof window !== 'undefined' ? window.L : {}).Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#0e7490" stroke="#22d3ee" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="16" fill="#fff">⛽</text></svg>'),
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function AramcoMarkers() {
  const [stations, setStations] = useState([]);
  const [visible, setVisible] = useState(false);
  const map = useMap();

  useEffect(() => {
    fetch('./data/aramco_estaciones.json')
      .then(r => r.json())
      .then(d => setStations(d))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Toggle button inside map */}
      {stations.length > 0 && (
        <div className="aramco-toggle" onClick={() => setVisible(v => !v)} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: visible ? '#0e7490' : '#1e293b', color: '#fff',
          border: visible ? '1px solid #22d3ee' : '1px solid #334155',
          borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,.4)',
        }}>
          <span>⛽</span>
          <span>Aramco</span>
          <span style={{ fontSize: 10, opacity: .7 }}>{stations.length}</span>
        </div>
      )}
      {visible && stations.filter(s => s.coords?.lat).map(s => (
        <Marker key={s.id} position={[s.coords.lat, s.coords.lng]} icon={ICON}>
          <Popup>
            <b>⛽ {s.name}</b><br/>
            {s.address}<br/>
            <span style={{ color: '#22d3ee', fontSize: 11 }}>{s.services?.join(' · ')}</span>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
