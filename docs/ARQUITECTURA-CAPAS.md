# Arquitectura de capas ambientales del mapa

## Flujo general de datos por capa

```
[Visitante abre puntos-criticos-chile.github.io]
        ↓
[GitHub Pages sirve el bundle React (estático)]
        ↓
[El navegador decide qué capas pedir según los toggles activos]
        ↓
┌──────────────────────── Capas que requieren clave ────────────────────────┐
│                                                                           │
│  💨 Viento / ☁️ Nubes / 🌡️ Temperatura (OpenWeatherMap)                   │
│  ─────────────────────────────────────────────────────────────────        │
│  Navegador → https://owm-proxy.{...}.workers.dev/api/tiles/owm/{layer}/z/x/y
│         ↓ (Worker de Cloudflare)                                          │
│  ¿Cacheado? ─caché 30 min→ devuelve PNG (0 llamadas upstream)             │
│  No cacheado → Cloudflare añade OWM_API_KEY → tile.openweathermap.org     │
│         ↓                                                                 │
│  OWM devuelve PNG → Cloudflare lo cachea 30 min → lo sirve al navegador   │
│                                                                           │
├──────────────────────── Capas sin clave ────────────────────────────       │
│  🌧️ Lluvia animada → RainViewer (público, gratis, sin key)                │
│  🔥 Incendios activos → NASA FIRMS                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

## Detalle por capa

| Capa | Fuente | ¿Key? | ¿Cómo la obtiene? | Estado |
|---|---|---|---|---|
| 💨 **Viento** | OpenWeatherMap (OWM) | Sí | Vía proxy Cloudflare (Worker añade key) | ✅ Activa |
| ☁️ **Nubes** | OpenWeatherMap (OWM) | Sí | Vía proxy Cloudflare (Worker añade key) | ✅ Activa |
| 🌡️ **Temperatura** | OpenWeatherMap (OWM) | Sí | Vía proxy Cloudflare (Worker añade key) | ✅ Activa |
| 🌧️ **Lluvia animada** | RainViewer | No | Endpoint público, animación de radar | ✅ Activa |
| 🔥 **Incendios** | NASA FIRMS | Sí (Map Key gratuita) | Requiere Map Key de FIRMS | ⛔ Bloqueada (🔑) |

> 🔥 **Incendios activos**: la API pública WMS de NASA FIRMS cambió de política y ahora requiere una
> "Map Key" gratuita. Hasta que se registre (`firms.modaps.eosdis.nasa.gov`) y se añada al sistema,
> esta capa queda deshabilitada en el panel (se muestra con candado 🔑).

## Código que orquesta las capas

- `src/components/MapView.jsx` → componente `<EnvironmentalLayers>` que dibuja las capas OWM sobre Leaflet.
- `src/components/LayersControl.jsx` → panel de toggles + lógica de bloqueo por capa.

### Detalle clave en MapView.jsx

```js
const OWM_KEY = (import.meta.env.VITE_OWM_KEY || '').trim();     // solo dev
const TILE_PROXY = (import.meta.env.VITE_TILE_PROXY || 'http://localhost:8081').trim();
const hasTileProxy = TILE_PROXY.length > 0;
const hasOwmSource = hasTileProxy || hasOwmKey; // proxy o key (dev)

// Cada overlay OWM usa:
//   hasTileProxy ? `${TILE_PROXY}/api/tiles/owm/${layer}/{z}/{x}/{y}.png`
//                : `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${owmKey}`
```

En producción se define `VITE_TILE_PROXY`, por lo que **siempre** se usa el proxy
y **nunca** se expone `OWM_KEY` en el bundle.

## Fallback ante caída del proxy
El código está pensado para, si el proxy no responde, caer a OWM directo **solo si existe**
`VITE_OWM_KEY` en el entorno de build. En producción (sin esa key) no hay fallback a key directa:
el proxy es la fuente única. Si el Worker cayera un tiempo, las 3 capas simples dejarían de mostrarse
temporalmente (el mapa, puntos y demás siguen funcionando). Restaurar es redesplegar el Worker
(ver `PROXY-OWM.md` → "Cómo redesplegar").
