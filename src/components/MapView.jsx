import { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet';
import { useFilters } from '../data/FilterContext';
import { useData } from '../data/DataContext';
import AramcoMarkers from './AramcoMarkers';
import 'leaflet/dist/leaflet.css';

const COLORS = {'Bajo':'#4FB6A8','Medio':'#E0B84D','Alto':'#E08D45','Muy Alto':'#D5514A'};

const REGION_CENTERS = {
  'METROPOLITANA DE SANTIAGO': [-33.45, -70.65],
  'VALPARAÍSO': [-33.05, -71.55],
  'BIOBÍO': [-36.83, -73.05],
  'COQUIMBO': [-30.55, -71.0],
  'LA ARAUCANÍA': [-38.75, -72.65],
  'LIBERTADOR GENERAL BERNARDO OHIGGINS': [-34.35, -70.75],
  'MAULE': [-35.45, -71.65],
  'LOS LAGOS': [-41.45, -73.0],
  'ÑUBLE': [-36.65, -72.0],
  'ATACAMA': [-27.35, -70.35],
  'LOS RÍOS': [-39.75, -72.75],
  'ANTOFAGASTA': [-23.65, -70.35],
  'AYSÉN DEL GENERAL CARLOS IBANEZ DEL CAMPO': [-45.55, -72.05],
  'MAGALLANES Y DE LA ANTÁRTICA CHILENA': [-53.15, -70.95],
};

export default function MapView() {
  const { filtered } = useFilters();
  const { metadata } = useData();
  const [baseMap, setBaseMap] = useState('dark');

  const center = [-35.675, -71.542];
  const zoom = 5;

  const displayPoints = filtered.slice(0, 2500);

  return (
    <div className="panel map-panel">
      <div className="panel-head">
        <h2>Mapa de puntos críticos</h2>
        <div className="map-controls">
          <select value={baseMap} onChange={e => setBaseMap(e.target.value)} className="basemap-select">
            <option value="dark">🌙 Oscuro</option>
            <option value="light">☀️ Claro</option>
          </select>
          <span className="count">{filtered.length.toLocaleString('es-CL')}</span>
        </div>
      </div>
      <MapContainer center={center} zoom={zoom} zoomControl={false} className="map-container" scrollWheelZoom={true}>
        <ZoomControl position="bottomright" />
        <TileLayer
          url={baseMap === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
          attribution='&copy; CARTO'
        />
        {displayPoints.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lon]}
            radius={3}
            pathOptions={{ color: COLORS[p.lv]||'#5D7284', fillColor: COLORS[p.lv]||'#5D7284', fillOpacity: 0.7, weight: 1 }}
          >
            <Popup>
              <div className="popup-content">
                <div className="popup-comuna">{p.c}</div>
                <div className="popup-row"><b>Causa:</b> {p.cs}</div>
                <div className="popup-row"><b>Riesgo:</b><span style={{color:COLORS[p.lv],fontWeight:600}}> {p.lv}</span></div>
                <div className="popup-row"><b>Solución:</b> {p.tp}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <AramcoMarkers />
      <div className="legend">
        {Object.entries(COLORS).map(([n, c]) => (
          <span key={n}><span className="dot" style={{background:c}}></span> {n}</span>
        ))}
      </div>
    </div>
  );
}
