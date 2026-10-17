// Pronóstico de lluvia hora a hora (NOAA GFS 0,25°) generado por actualizar_pronostico_lluvia.py.
// Cada hora es una malla nlat × nlon de bytes (fila 0 = norte); mm/h = byte × escala.
import { useEffect, useState } from 'react';

let pedido = null;
export function usePronosticoLluvia() {
  const [data, setData] = useState(null);
  useEffect(() => {
    pedido ??= fetch('./data/pronostico_lluvia.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => (d?.horas?.length ? decodificar(d) : null))
      .catch(() => null);
    let vivo = true;
    pedido.then(d => vivo && setData(d));
    return () => { vivo = false; };
  }, []);
  return data;
}

function decodificar(d) {
  const horas = d.horas.map(h => {
    const bin = atob(h.v);
    const v = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) v[i] = bin.charCodeAt(i);
    return { t: Date.parse(h.t), iso: h.t, v };
  });
  return { ...d, horas };
}

// Celda de la malla para un punto (null si queda fuera)
function celda(p, lat, lon) {
  const fila = Math.round((p.norte - lat) / p.paso);
  const col = Math.round((lon - p.oeste) / p.paso);
  if (fila < 0 || col < 0 || fila >= p.nlat || col >= p.nlon) return null;
  return fila * p.nlon + col;
}

// Lluvia esperada (mm) en un lugar para las próximas `horas` desde `desde` (ms)
export function lluviaEsperada(p, lat, lon, horas = 24, desde = Date.now()) {
  if (!p) return null;
  const i = celda(p, lat, lon);
  if (i == null) return null;
  const hasta = desde + horas * 3600e3;
  let mm = 0;
  for (const h of p.horas) if (h.t > desde && h.t <= hasta) mm += h.v[i] * p.escala;
  return Math.round(mm * 10) / 10;
}

// Escala oficial NASA IMERG (mm/h → color), la misma de la leyenda
const PALETA = [
  [0.1, [0, 118, 78]], [0.5, [78, 195, 0]], [1, [195, 228, 0]], [2, [255, 176, 6]], [5, [255, 71, 48]],
  [10, [231, 0, 0]], [25, [138, 0, 0]], [50, [57, 0, 0]],
];
function color(mm) {
  if (mm < 0.1) return null;
  for (let i = 1; i < PALETA.length; i++) {
    const [v1, c1] = PALETA[i];
    if (mm <= v1) {
      const [v0, c0] = PALETA[i - 1];
      const f = (Math.log(mm) - Math.log(v0)) / (Math.log(v1) - Math.log(v0));
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
    }
  }
  return PALETA[PALETA.length - 1][1];
}

// Imagen (data URL) de una hora. El mapa está en Mercator: cada fila de la imagen se toma de la latitud
// que le corresponde (si no, la lluvia queda corrida en el centro de Chile). El navegador la amplía suave.
const merc = lat => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMerc = y => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
export function imagenHora(p, hora) {
  const [[latN], [latS]] = limites(p);
  const alto = p.nlat * 2;
  const yN = merc(latN), yS = merc(latS);
  const c = document.createElement('canvas');
  c.width = p.nlon; c.height = alto;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(p.nlon, alto);
  for (let r = 0; r < alto; r++) {
    const lat = invMerc(yN - ((r + 0.5) / alto) * (yN - yS));
    const fila = Math.min(p.nlat - 1, Math.max(0, Math.round((p.norte - lat) / p.paso)));
    for (let col = 0; col < p.nlon; col++) {
      const rgb = color(hora.v[fila * p.nlon + col] * p.escala);
      if (rgb) img.data.set([rgb[0], rgb[1], rgb[2], 210], (r * p.nlon + col) * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// Límites de la imagen (bordes de las celdas, no sus centros)
export const limites = p => [
  [p.norte + p.paso / 2, p.oeste - p.paso / 2],
  [p.norte - (p.nlat - 0.5) * p.paso, p.oeste + (p.nlon - 0.5) * p.paso],
];
