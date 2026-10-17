// Estado de la vista en la URL (?region=valparaiso&comuna=PETORCA&nivel=Alto…)
// para poder compartir exactamente lo que se está viendo.
import { REGION_SLUGS } from './regiones';

const PARAMS = ['provincia', 'comuna', 'causa', 'nivel', 'tipo', 'afectados'];

export function leerUrl() {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const slug = q.get('region');
  const region = Object.keys(REGION_SLUGS).find(r => REGION_SLUGS[r] === slug) || '';
  const out = { region };
  for (const k of PARAMS) out[k] = region ? q.get(k) || '' : '';
  return out;
}

export function escribirUrl({ region, ...filtros }) {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams();
  if (region && REGION_SLUGS[region]) {
    q.set('region', REGION_SLUGS[region]);
    for (const k of PARAMS) if (filtros[k]) q.set(k, filtros[k]);
  }
  const s = q.toString();
  const url = window.location.pathname + (s ? '?' + s : '') + window.location.hash;
  if (url !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, '', url);
  }
}
