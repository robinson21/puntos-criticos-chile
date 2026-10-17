#!/usr/bin/env python3
"""
Actualiza public/data/aramco_estaciones.json desde https://www.aramcoestaciones.cl/estaciones-de-servicio.

El sitio (Next.js) no tiene una API: la lista de estaciones viene escrita dentro de uno de sus
archivos JavaScript como un arreglo literal ([{id:4,tag:"…",name:"…",coords:{lat:…,lng:…},…}]).
Este script lo encuentra y lo convierte a JSON *leyéndolo como texto* (no ejecuta el código del sitio).
Si algo cambia en el sitio y la lectura falla o trae muy pocas estaciones, se conserva el archivo anterior.
"""
import json, os, re, sys
from urllib.request import Request, urlopen

BASE = 'https://www.aramcoestaciones.cl'
PAGINA = BASE + '/estaciones-de-servicio'
MIN_ESTACIONES = 150
PROJECT_DIR = os.environ.get('PC_PROJECT_DIR') or os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.join(PROJECT_DIR, 'public', 'data', 'aramco_estaciones.json')
UA = {'User-Agent': 'Mozilla/5.0 (puntos-criticos-chile; +https://puntos-criticos.gesstiapp.workers.dev)'}


def bajar(url):
    with urlopen(Request(url, headers=UA), timeout=60) as r:
        return r.read().decode('utf-8', errors='replace')


def arreglo_literal(js):
    """Devuelve el texto del arreglo de estaciones ([{id:…,tag:…}, …]) respetando los strings."""
    m = re.search(r'\[\{id:\d+,tag:"', js)
    if not m:
        return None
    i, prof, comilla = m.start(), 0, False
    k = i
    while k < len(js):
        c = js[k]
        if comilla:
            if c == '\\':
                k += 2
                continue
            if c == '"':
                comilla = False
        elif c == '"':
            comilla = True
        elif c in '[{':
            prof += 1
        elif c in ']}':
            prof -= 1
            if prof == 0:
                return js[i:k + 1]
        k += 1
    return None


def a_json(literal):
    """Objeto literal de JavaScript (claves sin comillas, escapes \\xNN) → texto JSON."""
    out, k, comilla = [], 0, False
    while k < len(literal):
        c = literal[k]
        if comilla:
            if c == '\\':
                sig = literal[k + 1]
                if sig == 'x':  # \xNN no existe en JSON
                    out.append('\\u00' + literal[k + 2:k + 4])
                    k += 4
                    continue
                out.append(literal[k:k + 2])
                k += 2
                continue
            if c == '"':
                comilla = False
            out.append(c)
        elif c == '"':
            comilla = True
            out.append(c)
        else:
            m = re.match(r'([A-Za-z_$][\w$]*):', literal[k:])
            if m and literal[k - 1] in '{,':
                out.append(f'"{m.group(1)}":')
                k += len(m.group(0))
                continue
            if literal.startswith('!0', k):
                out.append('true'); k += 2; continue
            if literal.startswith('!1', k):
                out.append('false'); k += 2; continue
            out.append(c)
        k += 1
    return ''.join(out)


def normalizar(e):
    c = e.get('coords') or {}
    if not isinstance(c.get('lat'), (int, float)) or not isinstance(c.get('lng'), (int, float)):
        return None
    return {
        'id': e['id'],
        'name': (e.get('name') or '').strip(),
        'address': (e.get('address') or '').strip(),
        'region': (e.get('region') or '').strip(),
        'locality': (e.get('locality') or '').strip(),
        'contact': (e.get('contact') or '').strip(),
        'schedule': (e.get('schedule') or '').strip(),
        'coords': {'lat': c['lat'], 'lng': c['lng']},
        'services': [s['name'] for s in e.get('services') or [] if isinstance(s, dict) and s.get('name')],
        'tag': (e.get('tag') or '').strip(),
    }


def main():
    html = bajar(PAGINA)
    scripts = sorted(set(re.findall(r'/_next/static/chunks/[\w./-]+\.js', html)))
    print(f'Página: {len(scripts)} scripts')
    for s in scripts:
        js = bajar(BASE + s)
        if 'coords:{lat:' not in js or 'tag:"' not in js:
            continue
        literal = arreglo_literal(js)
        if not literal:
            continue
        estaciones = [x for x in (normalizar(e) for e in json.loads(a_json(literal))) if x]
        print(f'  {s}: {len(estaciones)} estaciones')
        if len(estaciones) < MIN_ESTACIONES:
            raise SystemExit(f'Muy pocas estaciones ({len(estaciones)}): se conserva el archivo anterior')
        estaciones.sort(key=lambda e: e['id'])
        with open(DESTINO, 'w', encoding='utf-8') as f:
            json.dump(estaciones, f, ensure_ascii=False, indent=2)
        print(f'✅ {len(estaciones)} estaciones → {DESTINO}')
        return
    raise SystemExit('No se encontró la lista de estaciones en el sitio: se conserva el archivo anterior')


if __name__ == '__main__':
    main()
