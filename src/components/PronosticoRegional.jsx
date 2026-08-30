import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext';

function fmtFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function badgeClass(riesgo) {
  if (riesgo === 'alto') return 'pron-risk high';
  if (riesgo === 'medio') return 'pron-risk med';
  return 'pron-risk low';
}

export default function PronosticoRegional() {
  const { regionActual } = useData();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('./data/pronostico_regional.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  if (!regionActual || error || !data) return null;
  const pron = data.regiones?.[regionActual];
  if (!pron) return null;

  const hoy = pron.dias?.[0];
  const dias = pron.dias || [];

  return (
    <section className="pron-panel">
      <div className="panel-head">
        <div>
          <h2>🌦️ Pronóstico regional</h2>
          <p className="pron-source">Referencia: {pron.ciudad_referencia} · {data.fuente}</p>
        </div>
        <span className="count">Actualizado: {data.actualizado?.slice(0, 16).replace('T', ' ')}</span>
      </div>

      {hoy && (
        <div className="pron-summary">
          <div className="pron-main-icon">{hoy.icono}</div>
          <div>
            <strong>{regionActual}</strong>
            <p>{hoy.desc} · {hoy.temp_min}°/{hoy.temp_max}° · lluvia {hoy.lluvia_mm} mm · prob. {hoy.pop_max}%</p>
          </div>
          <span className={badgeClass(hoy.riesgo_operacional)}>{hoy.riesgo_operacional}</span>
        </div>
      )}

      <div className="pron-days">
        {dias.map(d => (
          <div className="pron-day" key={d.fecha}>
            <span className="pron-date">{fmtFecha(d.fecha)}</span>
            <span className="pron-emoji">{d.icono}</span>
            <b>{d.temp_min}°/{d.temp_max}°</b>
            <span>☔ {d.pop_max}%</span>
            <span>🌧️ {d.lluvia_mm} mm</span>
          </div>
        ))}
      </div>

      <div className="pron-hours">
        {(pron.horas24 || []).slice(0, 8).map(h => (
          <div className="pron-hour" key={h.hora}>
            <b>{h.hora}</b>
            <span>{h.icono}</span>
            <span>{h.temp}°</span>
            <small>☔{h.pop}%</small>
          </div>
        ))}
      </div>

      <p className="pron-note">Complementa las alertas oficiales DMC. Para decisiones críticas usar siempre Aviso/Alerta/Alarma DMC.</p>
    </section>
  );
}
