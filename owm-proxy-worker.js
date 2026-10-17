// owm-proxy-worker.js - Proxy de tiles OpenWeatherMap y focos de incendio NASA FIRMS
// Recibe peticiones del portal y las reenvía a tile.openweathermap.org
// con la API key almacenada como secreto. Cachea tiles por 30 min.
// Si existe el secreto FIRMS_MAP_KEY, sirve además /api/firms con los focos
// activos de Chile continental (JSON), también cacheados 30 min.
const VALID_LAYERS = ['clouds_new', 'wind_new', 'temp_new', 'precipitation_new'];
const TILE_BASE = 'https://tile.openweathermap.org/map';

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
// Chile continental (oeste, sur, este, norte).
const FIRMS_AREA = '-76,-56.5,-66,-17.4';
// Satélites VIIRS en tiempo casi real; se pueden cambiar con la variable FIRMS_SOURCES.
const FIRMS_SOURCES_DEFAULT = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT';

const CORS = { 'Access-Control-Allow-Origin': '*' };
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

// CSV de FIRMS → [{lat, lon, frp, confianza, fecha, hora, satelite}]
function parseFirmsCsv(csv) {
  const lineas = csv.trim().split(/\r?\n/);
  if (lineas.length < 2) return [];
  const cab = lineas[0].split(',').map(h => h.trim());
  const i = name => cab.indexOf(name);
  const [iLat, iLon, iFrp, iConf, iFecha, iHora, iSat] =
    ['latitude', 'longitude', 'frp', 'confidence', 'acq_date', 'acq_time', 'satellite'].map(i);
  if (iLat < 0 || iLon < 0) throw new Error('CSV de FIRMS sin columnas latitude/longitude');
  const out = [];
  for (const linea of lineas.slice(1)) {
    const c = linea.split(',');
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const hora = iHora >= 0 ? String(c[iHora]).padStart(4, '0') : '';
    out.push({
      lat: Math.round(lat * 1e4) / 1e4,
      lon: Math.round(lon * 1e4) / 1e4,
      frp: iFrp >= 0 ? parseFloat(c[iFrp]) || 0 : 0,
      confianza: iConf >= 0 ? c[iConf] : '',
      fecha: iFecha >= 0 ? c[iFecha] : '',
      hora: hora ? `${hora.slice(0, 2)}:${hora.slice(2)} UTC` : '',
      satelite: iSat >= 0 ? c[iSat] : '',
    });
  }
  return out;
}

async function firms(request, env) {
  const key = env.FIRMS_MAP_KEY;
  if (!key) return json({ error: 'Missing FIRMS_MAP_KEY' }, 503);

  const url = new URL(request.url);
  const dias = Math.min(3, Math.max(1, parseInt(url.searchParams.get('dias') || '1', 10) || 1));
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/firms?dias=${dias}`, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const fuentes = String(env.FIRMS_SOURCES || FIRMS_SOURCES_DEFAULT).split(',').map(s => s.trim()).filter(Boolean);
  // Cada satélite por separado: si uno falla (o no existe), los otros igual sirven.
  const resultados = await Promise.allSettled(
    fuentes.map(async fuente => {
      // FIRMS cuenta días por fecha UTC: se pide uno más y se filtran las últimas `dias` × 24 h.
      const r = await fetch(`${FIRMS_BASE}/${key}/${fuente}/${FIRMS_AREA}/${dias + 1}`);
      const txt = await r.text();
      if (!r.ok || !txt.startsWith('latitude')) throw new Error(`${fuente}: HTTP ${r.status} ${txt.slice(0, 80)}`);
      return parseFirmsCsv(txt);
    })
  );
  const ok = resultados.filter(r => r.status === 'fulfilled');
  if (!ok.length) {
    return json({ error: 'FIRMS no respondió', detalle: resultados.map(r => r.reason?.message) }, 502);
  }
  const desde = Date.now() - dias * 24 * 3600 * 1000;
  const focos = ok.flatMap(r => r.value).filter(f => {
    const t = Date.parse(`${f.fecha}T${f.hora.slice(0, 5)}:00Z`);
    return !Number.isFinite(t) || t >= desde; // sin fecha/hora legible: mejor mostrarlo que perderlo
  });
  const resp = json(
    {
      actualizado: new Date().toISOString(),
      dias,
      fuentes,
      fallidas: resultados.filter(r => r.status === 'rejected').map(r => r.reason?.message),
      focos,
    },
    200,
    { 'Cache-Control': 'public, max-age=1800' }
  );
  await cache.put(cacheKey, resp.clone());
  return resp;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check. `firms` le indica al portal si puede habilitar la capa de incendios.
    if (path === '/health') {
      return json({ ok: true, firms: Boolean(env.FIRMS_MAP_KEY) });
    }

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' },
      });
    }

    // Focos de incendio activos (NASA FIRMS)
    if (path === '/api/firms') {
      return firms(request, env);
    }

    // /api/tiles/owm/{layer}/{z}/{x}/{y}
    const m = path.match(/^\/api\/tiles\/owm\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/);
    if (!m) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const [, layer, z, x, y] = m;

    // Validar capa
    if (!VALID_LAYERS.includes(layer)) {
      return new Response(JSON.stringify({ error: 'Invalid layer' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Validar coordenadas
    const zi = parseInt(z, 10);
    const xi = parseInt(x, 10);
    const yi = parseInt(y, 10);
    const maxCoord = Math.pow(2, zi);
    if (zi < 0 || zi > 19 || xi < 0 || xi >= maxCoord || yi < 0 || yi >= maxCoord) {
      return new Response(JSON.stringify({ error: 'Invalid coords' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const apiKey = env.OWM_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OWM_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Construir URL upstream
    const upstream = `${TILE_BASE}/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`;

    // Cachear por 30 min (300s)
    const cacheUrl = new URL(request.url);
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    const cache = caches.default;

    let cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const upstreamResp = await fetch(upstream);
      if (!upstreamResp.ok && upstreamResp.status !== 200) {
        return new Response(JSON.stringify({ error: 'Upstream error', status: upstreamResp.status }), {
          status: upstreamResp.status >= 500 ? 502 : upstreamResp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const resp = new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers: {
          'Content-Type': upstreamResp.headers.get('Content-Type') || 'image/png',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
      });

      // Almacenar en cache solo los 200
      if (upstreamResp.status === 200) {
        const copy = resp.clone();
        await cache.put(cacheKey, copy);
      }

      return resp;
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Fetch failed', detail: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
