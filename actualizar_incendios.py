#!/usr/bin/env python3
"""
Actualizador de focos de incendio activos (NASA FIRMS, satélites VIIRS).
Descarga los focos de Chile continental y los guarda en public/data/incendios.json:
- `focos`: detecciones de las últimas 72 h (mismo formato que el /api/firms del Worker).
- `eventos`: focos agrupados en incendios (a menos de 1,5 km entre sí), con tamaño, potencia,
  primera/última detección y clase (gran incendio, incendio, foco aislado). Se marcan como
  fuente industrial/persistente los que están junto a industrias, faenas o vertederos (OpenStreetMap)
  o que se repiten en el mismo lugar casi todos los días (últimos 7 días): no son incendios.
Requiere la variable de entorno FIRMS_MAP_KEY (Map Key gratuita de NASA FIRMS).
"""
import csv, io, json, os, sys
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen

# Carpeta del proyecto: la del script, salvo que PC_PROJECT_DIR diga otra cosa.
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
# Chile continental (oeste, sur, este, norte).
FIRMS_AREA = '-76,-56.5,-66,-17.4'
# Satélites VIIRS en tiempo casi real; se pueden cambiar con la variable FIRMS_SOURCES.
FIRMS_SOURCES_DEFAULT = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT'
# FIRMS cuenta días por fecha UTC: pedir 1 día deja el mapa vacío tras la medianoche UTC.
# Se piden 2 y se filtran las últimas HORAS por fecha y hora de detección.
DIAS = 10         # historia para detectar fuentes persistentes (2 consultas de 5 días: el máximo de FIRMS)
HORAS = 72        # ventana de los focos y eventos que se muestran
ENLACE_KM = 1.5   # focos a menos de esta distancia son el mismo incendio
PIXEL_KM2 = 0.14  # un pixel VIIRS mide ~375 m × 375 m
# Clases (por área de pixeles distintos y potencia radiativa total)
GRAN_KM2, GRAN_FRP = 2.0, 500.0      # ≥ ~15 pixeles distintos o ≥ 500 MW en un mismo paso de satélite
INCENDIO_KM2, INCENDIO_FRP = 0.4, 50.0
PERSISTENTE_DIAS = 5                  # mismo lugar (~1 km) con focos en ≥ 5 de los últimos 10 días
OVERPASS = 'https://overpass-api.de/api/interpreter'
UA = {'User-Agent': 'puntos-criticos-chile/1.0 (+https://github.com/robinson21/puntos-criticos-chile)', 'Accept': 'application/json'}
# Contorno de Chile (Natural Earth, dominio público): el recuadro de FIRMS incluye Bolivia y Argentina
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'datos_chile_contorno.json')) as _f:
    CHILE = [(p, min(a for a, b in p), max(a for a, b in p), min(b for a, b in p), max(b for a, b in p))
             for p in json.load(_f)['poligonos']]


def en_chile(lat, lon):
    for pol, la0, la1, lo0, lo1 in CHILE:
        if not (la0 <= lat <= la1 and lo0 <= lon <= lo1):
            continue
        adentro, j = False, len(pol) - 1
        for i in range(len(pol)):
            (yi, xi), (yj, xj) = pol[i], pol[j]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                adentro = not adentro
            j = i
        if adentro:
            return True
    return False

def parse_csv(texto):
    focos = []
    for fila in csv.DictReader(io.StringIO(texto)):
        try:
            lat, lon = float(fila['latitude']), float(fila['longitude'])
        except (KeyError, TypeError, ValueError):
            continue
        hora = (fila.get('acq_time') or '').zfill(4) if fila.get('acq_time') else ''
        try:
            frp = float(fila.get('frp') or 0)
        except ValueError:
            frp = 0
        focos.append({
            'lat': round(lat, 4),
            'lon': round(lon, 4),
            'frp': frp,
            'confianza': fila.get('confidence', ''),
            'fecha': fila.get('acq_date', ''),
            'hora': f'{hora[:2]}:{hora[2:]} UTC' if hora else '',
            'satelite': fila.get('satellite', ''),
        })
    return focos

def descargar(key, fuente, dias=5, fecha=None):
    # La key va en la URL: nunca se imprime la URL, solo el nombre del satélite.
    url = f'{FIRMS_BASE}/{key}/{fuente}/{FIRMS_AREA}/{dias}' + (f'/{fecha}' if fecha else '')
    texto = urlopen(url, timeout=60).read().decode('utf-8')
    if not texto.startswith('latitude'):
        raise RuntimeError(texto.strip()[:80] or 'respuesta vacía')
    return parse_csv(texto)

