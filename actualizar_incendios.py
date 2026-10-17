#!/usr/bin/env python3
"""
Actualizador de focos de incendio activos (NASA FIRMS, satélites VIIRS).
Descarga los focos de Chile continental y los guarda en public/data/incendios.json,
con el mismo formato que el /api/firms del Worker.
Requiere la variable de entorno FIRMS_MAP_KEY (Map Key gratuita de NASA FIRMS).
"""
import csv, io, json, os, sys
from datetime import datetime, timezone
from urllib.request import urlopen

# Carpeta del proyecto: la del script, salvo que PC_PROJECT_DIR diga otra cosa.
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
# Chile continental (oeste, sur, este, norte).
FIRMS_AREA = '-76,-56.5,-66,-17.4'
# Satélites VIIRS en tiempo casi real; se pueden cambiar con la variable FIRMS_SOURCES.
FIRMS_SOURCES_DEFAULT = 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT'
DIAS = 1

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

def descargar(key, fuente):
    # La key va en la URL: nunca se imprime la URL, solo el nombre del satélite.
    url = f'{FIRMS_BASE}/{key}/{fuente}/{FIRMS_AREA}/{DIAS}'
    texto = urlopen(url, timeout=60).read().decode('utf-8')
    if not texto.startswith('latitude'):
        raise RuntimeError(texto.strip()[:80] or 'respuesta vacía')
    return parse_csv(texto)

def actualizar():
    key = (os.environ.get('FIRMS_MAP_KEY') or '').strip()
    if not key:
        print('❌ Falta la variable FIRMS_MAP_KEY (Map Key gratuita de NASA FIRMS)')
        return None

    fuentes = [f.strip() for f in os.environ.get('FIRMS_SOURCES', FIRMS_SOURCES_DEFAULT).split(',') if f.strip()]
    focos, ok, fallidas = [], [], []
    # Cada satélite por separado: si uno falla (o no existe), los otros igual sirven.
    for fuente in fuentes:
        try:
            nuevos = descargar(key, fuente)
            focos += nuevos
            ok.append(fuente)
            print(f'   {fuente}: {len(nuevos)} focos')
        except Exception as e:
            msg = str(e).replace(key, '***')
            fallidas.append(f'{fuente}: {msg}')
            print(f'   {fuente}: falló ({msg})')

    if not ok:
        print('❌ FIRMS no respondió con ningún satélite')
        return None

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    path = os.path.join(PUBLIC_DIR, 'incendios.json')
    with open(path, 'w') as f:
        json.dump({
            'actualizado': datetime.now(timezone.utc).isoformat(timespec='seconds'),
            'dias': DIAS,
            'fuentes': ok,
            'fallidas': fallidas,
            'focos': focos,
        }, f, ensure_ascii=False)

    print(f'✅ {len(focos)} focos activos ({DIAS} día) desde {len(ok)} satélite(s)')
    print(f'   Guardado en {path}')
    return len(focos)

if __name__ == '__main__':
    # Sale con error si no se pudo actualizar, para que el workflow use lo último publicado.
    sys.exit(0 if actualizar() is not None else 1)
