#!/usr/bin/env python3
"""
Pronóstico de lluvia hora a hora para Chile (próximas 48 h) desde el modelo GFS de NOAA (0,25°).
Dominio público: se puede usar sin restricciones, también en contexto comercial.

Descarga solo la precipitación acumulada (APCP) del recuadro de Chile continental con el filtro
de NOMADS, la convierte en lluvia por hora (GFS acumula en tramos de 6 h) y guarda
public/data/pronostico_lluvia.json. La app dibuja cada hora y calcula la lluvia esperada por estación.

Formato: cada hora es un arreglo nlat × nlon de bytes (base64), fila 0 = latitud norte;
mm/h = byte × escala. Requiere el paquete eccodes (en GitHub Actions: pip install eccodes eccodeslib).
"""
import base64, json, os, sys, time
from datetime import datetime, timedelta, timezone
from urllib.request import urlopen
from urllib.error import HTTPError

PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(PROJECT_DIR, 'public', 'data', 'pronostico_lluvia.json')

HORAS = 48
NORTE, SUR, OESTE, ESTE = -17.0, -56.0, -76.0, -66.0   # Chile continental
ESCALA = 0.2                                              # mm/h por unidad (byte): hasta 51 mm/h
FILTRO = ('https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25_1hr.pl?dir=%2Fgfs.{fecha}%2F{ciclo}%2Fatmos'
          '&file=gfs.t{ciclo}z.pgrb2.0p25.f{h:03d}&var_APCP=on&lev_surface=on&subregion='
          f'&toplat={NORTE}&leftlon={360 + OESTE}&rightlon={360 + ESTE}&bottomlat={SUR}')


def bajar(url, intentos=3):
    for i in range(intentos):
        try:
            with urlopen(url, timeout=60) as r:
                return r.read()
        except HTTPError as e:
            if e.code == 404 or i == intentos - 1:
                raise
        except Exception:
            if i == intentos - 1:
                raise
        time.sleep(3 * (i + 1))


def corrida_disponible():
    """Corrida más reciente que ya tiene publicado el paso de 48 h (GFS tarda ~4-5 h en publicarse)."""
    ahora = datetime.now(timezone.utc)
    base = ahora.replace(minute=0, second=0, microsecond=0, hour=ahora.hour - ahora.hour % 6)
    for k in range(0, 5):
        c = base - timedelta(hours=6 * k)
        try:
            datos = bajar(FILTRO.format(fecha=c.strftime('%Y%m%d'), ciclo=c.strftime('%H'), h=HORAS), intentos=1)
            if datos[:4] == b'GRIB':
                return c
        except Exception:
            pass
    raise SystemExit('No hay corridas GFS disponibles')


def leer_grib(datos):
    """(stepRange, matriz de mm acumulados, nlat, nlon, lat norte, lon oeste) del único mensaje APCP."""
    import eccodes
    import numpy as np
    h = eccodes.codes_new_from_message(datos)
    try:
        g = lambda k: eccodes.codes_get(h, k)
        nlon, nlat = g('Ni'), g('Nj')
        valores = np.array(eccodes.codes_get_values(h)).reshape(nlat, nlon)
        lat1, lat2 = g('latitudeOfFirstGridPointInDegrees'), g('latitudeOfLastGridPointInDegrees')
        if lat1 < lat2:  # que la fila 0 sea el norte
            valores = valores[::-1]
        lon1 = g('longitudeOfFirstGridPointInDegrees')
        return str(g('stepRange')), valores, nlat, nlon, max(lat1, lat2), lon1 - 360 if lon1 > 180 else lon1
    finally:
        eccodes.codes_release(h)


def main():
    import numpy as np
    corrida = corrida_disponible()
    print(f'Corrida GFS {corrida:%Y-%m-%d %HZ}')
    horas, previo, malla = [], None, None
    for h in range(1, HORAS + 1):
        rango, acum, nlat, nlon, lat0, lon0 = leer_grib(bajar(FILTRO.format(
            fecha=corrida.strftime('%Y%m%d'), ciclo=corrida.strftime('%H'), h=h)))
        malla = malla or (nlat, nlon, lat0, lon0)
        inicio = int(rango.split('-')[0]) if '-' in rango else 0
        # GFS acumula desde el inicio de cada tramo de 6 h: la lluvia de la hora es la diferencia con la hora anterior
        por_hora = acum - previo[1] if previo and previo[0] == inicio else acum
        previo = (inicio, acum)
        q = np.clip(np.round(np.maximum(por_hora, 0) / ESCALA), 0, 255).astype(np.uint8)
        horas.append({
            't': (corrida + timedelta(hours=h)).strftime('%Y-%m-%dT%H:%M:%SZ'),  # fin de la hora de lluvia
            'v': base64.b64encode(q.tobytes()).decode(),
        })
        print(f'  f{h:03d} ({rango}) máx {por_hora.max():.1f} mm/h')
    nlat, nlon, lat0, lon0 = malla
    salida = {
        'modelo': 'NOAA GFS 0,25°',
        'corrida': corrida.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'generado': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'norte': lat0, 'oeste': lon0, 'paso': 0.25, 'nlat': nlat, 'nlon': nlon,
        'escala': ESCALA, 'horas': horas,
    }
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, 'w') as f:
        json.dump(salida, f, separators=(',', ':'))
    print(f'✅ {len(horas)} horas · malla {nlat}×{nlon} · {os.path.getsize(DESTINO) / 1024:.0f} KB → {DESTINO}')


if __name__ == '__main__':
    main()
