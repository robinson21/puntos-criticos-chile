import { useState } from 'react';
import { useData } from '../data/DataContext';
import {
  useAlertas, alertasDeRegion, antiguedad, limpiarTexto, SEVERIDAD, COLOR_TIPO,
  resumenRelacionados, esOperacional, regionesSenapred, relacionadosEnRegion,
} from '../data/alertas';
import { useFilters } from '../data/FilterContext';
import { tituloRegion } from '../data/stats';

export default function Alertas() {
  const { data: alertas, error } = useAlertas();
  const [filtro, setFiltro] = useState('todas');
  const [soloRegion, setSoloRegion] = useState(true);
  const { metadata, regionActual, loadRegion } = useData();
  const { setFiltroAlerta } = useFilters();

  // Lleva al mapa con los puntos que la alerta puede activar (en la región elegida o en la más expuesta)
  const verEnMapa = a => {
    const regiones = regionesSenapred(a);
    const n = r => relacionadosEnRegion(a, r, metadata?.por_region_causa);
    const destino = regiones.includes(regionActual) ? regionActual : [...regiones].sort((x, y) => n(y) - n(x))[0];
    if (!destino) return;
    if (destino !== regionActual) loadRegion(destino);
    setFiltroAlerta(String(a.id));
    setTimeout(() => document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };

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
  const porRegionCausa = metadata?.por_region_causa;

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
          const operacional = esOperacional(a);
          const rel = operacional ? null : resumenRelacionados(a, porRegionCausa);
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
                {a.poligono && <span className="alerta-area">🗺️ Área exacta definida por la DMC (se dibuja en el mapa)</span>}
                {operacional ? (
                  <span className="alerta-operacional" title="Este fenómeno no activa causas de los puntos críticos de invierno. Igual es relevante para la operación de las instalaciones.">
                    🏭 Alerta operacional: no activa causas de puntos críticos de invierno
                  </span>
                ) : rel && rel.n > 0 ? (
                  <span className="alerta-expuestos"
                    title={a.poligono ? 'Puntos críticos dentro del área exacta del aviso cuya causa puede activarse con este fenómeno.'
                      : 'Puntos críticos de las regiones afectadas cuya causa puede activarse con este fenómeno. La DMC avisa por zonas (costa, valle, cordillera): revisa la zona exacta.'}>
                    🎯 {rel.n.toLocaleString('es-CL')} puntos relacionados{a.poligono ? ' en el área' : ''} · {rel.alto.toLocaleString('es-CL')} Alto/Muy Alto · {rel.af.toLocaleString('es-CL')} afectados este invierno
                    <button type="button" className="btn-mini alerta-ver" onClick={() => verEnMapa(a)}>📍 Ver en el mapa</button>
                  </span>
                ) : rel ? (
                  <span className="alerta-operacional">Sin puntos críticos relacionados en el área afectada</span>
                ) : null}
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
