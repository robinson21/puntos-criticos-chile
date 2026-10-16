import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFilters } from '../data/FilterContext';
import { useData } from '../data/DataContext';
import AramcoMarkers from './AramcoMarkers';
import LayersControl from './LayersControl';
import 'leaflet/dist/leaflet.css';

const COLORS = {'Bajo':'#4FB6A8','Medio':'#E0B84D','Alto':'#E08D45','Muy Alto':'#D5514A'};

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY || '').trim();

// Atribuciones para los basemaps.
const ATTR_MT = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ATTR_OSM = '&copy; OpenStreetMap contributors';

// Probamos la key una vez. Si MapTiler responde distinto de 200 (key inválida/restringida),
// forzamos OSM y ocultamos el selector de basemap para no confundir.
function useMapTilerValida() {
  const [valida, setValida] = useState(() => !MAPTILER_KEY ? false : null); // null = no comprobado aún
  useEffect(() => {
    let activo = true;
    if (!MAPTILER_KEY) { setValida(false); return; }
    fetch(`https://api.maptiler.com/maps/basic-v2/6/18/38.png?key=${MAPTILER_KEY}`, { method: 'HEAD' })
      .then(r => activo && setValida(r.ok))
      .catch(() => activo && setValida(false));
    return () => { activo = false; };
  }, []);
  return valida;
}

