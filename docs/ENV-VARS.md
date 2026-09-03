# Variables de entorno / configuración

## Frontend (Vite)

Archivos relevantes: `.env.local` (dev) y `.env.production` (build de producción).
> ⚠️ `.env.production`, `.env.local` y `.env` están en `.gitignore` — **no** se commitean
> porque pueden contener claves. La URL pública del Worker se incrusta en el bundle en build-time.

| Variable | Dónde | Para qué | ¿Secreto? |
|---|---|---|---|
| `VITE_MAPTILER_KEY` | `.env.local` | Basemap de MapTiler (calles/vistas claro y oscuro) | ⚠️ Sí (client-side, pero es la URL de tiles de MapTiler) |
| `VITE_TILE_PROXY` | `.env.production` | URL pública del Worker de Cloudflare que sirve los tiles OWM | No (URL pública del Worker) |
| `VITE_OWM_KEY` | `.env.local` (solo fallback dev) | Key directa de OpenWeatherMap para tiles. **Solo para desarrollo local**. En producción se usa el proxy. | ✅ Sí |

> **Regla de seguridad**: En producción (`npm run build`), si `VITE_OWM_KEY` está presente, el código
> usaría tiles directos de OWM (exponiendo la key). El código está preparado para usar el **proxy**
> siempre que exista `VITE_TILE_PROXY`, y solo cae a la key directa en desarrollo. No pongas `VITE_OWM_KEY`
> en `.env.production`.

## Cloudflare (secreto del Worker)

El Worker `owm-proxy` lee una variable secreta al vuelo:

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `OWM_API_KEY` | Secretos cifrados de Cloudflare (`wrangler secret put`) | Key de OpenWeatherMap que el Worker usa para pedir los tiles upstream |

> El secreto NO está en este repo. Solo se configura vía `wrangler secret put` en Cloudflare.

## Cómo reconstruir el entorno desde cero

1. Clonar repo.
2. Crear `.env.local` con `VITE_MAPTILER_KEY` (y opcionalmente `VITE_OWM_KEY` solo para dev).
3. Crear `.env.production` con `VITE_TILE_PROXY=https://owm-proxy.robinson-armijo.workers.dev`.
4. `npm install && npm run build && npm run deploy` (despliega `dist/` a gh-pages).

## Despliegue
- Build y push a `gh-pages`: `npm run deploy` (= `vite build && gh-pages -d dist`).
- El bundle resultante incrusta la URL de `VITE_TILE_PROXY` (la del Worker).
