// Worker del sitio Puntos Críticos Chile en Cloudflare.
// - Sirve la app (assets estáticos de dist/).
// - /data/*.json: datos frescos desde la rama "datos" del repo (la actualiza GitHub Actions
//   cada 3 h). Si GitHub no responde, usa la copia incluida en el sitio.
// - /api/* y /health: se reenvían al Worker owm-proxy (tiles OpenWeatherMap y NASA FIRMS),
//   que guarda las claves como secretos.
// Fuentes en orden: rama "datos" del repo y, mientras no exista, el respaldo en GitHub Pages.
const FUENTES = [
  ['github-datos', 'https://raw.githubusercontent.com/robinson21/puntos-criticos-chile/datos/'],
  ['github-pages', 'https://robinson21.github.io/puntos-criticos-chile/data/'],
];
const CACHE_DATOS_S = 300;

async function datos(request, env, ctx, archivo) {
  const cache = caches.default;
  const clave = new Request(new URL('/data/' + archivo, request.url).toString());
  const enCache = await cache.match(clave);
  if (enCache) return enCache;
  for (const [nombre, base] of FUENTES) {
    try {
      const r = await fetch(base + archivo, { cf: { cacheTtl: CACHE_DATOS_S } });
      if (!r.ok) continue;
      const resp = new Response(r.body, {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${CACHE_DATOS_S}`,
          'x-fuente-datos': nombre,
        },
      });
      ctx.waitUntil(cache.put(clave, resp.clone()));
      return resp;
    } catch { /* probar la siguiente fuente */ }
  }
  return env.ASSETS.fetch(request); // copia incluida en el último despliegue
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/data\/([a-z0-9_]+\.json)$/);
    if (m && request.method === 'GET') return datos(request, env, ctx, m[1]);
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') return env.OWM_PROXY.fetch(request);
    return env.ASSETS.fetch(request);
  },
};
