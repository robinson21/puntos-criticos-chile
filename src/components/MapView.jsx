import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { useFilters } from '../data/FilterContext';
import 'leaflet/dist/leaflet.css';

const TILE_STYLES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const NIVEL_COLORS = {
  'Bajo': '#4FB6A8',
  'Medio': '#E0B84D',
  'Alto': '#E08D45',
  'Muy Alto': '#D5514A',
};

export default function MapView() {
  const { filtered, ranking } = useFilters();
  const [baseMap, setBaseMap] = useState('dark');
  const [activeComuna, setActiveComuna] = useState(null);

  // Center on Chile
  const center = [-35.675, -71.542];
  const maxPoints = 3000;

  // Sample if too many points
  const displayPoints = filtered.length > maxPoints
    ? filtered.filter(() => Math.random() < maxPoints / filtered.length)
    : filtered;

  return (
    <div className="panel map-panel">
      <div className="panel-head">
        <h2>Mapa de puntos críticos</h2>
        <div className="map-controls">
          <select value={baseMap} onChange={e => setBaseMap(e.target.value)} className="basemap-select">
            <option value="dark">🌙 Oscuro</option>
            <option value="light">☀️ Claro</option>
          </select>
          <span className="count">{filtered.length.toLocaleString('es-CL')} puntos</span>
        </div>
      </div>
      <MapContainer
        center={center}
        zoom={5}
        zoomControl={false}
        className="map-container"
        scrollWheelZoom={true}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url={TILE_STYLES[baseMap]}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {displayPoints.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={3}
            pathOptions={{
              color: NIVEL_COLORS[p.nivel] || '#5D7284',
              fillColor: NIVEL_COLORS[p.nivel] || '#5D7284',
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div className="popup-content">
                <div className="popup-comuna">{p.comuna}</div>
                <div className="popup-row"><b>Sector:</b> {p.sector}</div>
                <div className="popup-row"><b>Causa:</b> {p.causa}</div>
                <div className="popup-row"><b>Riesgo:</b>
                  <span style={{color: NIVEL_COLORS[p.nivel], fontWeight:600}}> {p.nivel}</span>
                </div>
                <div className="popup-row"><b>Solución:</b> {p.tipo}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="legend">
        {Object.entries(NIVEL_COLORS).map(([n, c]) => (
          <span key={n}><span className="dot" style={{background:c}}></span> {n}</span>
        ))}
      </div>
    </div>
  );
}
