import { Polygon, Popup } from 'react-leaflet';
import { useAlertas, COLOR_TIPO, limpiarTexto } from '../data/alertas';

// Áreas exactas de los avisos/alertas DMC que traen polígono (no todas lo traen)
export default function AlertasPoligonos() {
  const { data } = useAlertas();
  const conArea = (data?.alertas || []).filter(a => a.poligono?.length);
  return conArea.map(a => (
    <Polygon key={a.id} positions={a.poligono}
      pathOptions={{ color: COLOR_TIPO[a.tipo] || '#fbbf24', weight: 2, fillOpacity: 0.12, dashArray: '5 4' }}>
      <Popup>
        <div className="popup-content">
          <div className="popup-comuna">{a.icono} {a.tipo} · {a.fenomeno}</div>
          <div className="popup-linea">{limpiarTexto(a.titulo)}</div>
          <div className="popup-linea"><small>Hasta {limpiarTexto(a.hasta)}</small></div>
        </div>
      </Popup>
    </Polygon>
  ));
}
