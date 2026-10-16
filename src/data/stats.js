// Cálculos derivados de meta.json, compartidos por KPIs e Insights.
// Todo sale de los datos: nada de cifras escritas a mano.

const fmt = (n) => (n || 0).toLocaleString('es-CL');
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
export function tituloRegion(r) {
  return r
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function resumen(metadata) {
  const total = metadata?.total || 0;
  const niveles = metadata?.niveles || {};
  const riesgoAlto = (niveles['Alto'] || 0) + (niveles['Muy Alto'] || 0);

  // Regiones ordenadas por cantidad de puntos (requiere `por_region` en meta.json).
  const regiones = Object.entries(metadata?.por_region || {}).sort((a, b) => b[1] - a[1]);
  const numRegiones = Object.keys(metadata?.regiones || {}).length;

  // Tipo de solución: '' = sin solución definida en el Excel de SENAPRED.
  const tipos = metadata?.tipos || {};
  const sinTipo = tipos[''] || 0;
  const conTipo = total - sinTipo;

  const causas = Object.entries(metadata?.causas || {})
    .filter(([c]) => c)
    .sort((a, b) => b[1] - a[1]);
  const top3Causas = causas.slice(0, 3);
  const top3CausasN = top3Causas.reduce((s, [, n]) => s + n, 0);

  return {
    total,
    riesgoAlto,
    pctAlto: pct(riesgoAlto, total),
    regiones,
    numRegiones,
    infra: tipos['Infraestructura'] || 0,
    mant: tipos['Mantención'] || 0,
    sinTipo,
    conTipo,
    top3Causas,
    top3CausasN,
    fmt,
    pct,
  };
}
