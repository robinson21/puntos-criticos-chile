import { useEffect, useState } from 'react';
import { antiguedad } from '../data/alertas';

const fecha = iso => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });

// Estado del Excel de SENAPRED: fecha del archivo, cuándo se revisó y si vino de la fuente oficial.
export default function SenapredEstado() {
  const [e, setE] = useState(null);
  useEffect(() => {
    fetch('./data/senapred_estado.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(setE).catch(() => {});
  }, []);
  if (!e) return null;

  const revisado = antiguedad(e.revisado);
  // Se revisa una vez al día: más de 30 h sin revisar significa que la tarea diaria falló.
  const sinRevisar = !revisado || (Date.now() - revisado.fecha) / 36e5 > 30;
  const nivel = !e.ok || sinRevisar ? 'mal' : e.fuente === 'respaldo' ? 'aviso' : 'ok';
  const detalle = !e.ok
    ? `No se pudo descargar el Excel de SENAPRED en la última revisión (${revisado?.texto || 'sin fecha'}). Se muestran los últimos datos disponibles.`
    : sinRevisar
      ? `La revisión diaria no corre desde ${revisado?.texto || 'hace tiempo'}.`
      : e.fuente === 'respaldo'
        ? 'El link oficial de SENAPRED no entrega el Excel: se usa una copia de respaldo publicada por un tercero. Verifica si SENAPRED publicó una versión nueva.'
        : 'Excel descargado desde el sitio oficial de SENAPRED.';

  return (
    <div className={`senapred-estado senapred-${nivel}`} title={detalle}>
      <span>{nivel === 'ok' ? '✅' : '⚠️'} Excel SENAPRED{e.excel_modificado ? ` del ${fecha(e.excel_modificado)}` : ''}</span>
      <span>revisado {revisado?.texto || '—'}{e.fuente === 'respaldo' ? ' · copia de respaldo' : ''}</span>
      {nivel !== 'ok' && <small>{detalle}</small>}
    </div>
  );
}
