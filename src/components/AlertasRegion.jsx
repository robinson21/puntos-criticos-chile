import { useState } from 'react';
import { useData } from '../data/DataContext';
import { useAlertas, alertasDeRegion, antiguedad, zonasDeRegion, limpiarTexto, COLOR_TIPO } from '../data/alertas';
import { tituloRegion } from '../data/stats';

// Franja sobre el mapa: avisos/alertas/alarmas DMC vigentes para la región
// elegida y cuántos puntos críticos hay en ella.
export default function AlertasRegion() {
  const { regionActual, records } = useData();
  const { data } = useAlertas();
  const [abiertas, setAbiertas] = useState(false);
  if (!regionActual || !data) return null;

  const vigentes = alertasDeRegion(data.alertas, regionActual);
  const edad = antiguedad(data.actualizado);
  const altos = records.filter(r => r.lv === 'Alto' || r.lv === 'Muy Alto').length;
  const nombre = tituloRegion(regionActual);

  if (!vigentes.length) {
    return (
      <div className="alertas-region ok">
        <span>✅ Sin avisos, alertas ni alarmas meteorológicas DMC vigentes para {nombre}.</span>
        {edad && <small className={`edad edad-${edad.nivel}`}>DMC · {edad.texto}</small>}
      </div>
    );
  }

  const peor = vigentes[0].tipo;
  return (
    <div className="alertas-region" style={{ borderLeftColor: COLOR_TIPO[peor] }}>
      <div className="alertas-region-head">
        <b>{resumenTipos(vigentes)} DMC {vigentes.length === 1 ? 'vigente' : 'vigentes'} en {nombre}</b>
        <span>
          · {records.length.toLocaleString('es-CL')} puntos críticos en la región, {altos.toLocaleString('es-CL')} de riesgo Alto o Muy Alto
        </span>
        {edad && <small className={`edad edad-${edad.nivel}`}>DMC · {edad.texto}</small>}
      </div>
      <ul>
        {(abiertas ? vigentes : vigentes.slice(0, 1)).map(a => (
          <li key={a.id}>
            <span className="alerta-tipo" data-tipo={a.tipo} style={{ background: COLOR_TIPO[a.tipo] || a.color }}>{a.tipo.toUpperCase()}</span>
            <span className="ar-fen">{a.icono} {a.fenomeno}</span>
            <span className="ar-hasta">hasta {limpiarTexto(a.hasta)}</span>
            {a.zonas && <span className="ar-zonas" title={limpiarTexto(a.zonas)}>📍 {zonasDeRegion(a.zonas, regionActual)}</span>}
          </li>
        ))}
      </ul>
      {vigentes.length > 1 && (
        <button type="button" className="ar-mas" onClick={() => setAbiertas(v => !v)} aria-expanded={abiertas}>
          {abiertas ? 'Ver menos' : `Ver ${vigentes.length - 1} ${vigentes.length - 1 === 1 ? 'aviso más' : 'avisos más'} ▾`}
        </button>
      )}
    </div>
  );
}

// [Alarma, Aviso, Aviso] → "1 alarma y 2 avisos"
function resumenTipos(alertas) {
  const partes = ['Alarma', 'Alerta', 'Aviso']
    .map(t => [t, alertas.filter(a => a.tipo === t).length])
    .filter(([, n]) => n)
    .map(([t, n]) => `${n} ${t.toLowerCase()}${n > 1 ? 's' : ''}`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
}
