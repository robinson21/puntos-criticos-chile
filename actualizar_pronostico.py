#!/usr/bin/env python3
"""
Actualiza pronóstico regional para Puntos Críticos Chile.
Fuente operacional: OpenWeatherMap 5 días / 3 horas.
Se genera server-side para no exponer la API key en el frontend.
"""
import json
import os
import subprocess
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from urllib.parse import urlencode
from urllib.request import urlopen

# Carpeta del proyecto: la del script, salvo que PC_PROJECT_DIR diga otra cosa.
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(PROJECT_DIR, 'public', 'data')
FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'
CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather'
UV_URL = 'https://api.open-meteo.com/v1/forecast'
API_KEY = os.getenv('OPENWEATHER_API_KEY')  # requerida; se inyecta via variable de entorno, nunca hardcodeada
if not API_KEY:
    raise SystemExit('ERROR: variable de entorno OPENWEATHER_API_KEY no configurada. '
                     'Configúrala en el entorno donde corre este script (ej. el cron).')

REGIONES = {
    'METROPOLITANA DE SANTIAGO': {'lat': -33.45, 'lon': -70.65, 'ciudad': 'Santiago'},
    'VALPARAÍSO': {'lat': -33.05, 'lon': -71.55, 'ciudad': 'Valparaíso'},
    'BIOBÍO': {'lat': -36.83, 'lon': -73.05, 'ciudad': 'Concepción'},
    'COQUIMBO': {'lat': -29.95, 'lon': -71.34, 'ciudad': 'La Serena'},
    'LA ARAUCANÍA': {'lat': -38.75, 'lon': -72.65, 'ciudad': 'Temuco'},
    'LIBERTADOR GENERAL BERNARDO OHIGGINS': {'lat': -34.17, 'lon': -70.74, 'ciudad': 'Rancagua'},
    'MAULE': {'lat': -35.43, 'lon': -71.66, 'ciudad': 'Talca'},
    'LOS LAGOS': {'lat': -41.47, 'lon': -72.94, 'ciudad': 'Puerto Montt'},
    'ÑUBLE': {'lat': -36.60, 'lon': -72.10, 'ciudad': 'Chillán'},
    'ATACAMA': {'lat': -27.37, 'lon': -70.33, 'ciudad': 'Copiapó'},
    'LOS RÍOS': {'lat': -39.81, 'lon': -73.25, 'ciudad': 'Valdivia'},
    'ANTOFAGASTA': {'lat': -23.65, 'lon': -70.40, 'ciudad': 'Antofagasta'},
    'AYSÉN DEL GENERAL CARLOS IBANEZ DEL CAMPO': {'lat': -45.57, 'lon': -72.07, 'ciudad': 'Coyhaique'},
    'MAGALLANES Y DE LA ANTÁRTICA CHILENA': {'lat': -53.16, 'lon': -70.91, 'ciudad': 'Punta Arenas'},
}

WEATHER_ES = {
    200: ('🌩️', 'Tormenta'), 201: ('🌩️', 'Tormenta'), 202: ('🌩️', 'Tormenta fuerte'),
    300: ('🌦️', 'Llovizna'), 301: ('🌦️', 'Llovizna'), 302: ('🌦️', 'Llovizna fuerte'),
    500: ('🌧️', 'Lluvia ligera'), 501: ('🌧️', 'Lluvia moderada'), 502: ('🌧️', 'Lluvia fuerte'), 503: ('🌧️', 'Lluvia muy fuerte'), 504: ('🌧️', 'Lluvia extrema'),
    511: ('🌧️', 'Lluvia helada'), 520: ('🌧️', 'Chubascos'), 521: ('🌧️', 'Chubascos'), 522: ('🌧️', 'Chubascos fuertes'),
    600: ('❄️', 'Nieve ligera'), 601: ('❄️', 'Nieve'), 602: ('❄️', 'Nieve fuerte'),
    701: ('🌫️', 'Bruma'), 721: ('🌫️', 'Neblina'), 741: ('🌫️', 'Niebla'),
    800: ('☀️', 'Despejado'), 801: ('🌤️', 'Pocas nubes'), 802: ('⛅', 'Nubes dispersas'), 803: ('🌥️', 'Nuboso'), 804: ('☁️', 'Cubierto'),
}

