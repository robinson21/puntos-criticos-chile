// CSV pensado para Excel en español (Chile): separador ";", coma decimal y BOM
// UTF-8 para que tildes y "ñ" se vean bien al abrirlo con doble clic.
const COLUMNAS = [
  ['Región', (r, region) => region],
  ['Provincia', r => r.pv || ''],
  ['Comuna', r => r.c],
  ['Sector', r => r.s || ''],
  ['Causa', r => r.cs],
  ['Nivel de riesgo', r => r.lv],
  ['Tipo de solución', r => r.tp || 'Sin información'],
  ['Acción principal', r => r.ac || ''],
  ['Responsable', r => r.rs || ''],
  ['Afectado este invierno', r => (r.af ? 'Sí' : 'No')],
  ['Latitud', r => decimal(r.lat)],
  ['Longitud', r => decimal(r.lon)],
];

const decimal = n => (n == null ? '' : String(n).replace('.', ','));

function celda(v) {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCsv(registros, region) {
  const filas = [COLUMNAS.map(([h]) => h).join(';')];
  for (const r of registros) filas.push(COLUMNAS.map(([, f]) => celda(f(r, region))).join(';'));
  return '﻿' + filas.join('\r\n') + '\r\n';
}

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function nombreArchivo(region, comuna) {
  return ['puntos-criticos', region && slug(region), comuna && slug(comuna)].filter(Boolean).join('_') + '.csv';
}

export function descargarCsv(registros, region, comuna) {
  const blob = new Blob([aCsv(registros, region)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo(region, comuna);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
