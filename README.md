# Puntos Críticos Chile

Visualizador de los puntos críticos de la temporada de invierno reportados a **SENAPRED**, con mapa por región, filtros, ranking de comunas, pronóstico regional (OpenWeatherMap) y avisos/alertas de la **DMC**.

🌐 **https://puntos-criticos.gesstiapp.workers.dev** (Cloudflare) · respaldo: https://robinson21.github.io/puntos-criticos-chile/

## Qué ofrece

- Mapa por región con los puntos críticos coloreados por nivel de riesgo, filtros (comuna, causa, nivel, tipo de solución) y zoom automático a la región o comuna.
- Avisos, alertas y alarmas vigentes de la DMC junto al mapa, con los puntos críticos de las regiones afectadas.
- Capas: lluvia animada (RainViewer), nubes satelitales animadas (GOES-East, NASA GIBS), viento, nubes y temperatura (OpenWeatherMap) e incendios activos (NASA FIRMS, se activa con el secreto `FIRMS_MAP_KEY` del repo).
- **Estaciones de servicio expuestas:** cruce de las estaciones Aramco con los puntos críticos dentro de un radio (500 m a 5 km), las alertas DMC de su región y los focos de incendio a ≤ 10 km. Nivel de exposición (alta/media/baja), botón para verla en el mapa con su radio y exportación a CSV.
- **Vista nacional** al entrar: estaciones, alertas DMC e incendios de todo Chile sin elegir región.
- **Estado del Excel SENAPRED** en el encabezado: fecha del archivo, cuándo se revisó y si vino del sitio oficial o de la copia de respaldo (`senapred_estado.json`, solo en la rama `datos`).
- Vistas compartibles por URL (`?region=coquimbo&comuna=VICUÑA&nivel=Alto`) y exportación a CSV de lo filtrado.
- Indicador de antigüedad de alertas y pronóstico (ámbar > 14 h, rojo > 26 h).

## Desarrollo

```bash
npm ci
cp .env.example .env.local   # opcional: key de MapTiler
npm run dev
```

Variables de entorno: ver [`docs/ENV-VARS.md`](docs/ENV-VARS.md). En desarrollo, las capas de viento, nubes y temperatura necesitan `VITE_TILE_PROXY=https://puntos-criticos.gesstiapp.workers.dev`.

## Publicación en Cloudflare

| Pieza | Qué hace |
|---|---|
| `worker/index.js` + `wrangler.jsonc` | Worker `puntos-criticos`: sirve la app, entrega `/data/*.json` desde la rama `datos` (respaldo: GitHub Pages y luego la copia incluida) y reenvía `/api/*` y `/health` al Worker `owm-proxy` |
| `owm-proxy-worker.js` + `wrangler.owm-proxy.toml` | Worker `owm-proxy`: tiles OpenWeatherMap y NASA FIRMS con las claves como secretos |

- Cambios en la app: se publican solos al unirlos a `master` ([`cloudflare.yml`](.github/workflows/cloudflare.yml), requiere los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`). A mano: `npm run deploy`.
- Cambios en los datos: no requieren desplegar; GitHub Actions actualiza la rama `datos` cada 3 h.

## Estructura

| Ruta | Contenido |
|---|---|
| `src/data/` | `DataContext` (carga `meta.json` y la región elegida), `FilterContext` (filtros), `stats.js` (cifras derivadas), `alertas.js` (alertas DMC), `url.js` (estado en la URL), `csv.js` (exportación) |
| `src/components/` | Mapa, filtros, KPIs, gráficos, ranking, pronóstico, alertas |
| `public/data/` | JSON por región, `meta.json`, `alertas.json`, `pronostico_regional.json` (`incendios.json` lo genera el workflow) |
| `src/data/estaciones.js`, `EstacionesContext.jsx` | Cruce de estaciones con puntos críticos, alertas DMC e incendios |
| `owm-proxy-worker.js` | Worker de Cloudflare: tiles OWM y focos NASA FIRMS sin exponer las keys ([docs](docs/PROXY-OWM.md)) |

## Actualización de datos y publicación

El workflow [`publicar.yml`](.github/workflows/publicar.yml) hace todo en GitHub Actions, sin servidor:

| Cuándo | Qué |
|---|---|
| Cada 3 h | `actualizar_alertas.py` (avisos/alertas/alarmas DMC), `actualizar_pronostico.py` (pronóstico OpenWeatherMap) y `actualizar_incendios.py` (focos NASA FIRMS) |
| Una vez al día y en cada cambio a `master` | además `actualizar.py` (Excel de puntos críticos SENAPRED); si los datos cambian, se guardan en el repo |
| Siempre | deja los datos en la rama `datos` (de ahí los lee Cloudflare) y publica el respaldo en GitHub Pages |

Si una fuente falla, se publica lo último que ya estaba en el sitio. También se puede lanzar a mano desde *Actions → Actualizar datos y publicar → Run workflow*.

**Configuración (una vez):**
1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → New repository secret:*
   - `OPENWEATHER_API_KEY` — key de OpenWeatherMap para el pronóstico.
   - `FIRMS_MAP_KEY` — Map Key gratuita de NASA FIRMS ([pedirla aquí](https://firms.modaps.eosdis.nasa.gov/api/map_key/)) para la capa de incendios.
   - `VITE_MAPTILER_KEY` — opcional, para los mapas base de MapTiler.

Los scripts también se pueden correr a mano (`python3 actualizar_alertas.py`); escriben en `public/data/` del repo (o en `PC_PROJECT_DIR`).

## Fuentes y metodología

- Puntos críticos: SENAPRED, *Puntos Críticos Invierno 2026*. Solo se incluyen los registros con coordenadas.
- El **índice** del ranking es la cantidad de puntos de la comuna escalada a 100 respecto de la comuna con más puntos.
- Clima: OpenWeatherMap, RainViewer y NASA GIBS (GOES-East). Incendios: NASA FIRMS. Avisos: Dirección Meteorológica de Chile.
