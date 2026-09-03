// owm-proxy-worker.js - Proxy de tiles OpenWeatherMap
// Recibe peticiones del portal y las reenvía a tile.openweathermap.org
// con la API key almacenada como secreto. Cachea tiles por 30 min.
const VALID_LAYERS = ['clouds_new', 'wind_new', 'temp_new', 'precipitation_new'];
const TILE_BASE = 'https://tile.openweathermap.org/map';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' },
      });
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
