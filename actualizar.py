#!/usr/bin/env python3
"""
Actualizador de datos Puntos Críticos SENAPRED.
Fuente principal: el servicio ArcGIS público de SENAPRED que alimenta su tablero oficial
(compilado_INV_2026). Respaldo: el Excel (links oficiales antiguos y copia de un tercero).
Genera los JSON regionales, meta.json y senapred_estado.json.

Uso:
  python3 actualizar.py          # Solo descarga y procesa
  python3 actualizar.py --push   # Descarga, procesa y hace deploy
"""

import json, os, gzip, sys, subprocess
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from collections import defaultdict
from urllib.request import urlopen
from urllib.error import URLError

# Carpeta del proyecto: la del script, salvo que PC_PROJECT_DIR diga otra cosa.
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
SRC_DATA = os.path.join(PROJECT_DIR, 'src', 'data')

# Servicio oficial (lo usa el tablero "Ver puntos críticos" de https://www.senapred.cl/programa-invierno/)
ARCGIS_URL = 'https://services5.arcgis.com/i7S5PSnIJAUcWvSE/arcgis/rest/services/compilado_INV_2026/FeatureServer/0'
ARCGIS_CAMPOS = ['FID', 'Región', 'Provincia', 'Comuna', 'Sector', 'Causa_del_', 'Acciones_P', 'La_soluci',
                 'Si_la_resp', 'Nivel_de_R', 'Tipo_de_So', 'Punto_Crí', 'Longitud', 'Latitud']

# URLs oficiales donde SENAPRED publicaba el Excel (respaldo)
# Verificar cada año cuál es la URL vigente
URLS = [
    'https://web.senapred.cl/wp-content/uploads/2026/04/Puntos_Criticos_INV_2026.xlsx',
    'https://senapred.cl/wp-content/uploads/2026/04/Puntos_Criticos_INV_2026.xlsx',
]

# Fallback: el repositorio original
FALLBACK_URL = 'https://raw.githubusercontent.com/psarricolea/puntos-criticos-chile/main/Puntos_Criticos_INV_2026.xlsx'

REGION_SLUGS = {
    'METROPOLITANA DE SANTIAGO': 'metropolitana_de_santiago',
    'VALPARAÍSO': 'valparaiso',
    'BIOBÍO': 'biobio',
    'COQUIMBO': 'coquimbo',
    'LA ARAUCANÍA': 'la_araucania',
    'LIBERTADOR GENERAL BERNARDO OHIGGINS': 'libertador_general_bernardo_ohiggins',
    'MAULE': 'maule',
    'LOS LAGOS': 'los_lagos',
    'ÑUBLE': 'nuble',
    'ATACAMA': 'atacama',
    'LOS RÍOS': 'los_rios',
    'ANTOFAGASTA': 'antofagasta',
    'AYSÉN DEL GENERAL CARLOS IBANEZ DEL CAMPO': 'aysen_del_general_carlos_ibanez_del_campo',
    'MAGALLANES Y DE LA ANTÁRTICA CHILENA': 'magallanes_y_de_la_antartica_chilena',
}


def descargar_excel():
    """Descarga el Excel de SENAPRED. Prueba URLs oficiales, luego fallback."""
    for url in URLS + [FALLBACK_URL]:
        try:
            print(f'  Intentando: {url}')
            resp = urlopen(url, timeout=30)
            data = resp.read()
            if len(data) > 10000:
                # Validar que sea Excel real (empieza con ZIP magic bytes "PK")
                if data[:2] == b'PK':
                    print(f'  ✅ Descargado: {len(data)/1024:.0f} KB')
                    return data, url, resp.headers.get('Last-Modified')
                else:
                    print(f'  ❌ Respuesta no es Excel (HTML? {data[:20]})')
                    continue  # Probar siguiente URL
        except Exception as e:
            print(f'  ❌ {e}')
    raise Exception('No se pudo descargar el Excel desde ninguna URL')


def _txt(v):
    return str(v or '').strip()


