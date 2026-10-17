#!/usr/bin/env python3
"""
Actualizador de alertas meteorológicas DMC.
Descarga datos_AAA.js de meteochile y lo convierte a JSON para la app.
"""
import json, os, re, subprocess, sys
from datetime import datetime
from urllib.request import urlopen

# Carpeta del proyecto: la del script, salvo que PC_PROJECT_DIR diga otra cosa.
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
DMC_URL = 'https://archivos.meteochile.gob.cl/portaldmc/AAA/datos_AAA.js?ts='

REGION_MAP = {
    '01a': 'Arica y Parinacota', '01b': 'Tarapacá', '02': 'Antofagasta',
    '03': 'Atacama', '04': 'Coquimbo', '05': 'Valparaíso',
    '05m': 'Metropolitana', '06': "O'Higgins", '07': 'Maule',
    '08a': 'Ñuble', '08b': 'Biobío', '09': 'La Araucanía',
    '10a': 'Los Ríos', '10b': 'Los Lagos', '11': 'Aysén', '12': 'Magallanes',
    'jf': 'Archipiélago Juan Fernández',
}

COLOR_MAP = {'Aviso': '#fbbf24', 'Alerta': '#f97316', 'Alarma': '#ef4444'}
ICON_MAP = {
    'Precipitaciones': '🌧️', 'Viento': '💨', 'Nevadas': '❄️',
    'Tormentas Eléctricas': '⚡', 'Heladas': '🥶', 'Rolaje': '🌊',
}

def leer_poligono(texto):
    """La DMC a veces entrega el área exacta como "lat,lon|lat,lon|…" en vez de códigos de zona."""
    if '|' not in texto and texto.count(',') != 1:
        return None
    puntos = []
    for par in texto.split('|'):
        try:
            lat, lon = (float(x) for x in par.split(','))
        except ValueError:
            return None
        if -60 < lat < -15 and -115 < lon < -60:
            puntos.append([round(lat, 4), round(lon, 4)])
    return puntos if len(puntos) >= 3 else None


