// Cruce de estaciones de servicio con puntos críticos, alertas DMC e incendios.
import { REGION_SLUGS } from './regiones.js';
import { alertasDeRegion, SEVERIDAD, alertaAlcanza, causaRelacionada } from './alertas.js';
import { lluviaEsperada } from './pronosticoLluvia.js';
import { RADIO_GRAN_INCENDIO_KM } from './incendios.js';

// Umbrales de lluvia pronosticada en 24 h (acordados con el usuario), con puntos relacionados con lluvia en el radio
export const LLUVIA_MEDIA_MM = 30;
export const LLUVIA_ALTA_MM = 60;
const LLUVIA = { fenomeno: 'Precipitaciones' };

export const RADIOS_KM = [0.5, 1, 2, 5];
export const RADIO_INCENDIO_KM = 10;
export const NIVELES = ['Muy Alto', 'Alto', 'Medio', 'Bajo'];

export const EXPOSICION = {
  alta: { texto: 'Alta', color: '#dc2626', orden: 3 },
  media: { texto: 'Media', color: '#ea580c', orden: 2 },
  baja: { texto: 'Baja', color: '#ca8a04', orden: 1 },
  sin: { texto: 'Sin exposición', color: '#64748b', orden: 0 },
};

// Distancia aproximada en km (equirectangular: sobra para radios de pocos km).
export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
}

// "Libertador General Bernardo O’Higgins" (Aramco) → "LIBERTADOR GENERAL BERNARDO OHIGGINS" (SENAPRED).
// Se comparan los primeros 8 caracteres sin tildes, espacios ni apóstrofos.
const clave = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const CLAVES_SENAPRED = Object.keys(REGION_SLUGS).map(r => [clave(r), r]);
export function regionSenapred(regionEstacion) {
  const k = clave(regionEstacion).slice(0, 8);
  return k ? CLAVES_SENAPRED.find(([s]) => s.startsWith(k))?.[1] || null : null;
}

// Nivel de exposición de una estación (criterio acordado con el usuario):
// alta  = foco de incendio a ≤ 10 km, punto "Muy Alto" en el radio, alerta/alarma DMC relacionada
//         (su fenómeno puede activar puntos que están en el radio) o cualquier alarma
// media = punto "Alto" o afectado este invierno en el radio, aviso relacionado, o alerta de otro fenómeno
// baja  = otros puntos en el radio, o solo avisos no relacionados
const maxSev = lista => Math.max(0, ...lista.map(a => SEVERIDAD[a.tipo] || 0));
// Lluvia pronosticada: ≥ 60 mm en 24 h → alta y ≥ 30 mm → media, si hay puntos de causas de lluvia en el radio
function nivel({ porNivel, total, afectados, deLluvia }, alertas, relacionadas, incendios, lluvia24) {
  const sev = maxSev(alertas), sevRel = maxSev(relacionadas);
  const lluvia = deLluvia > 0 ? lluvia24 || 0 : 0;
  if (incendios.cantidad || incendios.gran || porNivel['Muy Alto'] || sevRel >= 2 || sev >= 3 || lluvia >= LLUVIA_ALTA_MM) return 'alta';
  if (porNivel['Alto'] || afectados || sevRel === 1 || sev >= 2 || lluvia >= LLUVIA_MEDIA_MM) return 'media';
  if (total || sev >= 1) return 'baja';
  return 'sin';
}

