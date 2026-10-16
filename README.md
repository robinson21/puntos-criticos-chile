# Puntos Críticos Chile

Visualizador de los puntos críticos de la temporada de invierno reportados a **SENAPRED**, con mapa por región, filtros, ranking de comunas, pronóstico regional (OpenWeatherMap) y avisos/alertas de la **DMC**.

🌐 https://robinson21.github.io/puntos-criticos-chile/

## Qué ofrece

- Mapa por región con los puntos críticos coloreados por nivel de riesgo, filtros (comuna, causa, nivel, tipo de solución) y zoom automático a la región o comuna.
- Avisos, alertas y alarmas vigentes de la DMC junto al mapa, con los puntos críticos de las regiones afectadas.
- Capas: lluvia animada (RainViewer), nubes satelitales animadas (GOES-East, NASA GIBS), viento, nubes y temperatura (OpenWeatherMap) e incendios activos (NASA FIRMS, se activa al configurar `FIRMS_MAP_KEY` en el Worker).
- Vistas compartibles por URL (`?region=coquimbo&comuna=VICUÑA&nivel=Alto`) y exportación a CSV de lo filtrado.
- Indicador de antigüedad de alertas y pronóstico (ámbar > 14 h, rojo > 26 h).

## Desarrollo

```bash
npm ci
cp .env.example .env.local   # opcional: key de MapTiler
npm run dev
```

Variables de entorno: ver [`docs/ENV-VARS.md`](docs/ENV-VARS.md). Sin `VITE_TILE_PROXY`, las capas de viento, nubes y temperatura usan el Worker de producción (`owm-proxy.robinson-armijo.workers.dev`).

## Estructura

| Ruta | Contenido |
|---|---|
| `src/data/` | `DataContext` (carga `meta.json` y la región elegida), `FilterContext` (filtros), `stats.js` (cifras derivadas), `alertas.js` (alertas DMC), `url.js` (estado en la URL), `csv.js` (exportación) |
| `src/components/` | Mapa, filtros, KPIs, gráficos, ranking, pronóstico, alertas |
| `public/data/` | JSON por región, `meta.json`, `alertas.json`, `pronostico_regional.json` |
| `owm-proxy-worker.js` | Worker de Cloudflare: tiles OWM y focos NASA FIRMS sin exponer las keys ([docs](docs/PROXY-OWM.md)) |

## Actualización de datos

| Script | Qué hace |
|---|---|
| `actualizar.py` | Descarga el Excel de SENAPRED y regenera los JSON regionales y `meta.json` (`--push` compila y publica) |
| `actualizar_alertas.py` | Avisos, alertas y alarmas vigentes de la DMC |
| `actualizar_pronostico.py` | Pronóstico 5 días por ciudad de referencia regional (requiere `OWM_API_KEY`) |

## Fuentes y metodología

- Puntos críticos: SENAPRED, *Puntos Críticos Invierno 2026*. Solo se incluyen los registros con coordenadas.
- El **índice** del ranking es la cantidad de puntos de la comuna escalada a 100 respecto de la comuna con más puntos.
- Clima: OpenWeatherMap, RainViewer y NASA GIBS (GOES-East). Incendios: NASA FIRMS. Avisos: Dirección Meteorológica de Chile.
