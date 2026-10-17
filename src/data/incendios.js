// Incendios agrupados en eventos (los arma actualizar_incendios.py a partir de los focos NASA FIRMS).
import { useEffect, useState } from 'react';

export const RADIO_GRAN_INCENDIO_KM = 25;

export const CLASE_INCENDIO = {
  gran: { texto: 'Gran incendio', color: '#b91c1c', icono: '🟥' },
  incendio: { texto: 'Incendio', color: '#ea580c', icono: '🟧' },
  foco: { texto: 'Foco aislado', color: '#f59e0b', icono: '🟨' },
};
export const TIPO_INCENDIO = {
  vegetacion: { texto: 'Vegetación (forestal / rural)', corto: 'forestal / rural' },
  desierto: { texto: 'Zona desértica: posible faena minera o industrial, verificar', corto: 'zona desértica (verificar)' },
  industrial: { texto: 'Fuente industrial o persistente (no es un incendio)', corto: 'industrial / persistente' },
};

// incendios.json se pide una vez y se comparte (mapa, estaciones, panel)
let pedido = null;
export function useIncendios() {
  const [data, setData] = useState(null);
  useEffect(() => {
    pedido ??= fetch('./data/incendios.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (Array.isArray(d?.focos) ? { ...d, eventos: d.eventos || [] } : null))
      .catch(() => null);
    let vivo = true;
    pedido.then(d => vivo && setData(d));
    return () => { vivo = false; };
  }, []);
  return data;
}

// Focos que cuentan como incendio (excluye fuentes industriales) y de las últimas `horas`
export function focosReales(data, horas = 24) {
  const desde = Date.now() - horas * 3600e3;
  return (data?.focos || []).filter(f => {
    if (f.ind) return false;
    const t = Date.parse(`${f.fecha}T${(f.hora || '').slice(0, 5)}:00Z`);
    return !Number.isFinite(t) || t >= desde;
  });
}

// Grandes incendios de vegetación activos (los que pueden afectar a 25 km)
export const grandesActivos = data => (data?.eventos || []).filter(e => e.clase === 'gran' && e.tipo === 'vegetacion' && e.activo);

// Pide al mapa que vaya a un lugar (lo escucha MapView)
export const irAlMapa = (lat, lon, zoom = 11) => {
  window.dispatchEvent(new CustomEvent('ir-a-mapa', { detail: { lat, lon, zoom } }));
  document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