def recientes(focos, ahora):
    desde = ahora - timedelta(hours=HORAS)
    out = []
    for f in focos:
        try:
            t = datetime.strptime(f"{f['fecha']} {f['hora'][:5]}", '%Y-%m-%d %H:%M').replace(tzinfo=timezone.utc)
        except ValueError:
            out.append(f)  # sin fecha/hora legible: mejor mostrarlo que perderlo
            continue
        if t >= desde:
            out.append(f)
    return out

def tiempo(f):
    try:
        return datetime.strptime(f"{f['fecha']} {f['hora'][:5]}", '%Y-%m-%d %H:%M').replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def distancia_km(a, b):
    import math
    x = math.radians(b['lon'] - a['lon']) * math.cos(math.radians((a['lat'] + b['lat']) / 2))
    y = math.radians(b['lat'] - a['lat'])
    return math.hypot(x, y) * 6371


def agrupar(focos):
    """Une en un mismo evento los focos a menos de ENLACE_KM (union-find sobre una grilla)."""
    padre = list(range(len(focos)))
    def raiz(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i
    celda = ENLACE_KM / 111
    grilla = {}
    for i, f in enumerate(focos):
        grilla.setdefault((int(f['lat'] // celda), int(f['lon'] // celda)), []).append(i)
    for (cy, cx), idxs in grilla.items():
        vecinos = [j for dy in (-1, 0, 1) for dx in (-1, 0, 1) for j in grilla.get((cy + dy, cx + dx), [])]
        for i in idxs:
            for j in vecinos:
                if j > i and distancia_km(focos[i], focos[j]) <= ENLACE_KM:
                    padre[raiz(i)] = raiz(j)
    grupos = {}
    for i in range(len(focos)):
        grupos.setdefault(raiz(i), []).append(focos[i])
    return list(grupos.values())


def celdas_persistentes(focos_7d):
    """Celdas de ~1 km con focos en PERSISTENTE_DIAS o más días distintos."""
    dias = {}
    for f in focos_7d:
        dias.setdefault((round(f['lat'], 2), round(f['lon'], 2)), set()).add(f['fecha'])
    return {k for k, d in dias.items() if len(d) >= PERSISTENTE_DIAS}


def industriales_osm(eventos, radio_m=800):
    """Índices de eventos con industria, faena, cantera, vertedero o central a < radio_m (OpenStreetMap)."""
    if not eventos:
        return set()
    import urllib.parse
    zonas = ''.join(
        f'nwr(around:{radio_m},{e["lat"]},{e["lon"]})["landuse"~"^(industrial|quarry|landfill)$"];'
        f'nwr(around:{radio_m},{e["lat"]},{e["lon"]})["man_made"~"^(works|chimney|flare|kiln|mineshaft)$"];'
        f'nwr(around:{radio_m},{e["lat"]},{e["lon"]})["power"="plant"];'
        f'nwr(around:{radio_m},{e["lat"]},{e["lon"]})["industrial"];'
        for e in eventos)
    consulta = f'[out:json][timeout:60];({zonas});out center;'
    try:
        from urllib.request import Request
        with urlopen(Request(OVERPASS, data=urllib.parse.urlencode({'data': consulta}).encode(), headers=UA), timeout=90) as r:
            elementos = json.load(r).get('elements', [])
    except Exception as ex:
        print(f'   OpenStreetMap no respondió ({ex}); se usa solo la persistencia')
        return set()
    pos = [{'lat': el.get('lat', el.get('center', {}).get('lat')), 'lon': el.get('lon', el.get('center', {}).get('lon'))}
           for el in elementos]
    pos = [p for p in pos if p['lat'] is not None]
    # El centro de un área grande puede quedar algo más lejos que el radio: margen de 1,5×
    return {i for i, e in enumerate(eventos) if any(distancia_km(e, p) * 1000 <= radio_m * 1.5 for p in pos)}


def eventos_de(focos, persistentes, ahora):
    eventos = []
    for g in agrupar(focos):
        frp = sum(f['frp'] for f in g)
        peso = frp or len(g)
        lat = sum(f['lat'] * (f['frp'] or 1) for f in g) / (peso if frp else len(g))
        lon = sum(f['lon'] * (f['frp'] or 1) for f in g) / (peso if frp else len(g))
        pixeles = {(round(f['lat'] / 0.0034), round(f['lon'] / 0.0034)) for f in g}  # ~375 m
        area = len(pixeles) * PIXEL_KM2
        tiempos = sorted(t for t in (tiempo(f) for f in g) if t)
        extension = max((distancia_km({'lat': lat, 'lon': lon}, f) for f in g), default=0) * 2
        en_persistentes = sum(1 for f in g if (round(f['lat'], 2), round(f['lon'], 2)) in persistentes)
        # Potencia del paso de satélite más intenso (sumar 3 días y 3 satélites inflaría el valor)
        pases = {}
        for f in g:
            k = (f['satelite'], f['fecha'], f['hora'])
            pases[k] = pases.get(k, 0) + f['frp']
        frp_pase = max(pases.values(), default=0)
        clase = ('gran' if area >= GRAN_KM2 or frp_pase >= GRAN_FRP
                 else 'incendio' if area >= INCENDIO_KM2 or frp_pase >= INCENDIO_FRP else 'foco')
        eventos.append({
            'lat': round(lat, 4), 'lon': round(lon, 4),
            'clase': clase,
            'detecciones': len(g),
            'area_km2': round(area, 2),
            'extension_km': round(extension, 1),
            'frp_total': round(frp, 1),
            'frp_pase': round(frp_pase, 1),
            'frp_max': round(max(f['frp'] for f in g), 1),
            'primera': tiempos[0].isoformat() if tiempos else None,
            'ultima': tiempos[-1].isoformat() if tiempos else None,
            'activo': bool(tiempos) and (ahora - tiempos[-1]) <= timedelta(hours=24),
            # Persistente: casi todas sus detecciones caen en lugares que arden casi todos los días
            'persistente': en_persistentes >= 0.7 * len(g) and len(pixeles) < 15,
        })
    orden = {'gran': 0, 'incendio': 1, 'foco': 2}
    eventos.sort(key=lambda e: (orden[e['clase']], -e['area_km2'], -e['frp_pase']))
    # OpenStreetMap solo para los que no son focos aislados (y como máximo 80)
    revisar = [e for e in eventos if e['clase'] != 'foco'][:80]
    for i in industriales_osm(revisar):
        revisar[i]['industrial'] = True
    for e in eventos:
        e['tipo'] = 'industrial' if e.get('industrial') or e['persistente'] else 'vegetacion'
        e.pop('industrial', None)
    return eventos


def actualizar():
    key = (os.environ.get('FIRMS_MAP_KEY') or '').strip()
    if not key:
        print('❌ Falta la variable FIRMS_MAP_KEY (Map Key gratuita de NASA FIRMS)')
        return None

    fuentes = [f.strip() for f in os.environ.get('FIRMS_SOURCES', FIRMS_SOURCES_DEFAULT).split(',') if f.strip()]
    focos, ok, fallidas = [], [], []
    # Cada satélite por separado: si uno falla (o no existe), los otros igual sirven.
    ahora = datetime.now(timezone.utc)
    focos_7d = []
    for fuente in fuentes:
        try:
            todos = descargar(key, fuente)  # últimos 5 días (incluye hoy)
            focos_7d += todos
            try:  # 5 días anteriores, solo para la persistencia
                focos_7d += descargar(key, fuente, 5, (ahora - timedelta(days=9)).strftime('%Y-%m-%d'))
            except Exception as e:
                print(f'   {fuente}: sin historia anterior ({str(e).replace(key, "***")[:60]})')
            nuevos = [f for f in recientes(todos, ahora) if en_chile(f['lat'], f['lon'])]
            focos += nuevos
            ok.append(fuente)
            print(f'   {fuente}: {len(nuevos)} focos en {HORAS} h')
        except Exception as e:
            msg = str(e).replace(key, '***')
            fallidas.append(f'{fuente}: {msg}')
            print(f'   {fuente}: falló ({msg})')

    if not ok:
        print('❌ FIRMS no respondió con ningún satélite')
        return None

    eventos = eventos_de(focos, celdas_persistentes(focos_7d), ahora)
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    path = os.path.join(PUBLIC_DIR, 'incendios.json')
    with open(path, 'w') as f:
        json.dump({
            'actualizado': ahora.isoformat(timespec='seconds'),
            'horas': HORAS,
            'fuentes': ok,
            'fallidas': fallidas,
            'focos': focos,
            'eventos': eventos,
            'criterio': {'enlace_km': ENLACE_KM, 'gran': f'≥ {GRAN_KM2} km² o ≥ {GRAN_FRP:.0f} MW en un paso',
                         'incendio': f'≥ {INCENDIO_KM2} km² o ≥ {INCENDIO_FRP:.0f} MW en un paso',
                         'persistente': f'mismo lugar con focos en ≥ {PERSISTENTE_DIAS} de {DIAS} días'},
        }, f, ensure_ascii=False)
    from collections import Counter
    print('   Eventos:', dict(Counter((e['clase'], e['tipo'], 'activo' if e['activo'] else 'inactivo') for e in eventos)))

    print(f'✅ {len(focos)} focos activos (últimas {HORAS} h) desde {len(ok)} satélite(s)')
    print(f'   Guardado en {path}')
    return len(focos)

if __name__ == '__main__':
    # Sale con error si no se pudo actualizar, para que el workflow use lo último publicado.
    sys.exit(0 if actualizar() is not None else 1)
