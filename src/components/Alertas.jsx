import { useState, useEffect } from 'react';
import { useData } from '../data/DataContext';

export default function Alertas() {
  const [alertas, setAlertas] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [regionSel, setRegionSel] = useState('');
  const { metadata } = useData();

  useEffect(() => {
    fetch('./data/alertas.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setAlertas(d))
      .catch(e => setError(e.message));
  }, []);

  if (error) return null; // No mostrar si falla
  if (!alertas) {
    return (
      <div className="loading-bar" style={{marginTop: 16}}>
        Cargando alertas meteorológicas…
      </div>
    );
  }

  const regionesUsuario = metadata?.regiones ? Object.keys(metadata.regiones) : [];

  let filtradas = alertas.alertas;
  if (filtro === 'alarmas') filtradas = filtradas.filter(a => a.tipo === 'Alarma');
  else if (filtro === 'alertas') filtradas = filtradas.filter(a => a.tipo === 'Alerta');
  else if (filtro === 'avisos') filtradas = filtradas.filter(a => a.tipo === 'Aviso');

  if (regionSel) {
    filtradas = filtradas.filter(a =>
      a.regiones.some(r => r.toUpperCase().includes(regionSel.split('|')[0].trim().toUpperCase()))
    );
  }

  // Ordenar: alarmas primero, luego alertas, luego avisos
  const orden = { 'Alarma': 0, 'Alerta': 1, 'Aviso': 2 };
  filtradas.sort((a, b) => (orden[a.tipo] ?? 3) - (orden[b.tipo] ?? 3));

  const { totales } = alertas;

  return (
    <div className="alertas-section">
      <div className="panel-head">
        <h2>⚠️ Alertas Meteorológicas</h2>
        <span className="count">
          Actualizado: {alertas.actualizado?.slice(0, 10) || 'hoy'}
        </span>
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
      </div>

      <div className="alerta-list">
        {filtradas.length === 0 && (
          <div style={{padding: 24, textAlign: 'center', color: 'var(--muted-2)', fontSize: 13}}>
            Sin alertas disponibles
          </div>
        )}
        {filtradas.map(a => (
          <div key={a.id} className="alerta-item" style={{borderLeftColor: a.color}}>
            <div className="alerta-head">
              <span className="alerta-tipo" style={{background: a.color}}>
                {a.tipo.toUpperCase()}
              </span>
              <span className="alerta-fenomeno">{a.icono} {a.fenomeno}</span>
              <span className="alerta-codigo">{a.codigo}</span>
            </div>
            <div className="alerta-title">{a.titulo}</div>
            <div className="alerta-detalle">
              <span>📅 {a.desde} → {a.hasta}</span>
              {a.observacion && <span className="alerta-obs">⚠️ {a.observacion}</span>}
              {a.zonas && <span>📍 {a.zonas}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="alerta-footer">
        <span>Fuente: <a href="https://archivos.meteochile.gob.cl/portaldmc/AAA/aaa_mapa.php" target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)'}}>DMC · Sistema de Alerta Meteorológica</a></span>
      </div>
    </div>
  );
}