def fetch_forecast(lat, lon):
    qs = urlencode({'lat': lat, 'lon': lon, 'units': 'metric', 'lang': 'es', 'appid': API_KEY})
    with urlopen(f'{FORECAST_URL}?{qs}', timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch_current(lat, lon):
    """Clima actual: temp, humedad, presión, viento, sensación."""
    qs = urlencode({'lat': lat, 'lon': lon, 'units': 'metric', 'lang': 'es', 'appid': API_KEY})
    with urlopen(f'{CURRENT_URL}?{qs}', timeout=15) as r:
        d = json.loads(r.read().decode('utf-8'))
    main = d.get('main', {})
    wind = d.get('wind', {})
    code = d.get('weather', [{}])[0].get('id', 800)
    emoji, desc = describe(code)
    return {
        'temp': round(float(main.get('temp', 0))),
        'sensacion': round(float(main.get('feels_like', 0))),
        'temp_min_hoy': round(float(main.get('temp_min', 0))),
        'temp_max_hoy': round(float(main.get('temp_max', 0))),
        'humedad': int(main.get('humidity', 0)),
        'presion': int(main.get('pressure', 0)),
        'viento_ms': round(float(wind.get('speed', 0)), 1),
        'viento_kmh': round(float(wind.get('speed', 0)) * 3.6, 1),
        'rafaga_ms': round(float(wind.get('gust', 0) or 0), 1),
        'rafaga_kmh': round(float(wind.get('gust', 0) or 0) * 3.6, 1),
        'dir_viento': int(wind.get('deg', 0)),
        'icono': emoji,
        'desc': desc,
        'nubes': int(d.get('clouds', {}).get('all', 0)),
        'visibilidad_m': int(d.get('visibility', 0)),
        # Índice UV desde Open-Meteo (gratis, sin key). OWM /2.5 no entrega uvi
        # y One Call 3.0 exige suscripción de pago separada.
        'uvi': fetch_uv(lat, lon),
    }


def fetch_uv(lat, lon):
    """Índice UV actual (0-11+) vía Open-Meteo. Gratis, sin key, CORS abierto.
    Devuelve None si no se puede obtener (servicio caído, red, etc.)."""
    try:
        qs = urlencode({'latitude': lat, 'longitude': lon,
                        'current': 'uv_index', 'timezone': 'auto'})
        with urlopen(f'{UV_URL}?{qs}', timeout=8) as r:
            d = json.loads(r.read().decode('utf-8'))
        uv = d.get('current', {}).get('uv_index')
        return None if uv is None else round(float(uv), 1)
    except Exception:
        return None


def describe(code):
    return WEATHER_ES.get(int(code), ('🌡️', 'Variable'))


def summarize_region(region, cfg):
    raw = fetch_forecast(cfg['lat'], cfg['lon'])
    items = raw.get('list', [])
    try:
        actual = fetch_current(cfg['lat'], cfg['lon'])
    except Exception:
        actual = None
    daily = defaultdict(lambda: {'temps': [], 'pops': [], 'rain': 0.0, 'wind': [], 'codes': []})
    horas24 = []

    for i, item in enumerate(items):
        dt_txt = item.get('dt_txt', '')
        day = dt_txt[:10]
        main = item.get('main', {})
        wind = item.get('wind', {})
        code = item.get('weather', [{}])[0].get('id', 800)
        pop = float(item.get('pop', 0))
        rain = float(item.get('rain', {}).get('3h', 0) or 0)
        temp = float(main.get('temp', 0))
        wspd = float(wind.get('speed', 0) or 0)

        daily[day]['temps'].append(temp)
        daily[day]['pops'].append(pop)
        daily[day]['rain'] += rain
        daily[day]['wind'].append(wspd)
        daily[day]['codes'].append(code)

        if i < 8:
            emoji, desc = describe(code)
            horas24.append({
                'hora': dt_txt[11:16],
                'temp': round(temp),
                'pop': round(pop * 100),
                'lluvia_mm': round(rain, 1),
                'viento_ms': round(wspd, 1),
                'icono': emoji,
                'desc': desc,
            })

    dias = []
    for day, data in sorted(daily.items())[:5]:
        code = Counter(data['codes']).most_common(1)[0][0]
        emoji, desc = describe(code)
        lluvia = round(data['rain'], 1)
        pop_max = round(max(data['pops']) * 100) if data['pops'] else 0
        viento_max = round(max(data['wind']), 1) if data['wind'] else 0
        riesgo = 'normal'
        if lluvia >= 20 or viento_max >= 12 or pop_max >= 80:
            riesgo = 'alto'
        elif lluvia >= 5 or viento_max >= 8 or pop_max >= 50:
            riesgo = 'medio'
        dias.append({
            'fecha': day,
            'temp_min': round(min(data['temps'])),
            'temp_max': round(max(data['temps'])),
            'pop_max': pop_max,
            'lluvia_mm': lluvia,
            'viento_max_ms': viento_max,
            'icono': emoji,
            'desc': desc,
            'riesgo_operacional': riesgo,
        })

    return {
        'region': region,
        'ciudad_referencia': cfg['ciudad'],
        'coords': {'lat': cfg['lat'], 'lon': cfg['lon']},
        'actual': actual,
        'horas24': horas24,
        'dias': dias,
    }


def actualizar():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    data = {
        'actualizado': datetime.now().isoformat(),
        'fuente': 'OpenWeatherMap 5 días / 3 horas. Alertas oficiales DMC se muestran en sección separada.',
        'nota': 'Pronóstico operacional por ciudad de referencia regional; no reemplaza avisos/alertas/alarma DMC.',
        'regiones': {},
    }
    errores = {}
    for region, cfg in REGIONES.items():
        try:
            data['regiones'][region] = summarize_region(region, cfg)
            print(f'✅ {region}')
            time.sleep(0.8)
        except Exception as e:
            errores[region] = str(e)
            print(f'❌ {region}: {e}')
    data['errores'] = errores
    path = os.path.join(PUBLIC_DIR, 'pronostico_regional.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'Guardado: {path} ({len(data["regiones"])} regiones)')
    return len(data['regiones'])


def deploy():
    os.chdir(PROJECT_DIR)
    r = subprocess.run(['npm', 'run', 'build'], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print(r.stdout)
        print(r.stderr)
        return False
    r = subprocess.run(['npx', 'gh-pages', '-d', 'dist'], capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print(r.stdout)
        print(r.stderr)
        return False
    print('✅ Deploy exitoso')
    return True


if __name__ == '__main__':
    n = actualizar()
    if '--push' in sys.argv and n > 0:
        ok = deploy()
        sys.exit(0 if ok else 1)
