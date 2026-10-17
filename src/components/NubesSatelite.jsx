import AnimacionTiles from './AnimacionTiles';
import { cuadrosRecientes, urlTiles, ZOOM_NATIVO } from '../data/gibs';

// Nubes: últimas imágenes GOES-East (NASA GIBS), una cada 20 min de las últimas 3 h.
const cargar = async () => (await cuadrosRecientes()).map(t => ({ url: urlTiles(t), tiempo: t }));

export default function NubesSatelite({ activo, onEstado }) {
  return (
    <AnimacionTiles activo={activo} cargar={cargar} onEstado={onEstado} maxNativeZoom={ZOOM_NATIVO}
      opacidad={0.8} pasoMs={700} attribution="Imágenes GOES-East: NASA GIBS" zIndex={250} />
  );
}