def registro(region, provincia, comuna, sector, causa, accion, solucion, institucion, nivel, tipo, afectado, lon, lat):
    """Normaliza un punto crítico (venga del servicio ArcGIS o del Excel) al formato compacto de la app.
    Claves: c comuna, cs causa, lv nivel, tp tipo de solución, lat/lon y, si hay dato,
    pv provincia, s sector, ac acción principal, rs responsable de la solución, af afectado este invierno."""
    if lon in (None, '') or lat in (None, ''):
        return None
    nivel = _txt(nivel)
    if nivel.lower().startswith('solucionado'):
        nivel = 'Solucionado'
    solucion, institucion = _txt(solucion), _txt(institucion)
    r = {
        'r': _txt(region).upper(),
        'c': _txt(comuna).upper(),
        'cs': _txt(causa),
        'lv': nivel,
        'tp': _txt(tipo),
        'lat': round(float(lat), 4),
        'lon': round(float(lon), 4),
        'pv': _txt(provincia).upper(),
        's': _txt(sector)[:80],
        'ac': '' if _txt(accion).lower() in ('', 'no aplica') else _txt(accion),
        'rs': (institucion if institucion and institucion.lower() != 'otro' else 'Sectorial') if solucion == 'Sectorial'
              else 'Municipalidad' if solucion == 'Comunal' else '',
        'af': 1 if _txt(afectado).upper() == 'SI' else 0,
    }
    return r


def descargar_arcgis():
    """Lee todos los puntos del servicio oficial, de a 2.000 (límite del servicio)."""
    import urllib.parse
    def consulta(**p):
        p.setdefault('f', 'json')
        with urlopen(f'{ARCGIS_URL}/query?{urllib.parse.urlencode(p)}', timeout=60) as r:
            d = json.load(r)
        if 'error' in d:
            raise Exception(f"ArcGIS: {d['error']}")
        return d
    total = consulta(where='1=1', returnCountOnly='true')['count']
    filas, offset = [], 0
    while offset < total:
        d = consulta(where='1=1', outFields=','.join(ARCGIS_CAMPOS), returnGeometry='false',
                     orderByFields='FID', resultOffset=offset, resultRecordCount=2000)
        lote = [f['attributes'] for f in d.get('features', [])]
        if not lote:
            break
        filas += lote
        offset += len(lote)
    if len(filas) != total or total < 10000:
        raise Exception(f'ArcGIS devolvió {len(filas)} de {total} puntos')
    with urlopen(f'{ARCGIS_URL}?f=json', timeout=60) as r:
        edicion = json.load(r).get('editingInfo', {}).get('dataLastEditDate')
    modificado = datetime.fromtimestamp(edicion / 1000, timezone.utc).isoformat() if edicion else None
    a = lambda f, k: f.get(k)
    registros = [registro(a(f, 'Región'), a(f, 'Provincia'), a(f, 'Comuna'), a(f, 'Sector'), a(f, 'Causa_del_'),
                          a(f, 'Acciones_P'), a(f, 'La_soluci'), a(f, 'Si_la_resp'), a(f, 'Nivel_de_R'),
                          a(f, 'Tipo_de_So'), a(f, 'Punto_Crí'), a(f, 'Longitud'), a(f, 'Latitud')) for f in filas]
    print(f'  ✅ Servicio oficial ArcGIS: {len(filas)} puntos')
    return [r for r in registros if r], modificado


def leer_excel(excel_data):
    """Excel de SENAPRED → registros normalizados."""
    import openpyxl
    from io import BytesIO

    wb = openpyxl.load_workbook(BytesIO(excel_data), read_only=True, data_only=True)
    sheet = wb.active if wb.active else wb[wb.sheetnames[0]]
    registros = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        row = list(row) + [None] * 15
        r = registro(row[0], row[1], row[2], row[3], row[4], row[5], row[7], row[8], row[10], row[11], row[12], row[13], row[14])
        if r:
            registros.append(r)
    return registros


