import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Animación de capas de mapa por cuadros (lluvia radar, lluvia NASA, nubes satelitales).
// Cada cuadro es una capa propia precargada con opacidad 0; al animar solo cambia la opacidad,
// así no parpadea mientras bajan las imágenes. Se detiene un momento en el cuadro más reciente.
// `cargar()` devuelve [{ url, tiempo }] del más antiguo al más reciente.
export default function AnimacionTiles({
  activo, cargar, onEstado, maxNativeZoom = 7, opacidad = 0.75, pasoMs = 650, pausaFinalMs = 2000,
  refrescoMs = 10 * 60 * 1000, attribution = '', zIndex = 300,
}) {
  const map = useMap();
  const capas = useRef([]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let timer = null;

    const limpiar = () => {
      clearTimeout(timer);
      capas.current.forEach(c => map.removeLayer(c));
      capas.current = [];
    };

    const iniciar = async () => {
      try {
        const cuadros = await cargar();
        if (!vivo) return;
        if (!cuadros.length) throw new Error('sin imágenes recientes');
        limpiar();
        const ultimo = cuadros.length - 1;
        capas.current = cuadros.map((c, i) =>
          L.tileLayer(c.url, { maxNativeZoom, maxZoom: 19, opacity: i === ultimo ? opacidad : 0, attribution, zIndex }).addTo(map)
        );
        let idx = ultimo;
        const mostrar = () => onEstado?.({ tiempo: cuadros[idx].tiempo, cuadro: idx + 1, total: cuadros.length });
        mostrar();
        const avanzar = () => {
          const prev = capas.current[idx];
          idx = (idx + 1) % capas.current.length;
          capas.current[idx]?.setOpacity(opacidad);
          prev?.setOpacity(0);
          mostrar();
          timer = setTimeout(avanzar, idx === ultimo ? pausaFinalMs : pasoMs);
        };
        timer = setTimeout(avanzar, pausaFinalMs);
      } catch (e) {
        if (vivo) onEstado?.({ error: e.message });
      }
    };

    iniciar();
    const refresco = setInterval(iniciar, refrescoMs);
    return () => {
      vivo = false;
      clearInterval(refresco);
      limpiar();
      onEstado?.(null);
    };
  }, [activo, map, cargar, onEstado, maxNativeZoom, opacidad, pasoMs, pausaFinalMs, refrescoMs, attribution, zIndex]);

  return null;
}
