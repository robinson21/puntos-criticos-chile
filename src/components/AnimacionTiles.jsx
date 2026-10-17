import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Capa animada por cuadros, controlada por la línea de tiempo del mapa (LineaTiempo).
// Cada cuadro es una capa propia precargada con opacidad 0; al moverse el tiempo solo cambia la
// opacidad (con fundido CSS), así no parpadea. Muestra el último cuadro anterior o igual a `tiempo`;
// si `tiempo` es anterior a su primer cuadro, la capa no se ve.
// `cargar()` devuelve [{ url, tiempo }] del más antiguo al más reciente; `onCuadros` informa los tiempos.
export default function AnimacionTiles({
  activo, cargar, tiempo, onCuadros, maxNativeZoom = 7, opacidad = 0.75,
  refrescoMs = 10 * 60 * 1000, attribution = '', zIndex = 300, className = '',
}) {
  const map = useMap();
  const capas = useRef([]);
  const tiempos = useRef([]);
  const visible = useRef(-1);

  // Muestra el cuadro que corresponde a `t` (ms)
  const mostrar = t => {
    const ts = tiempos.current;
    let idx = -1;
    for (let i = 0; i < ts.length; i++) if (ts[i] <= t) idx = i;
    if (t == null) idx = ts.length - 1;
    if (idx === visible.current) return;
    capas.current[visible.current]?.setOpacity(0);
    capas.current[idx]?.setOpacity(opacidad);
    visible.current = idx;
  };

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const limpiar = () => {
      capas.current.forEach(c => map.removeLayer(c));
      capas.current = [];
      tiempos.current = [];
      visible.current = -1;
    };
    const iniciar = async () => {
      try {
        const cuadros = await cargar();
        if (!vivo) return;
        if (!cuadros.length) throw new Error('sin imágenes recientes');
        limpiar();
        tiempos.current = cuadros.map(c => Date.parse(c.tiempo));
        capas.current = cuadros.map(c =>
          L.tileLayer(c.url, { maxNativeZoom, maxZoom: 19, opacity: 0, attribution, zIndex, className: `capa-animada ${className}` }).addTo(map)
        );
        onCuadros?.(cuadros.map(c => c.tiempo));
      } catch (e) {
        if (vivo) onCuadros?.({ error: e.message });
      }
    };
    iniciar();
    const refresco = setInterval(iniciar, refrescoMs);
    return () => {
      vivo = false;
      clearInterval(refresco);
      limpiar();
      onCuadros?.(null);
    };
  }, [activo, map, cargar, onCuadros, maxNativeZoom, opacidad, refrescoMs, attribution, zIndex, className]);

  useEffect(() => { mostrar(tiempo); });

  return null;
}
