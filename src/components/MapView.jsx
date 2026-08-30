import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import { useFilters } from '../data/FilterContext';
import { useData } from '../data/DataContext';
import AramcoMarkers from './AramcoMarkers';
import 'leaflet/dist/leaflet.css';

const COLORS = {'Bajo':'#4FB6A8','Medio':'#E0B84D','Alto':'#E08D45','Muy Alto':'#D5514A'};

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();

const BASEMAPS = {
  light: {
    label: '☀️ Claro',
    url: MAPTILER_KEY
      ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: MAPTILER_KEY
      ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : '&copy; OpenStreetMap contributors'
  },
  dark: {
    label: '🌙 Oscuro',
    url: MAPTILER_KEY
      ? `https://api.maptiler.com/maps/dark-matter/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: MAPTILER_KEY
      ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : '&copy; OpenStreetMap contributors'
  }
};

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

// Componente que centra el mapa en unas coordenadas (marca geocodificada).
// Solo se dispara cuando coords cambia; no vuelve a disparar en re-renders.
function FlyTo({ coords }) {
  const map = useMap();
  const lastCoords = useRef(null);

  // Si coords cambió desde la última vez, vuela ahí (solo una vez por destino)
  if (coords && coords !== lastCoords.current) {
    try {
      map.flyTo(coords, 11, { duration: 1.2 });
    } catch (e) {
      /* noop */
    }
  }
  if (coords) lastCoords.current = coords;
  return null;
}

// Componente que re-centra a Chile (uso al limpiar la búsqueda). Se dispara
// una sola vez por incremento de token.
function Recenter({ token }) {
  const map = useMap();
  const lastToken = useRef(token);
  if (token > 0 && token !== lastToken.current) {
    lastToken.current = token;
    try {
      map.flyTo([-37, -71], 6, { duration: 1.2 });
    } catch (e) {
      /* noop */
    }
  }
  return null;
}

export default function MapView() {
  const { filtered } = useFilters();
  const { metadata, regionActual } = useData();
  const [baseMap, setBaseMap] = useState('dark');
  const { comuna } = useFilters();

  const center = [-37, -71];
  const zoom = 6;

  // Estado para la geocodificación (búsqueda por dirección)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [recenterToken, setRecenterToken] = useState(0);
  const debounceRef = useRef(null);

  const displayPoints = filtered.slice(0, 2500);

  // Buscar direcciones con la API de geocodificación de MapTiler (o Nominatim como fallback)
  async function runSearch(raw) {
    // Limpiar estados previos
    setResults([]);
    setSearching(true);
    setSearchMsg('Buscando…');
    setFlyTo(null);
    setRecenterToken(0);

    let items = [];
    let maptilerKeyOk = false;
    if (MAPTILER_KEY) {
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(raw)}.json?key=${MAPTILER_KEY}&language=es&limit=5&country=cl`;
        const res = await fetch(url);
        const data = await res.json();
        // Si MapTiler devuelve "Invalid key" o un array vacío (key sin permiso),
        // marcamos que no funcionó para saltar al respaldo.
        if (data && Array.isArray(data.features)) {
          items = data.features.map(f => ({
            id: f.id,
            label: f.place_name_es || f.place_name || f.text,
            lat: f.center?.[1],
            lon: f.center?.[0]
          }));
          if (items.length >= 0) maptilerKeyOk = true;
        }
      } catch (e) {
        items = []; // key inválida -> respaldo
      }
    }

    // Si MapTiler no dio resultados (key inválida o sin permisos),
    // respaldo garantizado: Nominatim (OSM, gratis, sin key, mundial).
    if (items.length === 0 || !maptilerKeyOk) {
      try {
        const tryQuery = async (q) => {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=cl&accept-language=es&polygon_geojson=0`;
          return (await (await fetch(url)).json()) || [];
        };
        let data = await tryQuery(raw);
        // Si la dirección completa no dio resultados, relajar:
        // quitar números de calle y volver a intentar (busca calle/comuna).
        if (data.length === 0) {
          // Reemplaza patrones tipo "123", "123-A", "N°123" por espacio
          const simplificado = raw.replace(/n[º°]\s*\d+/i, ' ').replace(/\b\d+\s*-\s*\d+\b/g, ' ').replace(/[0-9]+[a-zA-Z]?/g, ' ').replace(/\s+/g, ' ').trim();
          if (simplificado && simplificado !== raw) data = await tryQuery(simplificado);
        }
        // Si aún nada, buscar la última parte (comuna/ciudad más probable).
        if (data.length === 0) {
          const partes = raw.split(',').map(p => p.trim()).filter(Boolean);
          if (partes.length > 1) data = await tryQuery(partes[partes.length - 1]);
        }
        items = (data || []).filter(r => r.lat && r.lon).map(r => ({
          id: r.place_id,
          label: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon)
        }));
      } catch (e) {
        items = [];
      }
    }

    setSearching(false);
    if (items.length === 0) {
      setSearchMsg('No se encontró la dirección en Chile. Prueba con más detalle (ej: "Ruta 5, km 812, Talca").');
      return;
    }
    setResults(items);
    setSearchMsg('');
    // Si hay exactamente un resultado, ir directo
    if (items.length === 1) gotoPoint(items[0]);
  }

  function gotoPoint(r) {
    setFlyTo([r.lat, r.lon]);
    setResults([]);
    setQuery(r.label);
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setSearchMsg('');
    setFlyTo(null);
    setRecenterToken(t => t + 1);
  }

  function onSearchChange(v) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (v.trim().length >= 3) runSearch(v.trim());
    }, 700);
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runSearch(query.trim());
    }
  }

  return (
    <div className="panel map-panel">
      <div className="panel-head">
        <h2>Mapa de puntos críticos</h2>
        <div className="map-controls">
          <select value={baseMap} onChange={e => setBaseMap(e.target.value)} className="basemap-select">
            {Object.entries(BASEMAPS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <span className="count">{filtered.length.toLocaleString('es-CL')}</span>
        </div>
      </div>

      {/* Barra de búsqueda / geocodificación */}
      <div className="geocoder">
        <div className="geocoder-row">
          <input
            type="text"
            value={query}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Buscar dirección o lugar en Chile (ej: Av. José Miguel Carrera 100, Talcahuano)"
            className="geocoder-input"
            aria-label="Buscar dirección o comuna"
          />
          {query && (
            <button className="geocoder-clear" onClick={clearSearch} title="Limpiar">
              ✕
            </button>
          )}
        </div>
        {searching && <div className="geocoder-msg">Buscando…</div>}
        {searchMsg && !searching && <div className="geocoder-msg error">{searchMsg}</div>}
        {results.length > 0 && (
          <ul className="geocoder-results">
            {results.map(r => (
              <li key={r.id} onClick={() => gotoPoint(r)}>
                <span className="geocoder-pin">📍</span>
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Punto geocodificado (marcador) y re-centrado a Chile se manejan dentro del MapContainer */}
      <MapContainer center={center} zoom={zoom} zoomControl={false} className="map-container" scrollWheelZoom={true}>
        <ZoomControl position="bottomright" />
        <TileLayer url={BASEMAPS[baseMap].url} attribution={BASEMAPS[baseMap].attr} />
        {recenterToken > 0 && <Recenter token={recenterToken} />}
        {flyTo && <FlyTo coords={flyTo} />}
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
        <AramcoMarkers comuna={comuna} region={regionActual} />
        {flyTo && (
          <CircleMarker
            center={flyTo}
            radius={9}
            pathOptions={{ color: '#D5514A', fillColor: '#D5514A', fillOpacity: 0.9, weight: 3 }}
          >
            <Popup>
              <div className="popup-content">
                <div className="popup-comuna">Ubicación buscada</div>
                <div className="popup-row">{query}</div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
      <div className="legend">
        {Object.entries(COLORS).map(([n, c]) => (
          <span key={n}><span className="dot" style={{background:c}}></span> {n}</span>
        ))}
      </div>
    </div>
  );
}
