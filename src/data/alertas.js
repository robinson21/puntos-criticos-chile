import { useEffect, useState } from 'react';

// Nombres cortos que usa la DMC → nombre de región en los datos de SENAPRED.
// Arica y Parinacota y Tarapacá no tienen puntos críticos en el Excel de
// SENAPRED, así que no tienen equivalente. Juan Fernández es parte de Valparaíso.
const DMC_A_SENAPRED = {
  'Antofagasta': 'ANTOFAGASTA',
  'Atacama': 'ATACAMA',
  'Coquimbo': 'COQUIMBO',
  'Valparaíso': 'VALPARAÍSO',
  'Archipiélago Juan Fernández': 'VALPARAÍSO',
  'Metropolitana': 'METROPOLITANA DE SANTIAGO',
  "O'Higgins": 'LIBERTADOR GENERAL BERNARDO OHIGGINS',
  'Maule': 'MAULE',
  'Ñuble': 'ÑUBLE',
  'Biobío': 'BIOBÍO',
  'La Araucanía': 'LA ARAUCANÍA',
  'Los Ríos': 'LOS RÍOS',
  'Los Lagos': 'LOS LAGOS',
  'Aysén': 'AYSÉN DEL GENERAL CARLOS IBANEZ DEL CAMPO',
  'Magallanes': 'MAGALLANES Y DE LA ANTÁRTICA CHILENA',
};