const BASEMAPS = {
  // === ESRI (gratis, sin key, sin restricción de origen — respaldo fiable) ===
  esriSat: {
    label: '🛰️ Esri Satélite',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: () => 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  },
  esriHybrid: {
    label: '🛰️ Esri Híbrido',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: () => 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  },
  esriTopo: {
    label: '⛰️ Esri Topo',
    url: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attr: () => 'Tiles © Esri — Source: Esri'
  },
  // === MapTiler (necesita VITE_MAPTILER_KEY válida con Allowed Origins correcto) ===
  light: {
    label: '☀️ Claro (MT)',
    url: () => `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    attr: () => ATTR_MT
  },
  dark: {
    label: '🌙 Oscuro (MT)',
    url: () => `https://api.maptiler.com/maps/dark-matter/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    attr: () => ATTR_MT
  },
  satellite: {
    label: '🛰️ Satelital (MT)',
    url: () => `https://api.maptiler.com/maps/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
    attr: () => ATTR_MT
  },
  hybrid: {
    label: '🛰️ Híbrido (MT)',
    url: () => `https://api.maptiler.com/maps/hybrid-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    attr: () => ATTR_MT
  },
  topo: {
    label: '⛰️ Topográfico (MT)',
    url: () => `https://api.maptiler.com/maps/topographique-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    attr: () => ATTR_MT
  },
  gps: {
    label: '🗺️ GPS Calles',
    url: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: () => ATTR_OSM
  },
  gpsTopo: {
    label: '📐 GPS Topo',
    url: () => 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attr: () => '© <a href="https://opentopomap.org">OpenTopoMap</a> · © OpenStreetMap contributors'
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

// Marcador "Mi ubicación" — punto azul con halo pulsante (estilo Google Maps GPS).
function MyLocation({ coords }) {
  const map = useMap();
  const markerRef = useRef(null);
  const lastCoords = useRef(null);
  useEffect(() => {
    if (!coords || coords === lastCoords.current) return;
    lastCoords.current = coords;
    // Limpia marcador anterior
    if (markerRef.current) {
      try { map.removeLayer(markerRef.current); } catch (e) { /* noop */ }
    }
    // HTML custom: círculo azul con pulso
    const icon = L.divIcon({
      className: 'my-loc-marker',
      html: '<div class="my-loc-dot"></div><div class="my-loc-pulse"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    markerRef.current = L.marker(coords, { icon, interactive: false }).addTo(map);
    // Centra con zoom apropiado
    try { map.flyTo(coords, 13, { duration: 1.2 }); } catch (e) { /* noop */ }
    return () => {
      if (markerRef.current) {
        try { map.removeLayer(markerRef.current); } catch (e) { /* noop */ }
      }
    };
  }, [map, coords]);
  return null;
}

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
// Ajusta la vista a los puntos cuando cambia la región o la comuna (no con cada
// filtro de causa/nivel, para no hacer saltar el mapa). Los territorios insulares
// (Isla de Pascua, Juan Fernández, Desventuradas: lon < -76) se excluyen del encuadre salvo que
// sean lo único seleccionado; si no, Valparaíso se vería como un punto en el Pacífico.
function FitToPoints({ points, fitKey }) {
  const map = useMap();
  const lastKey = useRef(null);
  useEffect(() => {
    if (!points.length || fitKey === lastKey.current) return;
    lastKey.current = fitKey;
    const continentales = points.filter(p => p.lon > -76);
    const base = continentales.length ? continentales : points;
    const bounds = L.latLngBounds(base.map(p => [p.lat, p.lon]));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [30, 30], maxZoom: 13, duration: 0.8 });
  }, [map, points, fitKey]);
  return null;
}

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

// Capas ambientales estilo Zoom Earth:
//  - Incendios FIRMS (deshabilitado: el WMS público dejó de funcionar, ahora
//    requiere Map Key; queda bloqueado con 🔑 hasta que se configure FIRMS_KEY
//    en el proxy backend).
//  - Lluvia animada RainViewer (sin key).
//  - Viento / nubes / temperatura / precipitación OWM: servidas vía proxy
//    backend en `tileProxy` para no exponer la API key en el bundle.
// Si el proxy está caído, las capas se sirven desde OWM directo si owmKey está
// presente (fallback opcional).
function EnvironmentalLayers({ activeLayers, rainFrames, rainNow, owmKey, tileProxy }) {
  const map = useMap();
  const layersRef = useRef({});

  useEffect(() => {
    const add = (id, layer) => {
      layersRef.current[id] = layer;
      if (activeLayers.includes(id)) layer.addTo(map);
    };
    const remove = (id) => {
      const l = layersRef.current[id];
      if (l) { map.removeLayer(l); delete layersRef.current[id]; }
    };

    // 1. Incendios FIRMS — desactivado: el WMS público dejó de funcionar.
    //    Se deja la rama remove() para que el panel pueda apagar la capa limpia.
    if (activeLayers.includes('incendios')) {
      // Sin proxy FIRMS configurado: no se dibuja nada.
      remove('incendios');
    } else remove('incendios');

    // 2. Lluvia animada RainViewer (sin key).
    if (activeLayers.includes('lluvia') && rainFrames && rainFrames[rainNow]) {
      const ts = rainFrames[rainNow].time;
      const url = `https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/2/1_1.png`;
      if (!layersRef.current.lluvia) {
        add('lluvia', L.tileLayer(url, { tileSize: 256, opacity: 0.7, attribution: '© RainViewer' }));
      } else {
        layersRef.current.lluvia.setUrl(url);
      }
    } else remove('lluvia');

    // 3. Viento / nubes / temperatura vía PROXY backend (sin exponer key).
    //    Si no hay proxy y no hay key, no se dibujan.
    const owm = (layer) => {
      if (tileProxy) return `${tileProxy}/api/tiles/owm/${layer}/{z}/{x}/{y}.png`;
      if (owmKey) return `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${owmKey}`;
      return null;
    };
    if (tileProxy || owmKey) {
      if (activeLayers.includes('viento')) {
        const u = owm('wind_new');
        if (u && !layersRef.current.viento) add('viento', L.tileLayer(u, { opacity: 0.6 }));
      } else remove('viento');
      if (activeLayers.includes('nubes')) {
        const u = owm('clouds_new');
        if (u && !layersRef.current.nubes) add('nubes', L.tileLayer(u, { opacity: 0.6 }));
      } else remove('nubes');
      if (activeLayers.includes('temperatura')) {
        const u = owm('temp_new');
        if (u && !layersRef.current.temperatura) add('temperatura', L.tileLayer(u, { opacity: 0.6 }));
      } else remove('temperatura');
    } else {
      remove('viento'); remove('nubes'); remove('temperatura');
    }
  }, [map, activeLayers, rainFrames, rainNow, owmKey]);

  return null;
}

export default function MapView() {
  const { filtered } = useFilters();
  const { metadata, regionActual } = useData();
  const [baseMap, setBaseMap] = useState('esriSat');
  const OWM_KEY = (import.meta.env.VITE_OWM_KEY || '').trim();
  const hasOwmKey = OWM_KEY.length > 0;
  // Proxy backend para servir tiles OWM sin exponer la key en el bundle.
  // Default: Worker de Cloudflare en producción. Para desarrollo local,
  // sobreescribir con VITE_TILE_PROXY (ej. http://localhost:8081).
  const TILE_PROXY = (import.meta.env.VITE_TILE_PROXY || 'https://owm-proxy.robinson-armijo.workers.dev').trim();
  const hasTileProxy = TILE_PROXY.length > 0;
  const hasOwmSource = hasTileProxy || hasOwmKey;
  // Capas ambientales activas. Default: solo lluvia (incendios queda bloqueado sin FIRMS key).
  const [activeLayers, setActiveLayers] = useState(['lluvia']);
  const [rainFrames, setRainFrames] = useState(null); // timestamps RainViewer para animación
  const [rainNow, setRainNow] = useState(0); // índice del frame actual
  const maptilerValida = useMapTilerValida();
  const usarMapTiler = maptilerValida === true;
  const { comuna } = useFilters();

  const center = [-37, -71];
  const zoom = 6;

  // Toggle de capas ambientales (panel estilo Zoom Earth).
  function toggleLayer(id) {
    setActiveLayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // Carga frames de animación de lluvia desde RainViewer (gratis, sin key).
  useEffect(() => {
    if (!activeLayers.includes('lluvia')) return;
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data.radar?.past)) {
          setRainFrames([...data.radar.past, ...(data.radar.nowcast || [])]);
          setRainNow(0);
        }
      })
      .catch(() => setRainFrames(null));
  }, [activeLayers]);

  // Avanza la animación de lluvia cada 600ms.
  useEffect(() => {
    if (!rainFrames || rainFrames.length < 2) return;
    const t = setInterval(() => setRainNow(i => (i + 1) % rainFrames.length), 600);
    return () => clearInterval(t);
  }, [rainFrames]);

  // Estado para la geocodificación (búsqueda por dirección)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [flyTo, setFlyTo] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [recenterToken, setRecenterToken] = useState(0);
  // Estado para geolocation del usuario (botón "Mi ubicación")
  const [myLoc, setMyLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState('');
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

  // Geolocalización del navegador: pide permiso, centra el mapa y muestra un marcador.
  function locateMe() {
    setLocErr('');
    if (!('geolocation' in navigator)) {
      setLocErr('Tu navegador no soporta geolocalización.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setMyLoc([latitude, longitude]);
        setFlyTo([latitude, longitude]);
        setRecenterToken(0);
        setLocating(false);
        setLocErr('');
        // Guarda en consola para debug
        if (typeof console !== 'undefined' && console.log) {
          console.log(`[GPS] Ubicación: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`);
        }
      },
      err => {
        setLocating(false);
        if (err.code === 1) setLocErr('Permiso de ubicación denegado. Actívalo en tu navegador.');
        else if (err.code === 2) setLocErr('No se pudo determinar tu ubicación.');
        else if (err.code === 3) setLocErr('Tiempo agotado. Inténtalo de nuevo.');
        else setLocErr('Error desconocido al obtener ubicación.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  return (
    <div className="panel map-panel">
      <div className="panel-head">
        <h2>Mapa de puntos críticos</h2>
        <div className="map-controls">
          {usarMapTiler && (
            <select value={baseMap} onChange={e => setBaseMap(e.target.value)} className="basemap-select">
              <optgroup label="── Esri (gratis, sin key) ──">
                <option value="esriSat">🛰️ Esri Satélite</option>
                <option value="esriHybrid">🛰️ Esri Híbrido</option>
                <option value="esriTopo">⛰️ Esri Topo</option>
              </optgroup>
              <optgroup label="── MapTiler (con key) ──">
                <option value="light">☀️ Claro (MT)</option>
                <option value="dark">🌙 Oscuro (MT)</option>
                <option value="satellite">🛰️ Satelital (MT)</option>
                <option value="hybrid">🛰️ Híbrido (MT)</option>
                <option value="topo">⛰️ Topográfico (MT)</option>
              </optgroup>
              <optgroup label="── GPS (gratis) ──">
                <option value="gps">🗺️ GPS Calles</option>
                <option value="gpsTopo">📐 GPS Topo</option>
              </optgroup>
            </select>
          )}
          {!usarMapTiler && (
            <select value={baseMap} onChange={e => setBaseMap(e.target.value)} className="basemap-select">
              <optgroup label="── Esri (gratis, sin key) ──">
                <option value="esriSat">🛰️ Esri Satélite</option>
                <option value="esriHybrid">🛰️ Esri Híbrido</option>
                <option value="esriTopo">⛰️ Esri Topo</option>
              </optgroup>
              <optgroup label="── GPS (gratis) ──">
                <option value="gps">🗺️ GPS Calles</option>
                <option value="gpsTopo">📐 GPS Topo</option>
              </optgroup>
            </select>
          )}
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
      {/* map-stage: contenedor relativo para que los controles flotantes queden sobre el mapa */}
      <div className="map-stage">
      <MapContainer center={center} zoom={zoom} zoomControl={false} className="map-container" scrollWheelZoom={true}>
        <ZoomControl position="bottomright" />
        <TileLayer
          url={BASEMAPS[baseMap].url()}
          attribution={BASEMAPS[baseMap].attr()}
        />
        {/* Marcador "Mi ubicación" (GPS del navegador) */}
        {myLoc && <MyLocation coords={myLoc} />}
        {/* Capas ambientales (estilo Zoom Earth) */}
        <EnvironmentalLayers activeLayers={activeLayers} rainFrames={rainFrames} rainNow={rainNow} owmKey={OWM_KEY} tileProxy={hasTileProxy ? TILE_PROXY : null} />
        {recenterToken > 0 && <Recenter token={recenterToken} />}
        <FitToPoints points={filtered} fitKey={`${regionActual}|${comuna}`} />
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
      {/* Botón flotante "Mi ubicación" (GPS navegador) — estilo brújula */}
      <button
        type="button"
        className={`gps-locate-btn ${locating ? 'is-loading' : ''} ${myLoc ? 'is-active' : ''}`}
        onClick={locateMe}
        title="Centrar en mi ubicación (GPS)"
        aria-label="Centrar mapa en mi ubicación"
      >
        {locating ? '⏳' : '📍'}
      </button>
      {locErr && <div className="gps-locate-err">{locErr}</div>}
      <LayersControl activeLayers={activeLayers} onToggle={toggleLayer} hasOwmKey={hasOwmSource} hasFirmsKey={false} />
      </div>
      <div className="legend">
        {Object.entries(COLORS).map(([n, c]) => (
          <span key={n}><span className="dot" style={{background:c}}></span> {n}</span>
        ))}
      </div>
    </div>
  );
}
