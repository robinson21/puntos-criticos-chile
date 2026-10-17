// Imágenes del satélite GOES-East (NASA GIBS, gratis y sin key).
// GeoColor: color real de día e infrarrojo de noche; una imagen cada 10 min
// con ~45 min de retraso. Se piden a GIBS solo las horas que existen
// (DescribeDomains) para que la animación no tenga cuadros vacíos.
const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
export const CAPA = 'GOES-East_ABI_GeoColor';
const MATRIZ = 'GoogleMapsCompatible_Level7';
export const ZOOM_NATIVO = 7;

export const urlTiles = (tiempo) => `${BASE}/${CAPA}/default/${tiempo}/${MATRIZ}/{z}/{y}/{x}.png`;

const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

// "2026-10-16T19:00:00Z/2026-10-16T23:10:00Z/PT10M,2026-…" → lista de fechas
export function expandirDominio(texto) {
  const out = [];
  for (const rango of texto.split(',').map(s => s.trim()).filter(Boolean)) {
    const [ini, fin, paso] = rango.split('/');
    const minutos = parseInt((paso || 'PT10M').replace(/\D/g, ''), 10) || 10;
    const a = new Date(ini);
    const b = new Date(fin || ini);
    if (isNaN(a) || isNaN(b)) continue;
    for (let t = a.getTime(); t <= b.getTime(); t += minutos * 60000) out.push(new Date(t));
  }
  return out.sort((x, y) => x - y);
}

// Últimos `cuadros` instantes disponibles, separados al menos `cadaMin` minutos.
export function elegirCuadros(fechas, cuadros = 6, cadaMin = 20) {
  const elegidos = [];
  for (let i = fechas.length - 1; i >= 0 && elegidos.length < cuadros; i--) {
    const f = fechas[i];
    if (!elegidos.length || elegidos[elegidos.length - 1] - f >= cadaMin * 60000) elegidos.push(f);
  }
  return elegidos.reverse().map(iso);
}

export async function cuadrosRecientes({ horas = 3, cuadros = 6, cadaMin = 20, ahora = new Date() } = {}) {
  const desde = iso(new Date(ahora.getTime() - horas * 3600000));
  const hasta = iso(ahora);
  const url = `${BASE}/1.0.0/${CAPA}/default/${MATRIZ}/all/${desde}--${hasta}.xml`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GIBS HTTP ${r.status}`);
  const xml = await r.text();
  const dom = xml.match(/<Domain>([^<]+)<\/Domain>/);
  if (!dom) throw new Error('GIBS sin imágenes recientes');
  // El último instante anunciado a veces aún se está generando (faltan tiles): se omite.
  return elegirCuadros(expandirDominio(dom[1]).slice(0, -1), cuadros, cadaMin);
}

export const horaChile = (tiempo) =>
  new Date(tiempo).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Santiago' });