// La DMC deja entidades HTML en algunos textos (p. ej. "O&#039;Higgins").
// También trae entidades con nombre como "&Ntilde;uble": se decodifican todas.
const ENTIDADES = { apos: "'", quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ', ntilde: 'ñ', Ntilde: 'Ñ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
  Oacute: 'Ó', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', deg: '°', ordm: 'º', ordf: 'ª' };
export function limpiarTexto(t) {
  return (t || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? m);
}

// "Coquimbo (Cordillera) | Valparaíso (Cordillera)" → solo las zonas de `region`.
export function zonasDeRegion(zonas, region) {
  const nombres = Object.keys(DMC_A_SENAPRED).filter(k => DMC_A_SENAPRED[k] === region);
  const partes = limpiarTexto(zonas).split('|').map(z => z.trim()).filter(Boolean);
  const propias = partes.filter(z => nombres.some(n => z.startsWith(n)));
  return (propias.length ? propias : partes).join(' · ');
}

export const SEVERIDAD = { Alarma: 3, Alerta: 2, Aviso: 1 };
export const COLOR_TIPO = { Alarma: '#ef4444', Alerta: '#f97316', Aviso: '#fbbf24' };

export function regionesSenapred(alerta) {
  return [...new Set((alerta.regiones || []).map(r => DMC_A_SENAPRED[r]).filter(Boolean))];
}

export function alertasDeRegion(alertas, region) {
  if (!alertas || !region) return [];
  return alertas
    .filter(a => regionesSenapred(a).includes(region))
    .sort((a, b) => (SEVERIDAD[b.tipo] || 0) - (SEVERIDAD[a.tipo] || 0));
}

// Puntos críticos en las regiones que toca una alerta (cota superior: la DMC
// avisa por zonas dentro de la región, p. ej. "Cordillera", no por comuna).
export function puntosExpuestos(alerta, porRegion) {
  if (!porRegion) return null;
  return regionesSenapred(alerta).reduce((s, r) => s + (porRegion[r] || 0), 0);
}

// Los scripts de actualización escriben la hora del servidor sin zona horaria;
// el servidor corre en UTC, así que se interpreta como UTC.
export function parseFecha(iso) {
  if (!iso) return null;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  return isNaN(d) ? null : d;
}

// Antigüedad legible y nivel: 'ok' (<14 h), 'vieja' (<26 h), 'muy-vieja'.
// Las alertas y el pronóstico se actualizan dos veces al día.
export function antiguedad(iso, ahora = new Date()) {
  const d = parseFecha(iso);
  if (!d) return null;
  const horas = (ahora - d) / 36e5;
  let texto;
  if (horas < 1) texto = 'hace menos de 1 h';
  else if (horas < 48) texto = `hace ${Math.floor(horas)} h`;
  else texto = `hace ${Math.floor(horas / 24)} días`;
  const nivel = horas < 14 ? 'ok' : horas < 26 ? 'vieja' : 'muy-vieja';
  return { texto, nivel, fecha: d };
}

// alertas.json se pide una sola vez y se comparte entre componentes.
let pedido = null;
export function useAlertas() {
  const [estado, setEstado] = useState({ data: null, error: null });
  useEffect(() => {
    if (!pedido) {
      pedido = fetch('./data/alertas.json').then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      pedido.catch(() => { pedido = null; });
    }
    let vivo = true;
    pedido
      .then(data => vivo && setEstado({ data, error: null }))
      .catch(error => vivo && setEstado({ data: null, error }));
    return () => { vivo = false; };
  }, []);
  return estado;
}

// ===== Relación fenómeno DMC → causas SENAPRED que puede activar =====
// Acordado con el usuario (prevencionista): viento, tormentas eléctricas y altas temperaturas
// no activan causas de invierno; se tratan como alertas operacionales.
const sinTildes = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CAUSAS_POR_FENOMENO = [
  { fenomeno: ['precipit', 'lluvia'], causas: ['inundacion', 'anegamiento', 'colapso colectores', 'activacion de quebradas',
    'flujos de barro', 'deslizamiento', 'subsidencia', 'interrupcion de caminos', 'dano/perdida en infraestructura'] },
  { fenomeno: ['nevad', 'nieve'], causas: ['acumulacion de nieve', 'congelamiento', 'interrupcion de caminos'] },
  { fenomeno: ['helada', 'bajas temperaturas', 'frio'], causas: ['congelamiento'] },
  { fenomeno: ['marejada'], causas: ['dano/perdida en infraestructura'] },
];

// Prefijos de causa que activa una alerta ([] = alerta operacional, sin causas relacionadas)
export function causasDeAlerta(alerta) {
  const f = sinTildes(limpiarTexto(`${alerta?.fenomeno || ''} ${alerta?.titulo || ''}`));
  return [...new Set(CAUSAS_POR_FENOMENO.filter(g => g.fenomeno.some(k => f.includes(k))).flatMap(g => g.causas))];
}

export function causaRelacionada(alerta, causa) {
  const c = sinTildes(causa);
  return Boolean(c) && causasDeAlerta(alerta).some(p => c.startsWith(p));
}

export const esOperacional = alerta => causasDeAlerta(alerta).length === 0;

// Puntos relacionados con una alerta en las regiones que toca, a partir de meta.json
// (meta.por_region_causa[región][causa] = { n, alto, af }).
// Con área exacta (polígono) se usan los puntos que quedan dentro (alerta.puntos_area, lo calcula
// actualizar_alertas.py); si no, todos los de las regiones afectadas.
export function resumenRelacionados(alerta, porRegionCausa) {
  const out = { n: 0, alto: 0, af: 0 };
  const fuente = alerta.puntos_area || porRegionCausa;
  if (!fuente) return null;
  const regiones = alerta.puntos_area ? Object.keys(alerta.puntos_area) : regionesSenapred(alerta);
  for (const r of regiones) {
    for (const [causa, v] of Object.entries(fuente[r] || {})) {
      if (!causaRelacionada(alerta, causa)) continue;
      out.n += v.n; out.alto += v.alto; out.af += v.af;
    }
  }
  return out;
}

// Punto en el polígono exacto de un aviso (ray casting); poligono = [[lat, lon], …]
export function dentroDePoligono(lat, lon, poligono) {
  let adentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}

// ¿La alerta alcanza este lugar? Con polígono: solo dentro del área. Sin polígono: toda la región.
export function alertaAlcanza(alerta, lat, lon, region) {
  if (alerta.poligono?.length) return dentroDePoligono(lat, lon, alerta.poligono);
  return regionesSenapred(alerta).includes(region);
}

// ¿Este punto crítico puede activarse con la alerta? (causa relacionada y dentro de su alcance)
export const puntoRelacionado = (alerta, p, region) =>
  p.lv !== 'Solucionado' && causaRelacionada(alerta, p.cs) && alertaAlcanza(alerta, p.lat, p.lon, region);

// Cantidad de puntos relacionados con la alerta en una región (para elegir dónde mostrarla)
export function relacionadosEnRegion(alerta, region, porRegionCausa) {
  const causas = (alerta.puntos_area || porRegionCausa || {})[region] || {};
  return Object.entries(causas).reduce((s, [c, v]) => s + (causaRelacionada(alerta, c) ? v.n : 0), 0);
}

// Orden para mostrar: más grave primero; a igual gravedad, las que activan puntos críticos
// (y entre ellas, las con más puntos relacionados) antes que las operacionales.
export function ordenarAlertas(alertas, relacionados = () => 0) {
  return [...alertas].sort((a, b) =>
    (SEVERIDAD[b.tipo] || 0) - (SEVERIDAD[a.tipo] || 0)
    || Number(esOperacional(a)) - Number(esOperacional(b))
    || relacionados(b) - relacionados(a));
}
