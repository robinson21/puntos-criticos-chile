# Proxy de Tiles OpenWeatherMap (Cloudflare Worker)

## ¿Qué es?
Un **Worker de Cloudflare** que sirve de intermediario entre este portal (GitHub Pages)
y los tiles climáticos de OpenWeatherMap (viento, nubes, temperatura, precipitación).
Añade internamente la API key de OWM y cachea cada tile por 30 minutos.

## ¿Por qué existe?
El portal se despliega a GitHub Pages, que es **estático** (no puede ejecutar código de servidor).
Si el navegador llamara a `tile.openweathermap.org` directamente, tendría que incluir la API key
en el bundle de JS, quedando **visible para cualquiera** en DevTools. El proxy elimina ese riesgo:
la key vive solo como **secreto cifrado** en Cloudflare y **nunca llega al navegador**.

## URL pública de producción
```
https://owm-proxy.robinson-armijo.workers.dev
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Health check. Devuelve `{"ok":true}`. |
| GET | `/api/tiles/owm/{layer}/{z}/{x}/{y}` | Devuelve el tile PNG de la capa dada en coordenada XYZ. |
| GET | `/api/tiles/owm/{layer}/{z}/{x}/{y}.png` | Igual que arriba (acepta extensión `.png` opcional). |

### Capas válidas
- `clouds_new` — Nubosidad
- `wind_new` — Viento
- `temp_new` — Temperatura
- `precipitation_new` — Precipitación

## Código fuente del Worker
El código vive en **este repo** en la raíz `owm-proxy-worker.js` (y `wrangler.toml`).
Esto significa que el proyecto está **100% reproducible**: si Cloudflare se cae o la cuenta se pierde,
cualquier persona puede redesplegar el Worker en otra cuenta en ~1 minuto.

## Cómo redesplegar el Worker (si hiciera falta)
1. Necesitas un token de Cloudflare con permiso `Account → Workers Scripts:Edit` sobre la cuenta.
2. Configura el secreto (si no existe):
   ```bash
   echo "TU_API_KEY_OWM" | npx wrangler secret put OWM_API_KEY --name owm-proxy
   ```
3. Despliega:
   ```bash
   CLOUDFLARE_API_TOKEN=TU_TOKEN CLOUDFLARE_ACCOUNT_ID=TU_ACCOUNT_ID \
     npx wrangler deploy --name owm-proxy
   ```

## Seguridad del Worker
- **Validación de capas**: solo acepta las 4 capas listadas (no puede usarse como proxy abierto)
  → devuelve HTTP 400 para cualquier otra.
- **Validación de coordenadas**: `z` entre 0-19 y `x`/`y` dentro de `[0, 2^z - 1]`
  → devuelve HTTP 400 para coordenadas inválidas y HTTP 404 para rutas arbitrarias.
- **Cache 30 minutos**: reduce hasta ~90% de llamadas upstream a OpenWeatherMap.
- **Sin secretos en código**: la key vive en el secreto cifrado `OWM_API_KEY` de Cloudflare.

## Contacto / mantenimiento
- Worker: `owm-proxy.robinson-armijo` (cuenta Cloudflare de Robinson Armijo)
- Bundle de frontend: lo construye `vite build` leyendo `VITE_TILE_PROXY` (ver abajo).
- Para rotar la key de OWM: cambiar el secreto `OWM_API_KEY` en el dashboard de Cloudflare (0 cambios de código).
