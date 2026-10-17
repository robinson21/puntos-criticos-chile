// Cruce de estaciones de servicio con puntos críticos, alertas DMC e incendios.
import { REGION_SLUGS } from './regiones.js';
import { alertasDeRegion, SEVERIDAD } from './alertas.js';

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

// Nivel de exposición de una estación. Criterio simple y explicable:
// alta  = foco de incendio cerca, punto "Muy Alto" dentro del radio, o alerta/alarma DMC en su región
// media = punto "Alto" dentro del radio, o aviso DMC con puntos críticos dentro del radio
// baja  = algún punto crítico dentro del radio, o aviso DMC en su región
// (un punto afectado este invierno dentro del radio sube la estación al menos a media)
function nivel({ porNivel, total, afectados }, alertas, incendios) {
  const maxAlerta = Math.max(0, ...alertas.map(a => SEVERIDAD[a.tipo] || 0));
  if (incendios.cantidad || porNivel['Muy Alto'] || maxAlerta >= 2) return 'alta';
  if (porNivel['Alto'] || afectados || (maxAlerta === 1 && total)) return 'media';
  if (total || maxAlerta === 1) return 'baja';
  return 'sin';
}

export function analizarEstaciones({ estaciones, region, comuna, puntos, alertas, focos, radioKm }) {
  // Sin región elegida: todo Chile, solo con alertas DMC e incendios (los puntos críticos se cargan por región).
  const margen = radioKm / 111;
  const margenFuego = RADIO_INCENDIO_KM / 111;
  const porRegion = {};
  const alertasDe = r => (porRegion[r] ??= alertasDeRegion(alertas || [], r));
  const comunaClave = clave(comuna);

  return estaciones
    .filter(e => !region || (regionSenapred(e.region) === region && (!comunaClave || clave(e.locality) === comunaClave)))
    .map(e => {
      const alertasRegion = alertasDe(regionSenapred(e.region));
      const pos = { lat: e.coords.lat, lon: e.coords.lng };
      const porNivel = { 'Muy Alto': 0, Alto: 0, Medio: 0, Bajo: 0 };
      let total = 0, afectados = 0, masCercano = null;
      for (const p of puntos) {
        if (!(p.lv in porNivel) || Math.abs(p.lat - pos.lat) > margen) continue; // excluye "Solucionado"
        const d = distanciaKm(pos, p);
        if (d > radioKm) continue;
        total++;
        porNivel[p.lv]++;
        if (p.af) afectados++;
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
      const puntosCerca = { porNivel, total, afectados, masCercano };
      const incendios = { cantidad, masCercano: fuegoCercano };
      return { estacion: e, pos, puntos: puntosCerca, alertas: alertasRegion, incendios, nivel: nivel(puntosCerca, alertasRegion, incendios) };
    })
    .sort((a, b) =>
      EXPOSICION[b.nivel].orden - EXPOSICION[a.nivel].orden
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
    'Foco más cercano', 'Latitud', 'Longitud'];
  const lineas = filas.map(f => [
    EXPOSICION[f.nivel].texto, f.estacion.name, f.estacion.address, f.estacion.locality, region || f.estacion.region, f.puntos.total,
    ...NIVELES.map(n => f.puntos.porNivel[n]), f.puntos.afectados, fmtKm(f.puntos.masCercano),
    f.alertas.map(a => `${a.tipo} ${a.fenomeno}`).join(' | '), f.incendios.cantidad, fmtKm(f.incendios.masCercano),
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
