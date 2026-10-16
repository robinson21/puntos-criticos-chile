import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { cuadrosRecientes, urlTiles, ZOOM_NATIVO } from '../data/gibs';

const REFRESCO_MS = 10 * 60 * 1000; // GIBS publica una imagen cada 10 min
const PASO_MS = 700;
const OPACIDAD = 0.8;

// Animación de nubes con las últimas imágenes GOES-East (NASA GIBS).
// Cada cuadro es una capa propia que se precarga con opacidad 0 y solo se
// cambia la opacidad al animar: así no parpadea mientras bajan los tiles.
export default function NubesSatelite({ activo, onEstado }) {
  const map = useMap();
  const capas = useRef([]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let idx = 0;
    let animacion = null;

    const limpiar = () => {
      clearInterval(animacion);
      capas.current.forEach(c => map.removeLayer(c));
      capas.current = [];
    };

    const cargar = async () => {
      try {
        const tiempos = await cuadrosRecientes();
        if (!vivo) return;
        if (!tiempos.length) throw new Error('sin imágenes recientes');
        limpiar();
        capas.current = tiempos.map((t, i) =>
          L.tileLayer(urlTiles(t), {
            maxNativeZoom: ZOOM_NATIVO,
            maxZoom: 19,
            opacity: i === tiempos.length - 1 ? OPACIDAD : 0,
            attribution: 'Imágenes GOES-East: NASA GIBS',
          }).addTo(map)
        );
        idx = tiempos.length - 1;
        onEstado?.({ tiempo: tiempos[idx], total: tiempos.length, cuadro: idx + 1 });
        animacion = setInterval(() => {
          const prev = capas.current[idx];
          idx = (idx + 1) % capas.current.length;
          capas.current[idx]?.setOpacity(OPACIDAD);
          prev?.setOpacity(0);
          onEstado?.({ tiempo: tiempos[idx], total: tiempos.length, cuadro: idx + 1 });
        }, PASO_MS);
      } catch (e) {
        if (vivo) onEstado?.({ error: e.message });
      }
    };

    cargar();
    const refresco = setInterval(cargar, REFRESCO_MS);
    return () => {
      vivo = false;
      clearInterval(refresco);
      limpiar();
      onEstado?.(null);
    };
  }, [activo, map, onEstado]);

  return null;
}
