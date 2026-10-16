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
export function limpiarTexto(t) {
  return (t || '')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
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