def procesar_registros(records):
    """Genera los JSON regionales y meta.json."""
    print(f'  Registros con coordenadas: {len(records)}')

    # Agrupar por región
    by_region = defaultdict(list)
    for r in records:
        by_region[r['r']].append(r)

    # Crear directorios
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # Escribir archivos regionales
    region_map = {}
    for region, items in sorted(by_region.items(), key=lambda x: len(x[1]), reverse=True):
        slug = REGION_SLUGS.get(region, region.lower().replace(' ','_'))
        # Sin la región (va en el nombre del archivo) y sin campos vacíos, para que pesen menos
        clean = [{k: v for k, v in i.items() if k != 'r' and (v or k in ('c', 'cs', 'lv', 'tp', 'lat', 'lon'))} for i in items]
        path = os.path.join(PUBLIC_DIR, f'{slug}.json')
        with open(path, 'w') as f:
            json.dump(clean, f, ensure_ascii=False)
        region_map[region] = slug
        print(f'  {slug}: {len(clean)} pts')

    # Metadata global
    comuna_stats = defaultdict(lambda: {'n': 0})
    for r in records:
        comuna_stats[r['c']]['n'] += 1
        if 'region' not in comuna_stats[r['c']]:
            comuna_stats[r['c']]['region'] = r['r']

    # Índice 0-100 relativo a la comuna con más puntos.
    max_n = max(v['n'] for v in comuna_stats.values())
    ranking = sorted(
        [{'c': c, 'n': v['n'], 'r': v['region'], 'idx': round(v['n'] * 100 / max_n)}
         for c, v in comuna_stats.items()],
        key=lambda x: x['idx'], reverse=True
    )

    niveles = defaultdict(int)
    causas = defaultdict(int)
    tipos = defaultdict(int)
    for r in records:
        niveles[r['lv']] += 1
        causas[r['cs']] += 1
        tipos[r['tp']] += 1

    metadata = {
        'total': len(records),
        'regiones': region_map,
        'por_region': {region: len(items) for region, items in by_region.items()},
        'ranking': ranking[:100],
        'niveles': dict(niveles),
        'causas': dict(causas),
        'tipos': dict(tipos),
        'comunas': len(comuna_stats),
        'afectados': sum(1 for r in records if r.get('af')),
        'solucionados': sum(1 for r in records if r['lv'] == 'Solucionado'),
    }

    with open(os.path.join(PUBLIC_DIR, 'meta.json'), 'w') as f:
        json.dump(metadata, f, ensure_ascii=False)

    return metadata


def fecha_excel(excel_data, last_modified):
    """Fecha de última modificación del Excel: la propiedad interna del archivo o, si no, la cabecera HTTP."""
    try:
        import openpyxl
        from io import BytesIO
        mod = openpyxl.load_workbook(BytesIO(excel_data), read_only=True).properties.modified
        if mod:
            return mod.replace(tzinfo=mod.tzinfo or timezone.utc).isoformat()
    except Exception:
        pass
    try:
        return parsedate_to_datetime(last_modified).isoformat() if last_modified else None
    except Exception:
        return None


def guardar_estado(ok, url=None, excel_modificado=None, error=None):
    """senapred_estado.json: cuándo se revisó el Excel y de dónde vino. Cambia en cada revisión,
    por eso no se guarda en master (el workflow lo excluye) y solo viaja en la rama datos."""
    estado = {
        'revisado': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'ok': ok,
        'fuente': None if not url else ('respaldo' if url == FALLBACK_URL else 'oficial'),
        'formato': None if not url else ('servicio' if url == ARCGIS_URL else 'excel'),
        'url': url,
        'excel_modificado': excel_modificado,
        'error': error,
    }
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(os.path.join(PUBLIC_DIR, 'senapred_estado.json'), 'w') as f:
        json.dump(estado, f, ensure_ascii=False, indent=1)


def hacer_deploy():
    """Hace build y push a gh-pages."""
    os.chdir(PROJECT_DIR)
    result = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f'Build failed: {result.stderr}')
        return False
    result = subprocess.run(['npx', 'gh-pages', '-d', 'dist'], capture_output=True, text=True, timeout=120)
    if result.returncode == 0:
        print('✅ Deploy exitoso')
        return True
    else:
        print(f'Deploy falló: {result.stderr}')
        return False


if __name__ == '__main__':
    do_push = '--push' in sys.argv

    print('=== Actualizador Puntos Críticos SENAPRED ===')
    print('\n1️⃣  Descargando datos SENAPRED...')
    try:
        registros, modificado = descargar_arcgis()
        url = ARCGIS_URL
    except Exception as e_arcgis:
        print(f'  ❌ Servicio oficial: {e_arcgis}. Se prueba el Excel.')
        try:
            excel, url, last_modified = descargar_excel()
        except Exception as e:
            guardar_estado(ok=False, error=f'ArcGIS: {e_arcgis} · Excel: {e}')
            raise
        registros, modificado = leer_excel(excel), fecha_excel(excel, last_modified)

    print('\n2️⃣  Procesando datos...')
    meta = procesar_registros(registros)
    guardar_estado(ok=True, url=url, excel_modificado=modificado)
    print(f'   ✅ {meta["total"]} registros · {meta["comunas"]} comunas · {len(meta["regiones"])} regiones')

    if do_push:
        print('\n3️⃣  Build y deploy...')
        hacer_deploy()
    else:
        print('\n3️⃣  Skipeando deploy (usa --push para hacerlo)')
        print('   Datos actualizados en public/data/')

    print('\n✅ Listo')