// focos: solo los que cuentan como incendio (sin fuentes industriales); grandes: grandes incendios de vegetación activos
export function analizarEstaciones({ estaciones, region, comuna, puntos, alertas, focos, grandes = [], radioKm, pronostico }) {
  // Sin región elegida: todo Chile, solo con alertas DMC e incendios (los puntos críticos se cargan por región).
  const margen = radioKm / 111;
  const margenFuego = RADIO_INCENDIO_KM / 111;
  const porRegion = {};
  const alertasDe = r => (porRegion[r] ??= alertasDeRegion(alertas || [], r));
  const comunaClave = clave(comuna);

  return estaciones
    .filter(e => !region || (regionSenapred(e.region) === region && (!comunaClave || clave(e.locality) === comunaClave)))
    .map(e => {
      const regionE = regionSenapred(e.region);
      // Avisos con área exacta solo cuentan si la estación queda dentro
      const alertasRegion = alertasDe(regionE).filter(a => alertaAlcanza(a, e.coords.lat, e.coords.lng, regionE));
      const pos = { lat: e.coords.lat, lon: e.coords.lng };
      const porNivel = { 'Muy Alto': 0, Alto: 0, Medio: 0, Bajo: 0 };
      let total = 0, afectados = 0, deLluvia = 0, masCercano = null;
      const causasCerca = new Set();
      for (const p of puntos) {
        if (!(p.lv in porNivel) || Math.abs(p.lat - pos.lat) > margen) continue; // excluye "Solucionado"
        const d = distanciaKm(pos, p);
        if (d > radioKm) continue;
        total++;
        porNivel[p.lv]++;
        if (p.af) afectados++;
        causasCerca.add(p.cs);
        if (causaRelacionada(LLUVIA, p.cs)) deLluvia++;
        if (masCercano == null || d < masCercano) masCercano = d;
      }
      let cantidad = 0, fuegoCercano = null;
      for (const f of focos || []) {
        if (Math.abs(f.lat - pos.lat) > margenFuego) continue;
        const d = distanciaKm(pos, f);
        if (d > RADIO_INCENDIO_KM) continue;
        cantidad++;
        if (fuegoCercano == null || d < fuegoCercano) fuegoCercano = d;
      }
      const puntosCerca = { porNivel, total, afectados, deLluvia, masCercano };
      const lluvia24 = lluviaEsperada(pronostico, pos.lat, pos.lon, 24);
      // Gran incendio de vegetación activo a ≤ 25 km (humo, cortes de ruta, evacuaciones)
      let gran = null;
      for (const g of grandes) {
        const d = distanciaKm(pos, g);
        if (d <= RADIO_GRAN_INCENDIO_KM && (!gran || d < gran.distancia)) gran = { ...g, distancia: d };
      }
      const incendios = { cantidad, masCercano: fuegoCercano, gran };
      // Relacionada: su fenómeno puede activar alguno de los puntos críticos que están en el radio
      const relacionadas = alertasRegion.filter(a => [...causasCerca].some(c => causaRelacionada(a, c)));
      return {
        estacion: e, pos, puntos: puntosCerca, alertas: alertasRegion, relacionadas, incendios, lluvia24,
        nivel: nivel(puntosCerca, alertasRegion, relacionadas, incendios, lluvia24),
      };
    })
    .sort((a, b) =>
      EXPOSICION[b.nivel].orden - EXPOSICION[a.nivel].orden
      || Number(Boolean(b.incendios.gran)) - Number(Boolean(a.incendios.gran))
      || b.incendios.cantidad - a.incendios.cantidad
      || b.puntos.porNivel['Muy Alto'] - a.puntos.porNivel['Muy Alto']
      || b.puntos.afectados - a.puntos.afectados
      || b.puntos.total - a.puntos.total);
}

export const fmtKm = km => (km == null ? '' : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`);

// CSV para Excel en español (separador ";", BOM UTF-8)
export function descargarCsvEstaciones(filas, region, radioKm) {
  const celda = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cab = ['Exposición', 'Estación', 'Dirección', 'Comuna', 'Región', `Puntos críticos a ≤ ${fmtKm(radioKm)}`,
    'Muy Alto', 'Alto', 'Medio', 'Bajo', 'Afectados este invierno', 'Punto más cercano', 'Alertas DMC vigentes', `Focos de incendio a ≤ ${RADIO_INCENDIO_KM} km`,
    'Foco más cercano', `Gran incendio a ≤ ${RADIO_GRAN_INCENDIO_KM} km`, 'Lluvia pronosticada 24 h (mm)', 'Latitud', 'Longitud'];
  const lineas = filas.map(f => [
    EXPOSICION[f.nivel].texto, f.estacion.name, f.estacion.address, f.estacion.locality, region || f.estacion.region, f.puntos.total,
    ...NIVELES.map(n => f.puntos.porNivel[n]), f.puntos.afectados, fmtKm(f.puntos.masCercano),
    f.alertas.map(a => `${a.tipo} ${a.fenomeno}${f.relacionadas.includes(a) ? ' (relacionada)' : ' (operacional)'}`).join(' | '), f.incendios.cantidad, fmtKm(f.incendios.masCercano),
    f.incendios.gran ? `a ${fmtKm(f.incendios.gran.distancia)} (${f.incendios.gran.area_km2} km²)` : '',
    f.lluvia24 == null ? '' : String(f.lluvia24).replace('.', ','),
    String(f.pos.lat).replace('.', ','), String(f.pos.lon).replace('.', ','),
  ].map(celda).join(';'));
  const blob = new Blob(['﻿' + [cab.join(';'), ...lineas].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estaciones-expuestas_${clave(region) || 'chile'}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