def dentro(lat, lon, poligono):
    """Punto en polígono (ray casting)."""
    adentro = False
    j = len(poligono) - 1
    for i in range(len(poligono)):
        yi, xi = poligono[i]
        yj, xj = poligono[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            adentro = not adentro
        j = i
    return adentro


# Región SENAPRED (nombre en los JSON) → nombre corto de la DMC
SENAPRED_A_DMC = {
    'ANTOFAGASTA': 'Antofagasta', 'ATACAMA': 'Atacama', 'COQUIMBO': 'Coquimbo', 'VALPARAÍSO': 'Valparaíso',
    'METROPOLITANA DE SANTIAGO': 'Metropolitana', 'LIBERTADOR GENERAL BERNARDO OHIGGINS': "O'Higgins",
    'MAULE': 'Maule', 'ÑUBLE': 'Ñuble', 'BIOBÍO': 'Biobío', 'LA ARAUCANÍA': 'La Araucanía',
    'LOS RÍOS': 'Los Ríos', 'LOS LAGOS': 'Los Lagos', 'AYSÉN DEL GENERAL CARLOS IBANEZ DEL CAMPO': 'Aysén',
    'MAGALLANES Y DE LA ANTÁRTICA CHILENA': 'Magallanes',
}


def puntos_en_area(poligono):
    """Puntos críticos SENAPRED dentro del polígono, agrupados por región y causa ({n, alto, af})."""
    try:
        with open(os.path.join(PUBLIC_DIR, 'meta.json'), encoding='utf-8') as f:
            regiones = json.load(f).get('regiones', {})
    except Exception:
        return {}
    lats = [p[0] for p in poligono]; lons = [p[1] for p in poligono]
    caja = (min(lats), max(lats), min(lons), max(lons))
    out = {}
    for region, slug in regiones.items():
        try:
            with open(os.path.join(PUBLIC_DIR, f'{slug}.json'), encoding='utf-8') as f:
                puntos = json.load(f)
        except Exception:
            continue
        for p in puntos:
            if p.get('lv') == 'Solucionado' or not (caja[0] <= p['lat'] <= caja[1] and caja[2] <= p['lon'] <= caja[3]):
                continue
            if not dentro(p['lat'], p['lon'], poligono):
                continue
            v = out.setdefault(region, {}).setdefault(p.get('cs', ''), {'n': 0, 'alto': 0, 'af': 0})
            v['n'] += 1
            v['alto'] += p.get('lv') in ('Alto', 'Muy Alto')
            v['af'] += p.get('af', 0)
    return out


def actualizar():
    ts = datetime.now().strftime('%Y%m%d%H%M%S')
    url = DMC_URL + ts
    print(f'Descargando: {url}')
    resp = urlopen(url, timeout=30)
    js = resp.read().decode('utf-8-sig')

    # Extraer el array AAA como JSON
    # El JS está formateado como push() por objeto, es más fácil parsearlo manualmente
    # Buscamos todos los objetos JSON dentro de AAA.push({
    alerts = []
    # Encontrar cada bloque AAA.push({...})
    pattern = r'AAA\.push\(\{([\s\S]*?)\}\);\s*\r?\n'
    matches = re.finditer(pattern, js)

    for m in matches:
        # Arreglar HTML entities
        obj_str = m.group(1).strip()
        # Quitar comillas extra y escapar
        # Reemplazar &eacute; etc manualmente antes de parsear
        obj_str = obj_str.replace('&eacute;', 'é').replace('&iacute;', 'í')
        obj_str = obj_str.replace('&oacute;', 'ó').replace('&aacute;', 'á')
        obj_str = obj_str.replace('&uacute;', 'ú').replace('&ntilde;', 'ñ')
        obj_str = obj_str.replace('&iexcl;', '¡').replace('&quot;', '"')
        obj_str = obj_str.replace('&amp;', '&').replace('&nbsp;', ' ')
        obj_str = obj_str.replace('&#039;', "'").replace('&#39;', "'")

        # Extraer campos con regex (más seguro que eval)
        def get_val(field, s=obj_str):
            m2 = re.search(rf'{field}\s*:\s*"([^"]*)"', s)
            return m2.group(1) if m2 else ''

        def get_val_noquote(field, s=obj_str):
            m2 = re.search(rf'{field}\s*:\s*(\d+)', s)
            return int(m2.group(1)) if m2 else 0

        alert = {
            'id': get_val_noquote('id'),
            'tipo': get_val('tipo'),
            'codigo': get_val('codigoMeteo'),
            'emision': get_val('emision'),
            'fenomeno': get_val('fenomeno'),
            'condicion': get_val('condicionSinoptica'),
            'desde': get_val('desde'),
            'hasta': get_val('hasta'),
            'observacion': get_val('observacion'),
            'zonas': get_val('textoZonaAfecta').replace('<br>', ' | '),
            'titulo': get_val('titulo'),
            'icono': ICON_MAP.get(get_val('fenomeno'), '⚠️'),
            'color': COLOR_MAP.get(get_val('tipo'), '#6b7280'),
        }

        # Extraer regiones afectadas del dataZonaAfecta
        zonas_raw = get_val('dataZonaAfecta')
        regiones_afectadas = set()
        for code in zonas_raw.split(','):
            code = code.strip().split('_')[0]
            if code in REGION_MAP:
                regiones_afectadas.add(REGION_MAP[code])
        # Área exacta (polígono): se guarda y se cuentan los puntos críticos que quedan dentro
        poligono = leer_poligono(zonas_raw)
        if poligono:
            alert['poligono'] = poligono
            alert['puntos_area'] = puntos_en_area(poligono)
            regiones_afectadas |= {SENAPRED_A_DMC[r] for r in alert['puntos_area'] if r in SENAPRED_A_DMC}
        # Sin códigos ni puntos dentro: se busca el nombre de la región en el texto de las zonas
        if not regiones_afectadas:
            texto = f"{alert['zonas']} {alert['titulo']}".lower()
            regiones_afectadas = {n for n in REGION_MAP.values() if n.lower() in texto}
        alert['regiones'] = sorted(regiones_afectadas) if regiones_afectadas else []

        alerts.append(alert)

    # Contar
    avisos = sum(1 for a in alerts if a['tipo'] == 'Aviso')
    alertas = sum(1 for a in alerts if a['tipo'] == 'Alerta')
    alarmas = sum(1 for a in alerts if a['tipo'] == 'Alarma')

    # Guardar
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    path = os.path.join(PUBLIC_DIR, 'alertas.json')
    with open(path, 'w') as f:
        json.dump({
            'actualizado': datetime.now().isoformat(),
            'totales': {'avisos': avisos, 'alertas': alertas, 'alarmas': alarmas, 'total': len(alerts)},
            'alertas': alerts,
        }, f, ensure_ascii=False, indent=2)

    print(f'✅ {len(alerts)} alertas: {avisos} avisos, {alertas} alertas, {alarmas} alarmas')
    print(f'   Guardado en {path}')
    return len(alerts)

def deploy():
    os.chdir(PROJECT_DIR)
    r = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print(f'Build falló: {r.stderr[:200]}')
        return False
    r = subprocess.run(['npx', 'gh-pages', '-d', 'dist'], capture_output=True, text=True, timeout=120)
    if r.returncode == 0:
        print('✅ Deploy exitoso')
        return True
    print(f'Deploy falló: {r.stderr[:200]}')
    return False

if __name__ == '__main__':
    n = actualizar()
    if '--push' in sys.argv and n > 0:
        deploy()
