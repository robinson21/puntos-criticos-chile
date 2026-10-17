import { useState } from 'react';
import { useData } from '../data/DataContext';
import {
  useAlertas, alertasDeRegion, antiguedad, puntosExpuestos, limpiarTexto, SEVERIDAD, COLOR_TIPO,
} from '../data/alertas';
import { tituloRegion } from '../data/stats';

export default function Alertas() {
  const { data: alertas, error } = useAlertas();
  const [filtro, setFiltro] = useState('todas');
  const [soloRegion, setSoloRegion] = useState(true);
  const { metadata, regionActual } = useData();

  if (error) return null; // No mostrar si falla
  if (!alertas) {
    return (
      <div className="loading-bar" style={{marginTop: 16}}>
        Cargando alertas meteorológicas…
      </div>
    );
  }

  const filtrarRegion = Boolean(regionActual && soloRegion);
  const base = filtrarRegion ? alertasDeRegion(alertas.alertas, regionActual) : [...alertas.alertas];
  // Contadores sobre la misma base que se lista (región o todo Chile).
  const totales = {
    total: base.length,
    alarmas: base.filter(a => a.tipo === 'Alarma').length,
    alertas: base.filter(a => a.tipo === 'Alerta').length,
    avisos: base.filter(a => a.tipo === 'Aviso').length,
  };
  let filtradas = base;
  if (filtro === 'alarmas') filtradas = filtradas.filter(a => a.tipo === 'Alarma');
  else if (filtro === 'alertas') filtradas = filtradas.filter(a => a.tipo === 'Alerta');
  else if (filtro === 'avisos') filtradas = filtradas.filter(a => a.tipo === 'Aviso');

  // Alarmas primero, luego alertas, luego avisos
  filtradas.sort((a, b) => (SEVERIDAD[b.tipo] || 0) - (SEVERIDAD[a.tipo] || 0));

  const edad = antiguedad(alertas.actualizado);
  const porRegion = metadata?.por_region;

  return (
    <div className="alertas-section">
      <div className="panel-head">
        <h2>⚠️ Alertas Meteorológicas</h2>
        {edad ? (
          <span className={`count edad edad-${edad.nivel}`} title={edad.fecha.toLocaleString('es-CL')}>
            Actualizado {edad.texto}
            {edad.nivel === 'muy-vieja' && ' · puede estar desactualizado'}
          </span>
        ) : (
          <span className="count">Actualizado: {alertas.actualizado?.slice(0, 10) || '—'}</span>
        )}
      </div>

      <div className="alerta-badges">
        <button
          className={`alerta-badge ${filtro === 'todas' ? 'active' : ''}`}
          onClick={() => setFiltro('todas')}
        >
          Todas <span className="alerta-num">{totales.total}</span>
        </button>
        <button
          className={`alerta-badge bad-re ${filtro === 'alarmas' ? 'active' : ''}`}
          onClick={() => setFiltro('alarmas')}
        >
          🔴 Alarmas <span className="alerta-num">{totales.alarmas}</span>
        </button>
        <button
          className={`alerta-badge bad-or ${filtro === 'alertas' ? 'active' : ''}`}
          onClick={() => setFiltro('alertas')}
        >
          🟠 Alertas <span className="alerta-num">{totales.alertas}</span>
        </button>
        <button
          className={`alerta-badge bad-yl ${filtro === 'avisos' ? 'active' : ''}`}
          onClick={() => setFiltro('avisos')}
        >
          🟡 Avisos <span className="alerta-num">{totales.avisos}</span>
        </button>
        {regionActual && (
          <label className="alerta-solo-region">
            <input type="checkbox" checked={soloRegion} onChange={e => setSoloRegion(e.target.checked)} />
            Solo {tituloRegion(regionActual)}
          </label>
        )}
      </div>

      <div className="alerta-list">
        {filtradas.length === 0 && (
          <div style={{padding: 24, textAlign: 'center', color: 'var(--muted-2)', fontSize: 13}}>
            {filtrarRegion ? `Sin alertas vigentes para ${tituloRegion(regionActual)}` : 'Sin alertas vigentes'}
          </div>
        )}
        {filtradas.map(a => {
          const expuestos = puntosExpuestos(a, porRegion);
          return (
            <div key={a.id} className="alerta-item" style={{borderLeftColor: COLOR_TIPO[a.tipo] || a.color}}>
              <div className="alerta-head">
                <span className="alerta-tipo" data-tipo={a.tipo} style={{background: COLOR_TIPO[a.tipo] || a.color}}>
                  {a.tipo.toUpperCase()}
                </span>
                <span className="alerta-fenomeno">{a.icono} {a.fenomeno}</span>
                <span className="alerta-codigo">{a.codigo}</span>
              </div>
              <div className="alerta-title">{limpiarTexto(a.titulo)}</div>
              <div className="alerta-detalle">
                <span>📅 {limpiarTexto(a.desde)} → {limpiarTexto(a.hasta)}</span>
                {a.observacion && <span className="alerta-obs">⚠️ {limpiarTexto(a.observacion)}</span>}
                {a.zonas && <span>📍 {limpiarTexto(a.zonas)}</span>}
                {expuestos > 0 && (
                  <span
                    className="alerta-expuestos"
                    title="Total de puntos críticos SENAPRED en las regiones afectadas. La DMC avisa por zonas (costa, valle, cordillera), así que no todos están necesariamente dentro de la zona del aviso."
                  >
                    🎯 {expuestos.toLocaleString('es-CL')} puntos críticos en las regiones afectadas
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="alerta-footer">
        <span>Fuente: <a href="https://archivos.meteochile.gob.cl/portaldmc/AAA/aaa_mapa.php" target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)'}}>DMC · Sistema de Alerta Meteorológica</a></span>
      </div>
    </div>
  );
}
