# Puntos Críticos Chile

Visualizador de los puntos críticos de la temporada de invierno reportados a **SENAPRED**, con mapa por región, filtros, ranking de comunas, pronóstico regional (OpenWeatherMap) y avisos/alertas de la **DMC**.

🌐 https://robinson21.github.io/puntos-criticos-chile/

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
| `src/data/` | `DataContext` (carga `meta.json` y la región elegida), `FilterContext` (filtros), `stats.js` (cifras derivadas) |
| `src/components/` | Mapa, filtros, KPIs, gráficos, ranking, pronóstico, alertas |
| `public/data/` | JSON por región, `meta.json`, `alertas.json`, `pronostico_regional.json` |
| `owm-proxy-worker.js` | Worker de Cloudflare que agrega la key de OWM y cachea tiles ([docs](docs/PROXY-OWM.md)) |

## Actualización de datos

| Script | Qué hace |
|---|---|
| `actualizar.py` | Descarga el Excel de SENAPRED y regenera los JSON regionales y `meta.json` (`--push` compila y publica) |
| `actualizar_alertas.py` | Avisos, alertas y alarmas vigentes de la DMC |
| `actualizar_pronostico.py` | Pronóstico 5 días por ciudad de referencia regional (requiere `OWM_API_KEY`) |

## Fuentes y metodología

- Puntos críticos: SENAPRED, *Puntos Críticos Invierno 2026*. Solo se incluyen los registros con coordenadas.
- El **índice** del ranking es la cantidad de puntos de la comuna escalada a 100 respecto de la comuna con más puntos.
- Clima: OpenWeatherMap y RainViewer. Avisos: Dirección Meteorológica de Chile.
