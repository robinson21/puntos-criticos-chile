import { useEffect, useState } from 'react';
import { useData } from '../data/DataContext';
import { antiguedad } from '../data/alertas';

function fmtFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function fmtFechaHoy() {
  return new Date().toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' });
}

function dirCardinal(deg) {
  if (deg == null) return '';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function badgeClass(riesgo) {
  if (riesgo === 'alto') return 'pron-risk high';
  if (riesgo === 'medio') return 'pron-risk med';
  return 'pron-risk low';
}

// Escala de categoría del índice UV (OMS / OMM).
function uvInfo(uvi) {
  if (uvi <= 2) return { txt: 'Bajo', cls: 'uvo-verde' };
  if (uvi <= 5) return { txt: 'Moderado', cls: 'uvo-amarillo' };
  if (uvi <= 7) return { txt: 'Alto', cls: 'uvo-naranja' };
  if (uvi <= 10) return { txt: 'Muy alto', cls: 'uvo-rojo' };
  return { txt: 'Extremo', cls: 'uvo-violeta' };
}

function UvBadge({ uvi }) {
  const { txt, cls } = uvInfo(uvi);
  return (
    <div className={`uv-badge ${cls}`} title="Índice UV actual (radiación solar). Fuente: Open-Meteo">
      <span className="uv-icon">🌞</span>
      <span className="uv-txt">UV {uvi.toFixed(1)}</span>
      <span className="uv-cat">{txt}</span>
    </div>
  );
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
  const edad = antiguedad(data.actualizado);
  if (!pron) return null;

  const actual = pron.actual;
  const horas = (pron.horas24 || []).slice(0, 8);
  const dias = pron.dias || [];

  return (
    <section className="pron-panel">
      {/* === TARJETA PRINCIPAL ESTILO "EL TIEMPO" (azul cielo) === */}
      {actual && (
        <div className="pron-hero">
          <div className="pron-hero-head">
            <div className="pron-hero-title">
              <h3>El tiempo ahora en <span className="pron-city">{pron.ciudad_referencia}</span></h3>
              <p className="pron-hero-date">{fmtFechaHoy()}</p>
            </div>
            <span className={badgeClass(dias[0]?.riesgo_operacional)}>
              Riesgo op.: {dias[0]?.riesgo_operacional}
            </span>
          </div>

          <div className="pron-hero-body">
            {/* Izquierda: temperatura grande */}
            <div className="pron-hero-temp">
              <span className="pron-temp-value">{actual.temp}°</span>
              <span className="pron-temp-icon">{actual.icono}</span>
            </div>

            {/* Centro: descripción + min/max */}
            <div className="pron-hero-center">
              <div className="pron-hero-desc">{actual.desc}</div>
              <div className="pron-hero-minmax">
                Mín {actual.temp_min_hoy}° · Máx {actual.temp_max_hoy}°
              </div>
              <div className="pron-hero-feel">Sensación térmica {actual.sensacion}°</div>
              {actual.uvi != null && <UvBadge uvi={actual.uvi} />}
            </div>

            {/* Derecha: métricas */}
            <div className="pron-hero-metrics">
              <div className="pron-metric">
                <span className="pron-metric-icon">💧</span>
                <div>
                  <div className="pron-metric-value">{actual.humedad}%</div>
                  <div className="pron-metric-label">Humedad</div>
                </div>
              </div>
              <div className="pron-metric">
                <span className="pron-metric-icon">💨</span>
                <div>
                  <div className="pron-metric-value">{actual.viento_kmh}</div>
                  <div className="pron-metric-label">km/h {dirCardinal(actual.dir_viento)}</div>
                </div>
              </div>
              <div className="pron-metric">
                <span className="pron-metric-icon">🌡️</span>
                <div>
                  <div className="pron-metric-value">{actual.presion}</div>
                  <div className="pron-metric-label">hPa</div>
                </div>
              </div>
              {actual.rafaga_kmh > 0 && (
                <div className="pron-metric">
                  <span className="pron-metric-icon">🌬️</span>
                  <div>
                    <div className="pron-metric-value">{actual.rafaga_kmh}</div>
                    <div className="pron-metric-label">km/h ráfaga</div>
                  </div>
                </div>
              )}
              <div className="pron-metric">
                <span className="pron-metric-icon">☁️</span>
                <div>
                  <div className="pron-metric-value">{actual.nubes}%</div>
                  <div className="pron-metric-label">Nubosidad</div>
                </div>
              </div>
              <div className="pron-metric">
                <span className="pron-metric-icon">👁️</span>
                <div>
                  <div className="pron-metric-value">{(actual.visibilidad_m / 1000).toFixed(1)}</div>
                  <div className="pron-metric-label">km visibilidad</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === PRÓXIMAS 24 HORAS === */}
      {horas.length > 0 && (
        <>
          <h4 className="pron-subtitle">🕐 Próximas 24 horas</h4>
          <div className="pron-hours">
            {horas.map(h => (
              <div className="pron-hour" key={h.hora}>
                <b>{h.hora}</b>
                <span className="pron-hour-icon">{h.icono}</span>
                <span className="pron-hour-temp">{h.temp}°</span>
                <small>☔ {h.pop}%</small>
              </div>
            ))}
          </div>
        </>
      )}

      {/* === PRÓXIMOS 5 DÍAS === */}
      <h4 className="pron-subtitle">📅 Próximos 5 días</h4>
      <div className="pron-days">
        {dias.map(d => (
          <div className={`pron-day ${d.riesgo_operacional === 'alto' ? 'is-high' : d.riesgo_operacional === 'medio' ? 'is-med' : ''}`} key={d.fecha}>
            <span className="pron-date">{fmtFecha(d.fecha)}</span>
            <span className="pron-emoji">{d.icono}</span>
            <b className="pron-day-temp">{d.temp_min}° / {d.temp_max}°</b>
            <div className="pron-day-detail">
              <span>☔ {d.pop_max}%</span>
              <span>🌧️ {d.lluvia_mm} mm</span>
            </div>
            <div className="pron-day-desc">{d.desc}</div>
          </div>
        ))}
      </div>

      <p className="pron-foot">
        <span>Fuente: {data.fuente}</span>
        <span className="pron-foot-sep">·</span>
        {edad ? (
          <span className={`edad edad-${edad.nivel}`} title={edad.fecha.toLocaleString('es-CL')}>
            Actualizado {edad.texto}{edad.nivel === 'muy-vieja' && ' · puede estar desactualizado'}
          </span>
        ) : (
          <span>Actualizado: {data.actualizado?.slice(0, 16).replace('T', ' ')}</span>
        )}
      </p>
    </section>
  );
}
