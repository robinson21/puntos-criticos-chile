import { useState } from 'react';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FilterContext';
import { useEstaciones } from '../data/EstacionesContext';
import { EXPOSICION, NIVELES, RADIOS_KM, RADIO_INCENDIO_KM, fmtKm, descargarCsvEstaciones } from '../data/estaciones';
import { COLOR_TIPO, limpiarTexto } from '../data/alertas';

const COLOR_NIVEL = { 'Muy Alto': 'var(--red)', Alto: 'var(--copper)', Medio: 'var(--amber)', Bajo: 'var(--teal)' };
const MAX_INICIAL = 12;

// Panel: qué estaciones de servicio tienen puntos críticos, alertas DMC o incendios cerca
export default function EstacionesExpuestas() {
  const { regionActual } = useData();
  const { comuna, filtered } = useFilters();
  const { analisis, radioKm, setRadioKm, seleccion, seleccionar } = useEstaciones();
  const [todas, setTodas] = useState(false);
  const [soloExpuestas, setSoloExpuestas] = useState(true);

  const resumen = Object.fromEntries(Object.keys(EXPOSICION).map(k => [k, analisis.filter(a => a.nivel === k).length]));
  const lista = soloExpuestas ? analisis.filter(a => a.nivel !== 'sin') : analisis;
  const mostrar = todas ? lista : lista.slice(0, MAX_INICIAL);

  const verEnMapa = id => {
    seleccionar(id);
    document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="panel estaciones-panel" aria-labelledby="titulo-estaciones">
      <div className="panel-head estaciones-head">
        <div>
          <h2 id="titulo-estaciones">⛽ Estaciones de servicio expuestas</h2>
          <p className="estaciones-sub">
            {comuna ? `${comuna} · ` : ''}{analisis.length} estaciones Aramco · cruce con {filtered.length.toLocaleString('es-CL')} puntos críticos filtrados, alertas DMC e incendios (24 h)
          </p>
        </div>
        <div className="estaciones-acciones">
          <label className="estaciones-radio">
            Radio
            <select value={radioKm} onChange={e => setRadioKm(Number(e.target.value))} aria-label="Radio de búsqueda de puntos críticos">
              {RADIOS_KM.map(r => <option key={r} value={r}>{fmtKm(r)}</option>)}
            </select>
          </label>
          <button type="button" className="btn-mini" disabled={!analisis.length} onClick={() => descargarCsvEstaciones(analisis, regionActual, radioKm)}>⬇ CSV</button>
        </div>
      </div>

      {!analisis.length ? (
        <p className="estaciones-vacio">No hay estaciones Aramco registradas en {comuna || 'esta región'}.</p>
      ) : (
        <>
          <div className="estaciones-resumen">
            {Object.entries(EXPOSICION).map(([k, v]) => (
              <div key={k} className="estaciones-kpi" style={{ '--c': v.color }}>
                <b>{resumen[k]}</b><span>{v.texto}</span>
              </div>
            ))}
          </div>

          <div className="estaciones-filtro">
            <label><input type="checkbox" checked={soloExpuestas} onChange={e => setSoloExpuestas(e.target.checked)} /> Solo estaciones con exposición</label>
          </div>

          {!lista.length ? <p className="estaciones-vacio">Ninguna estación tiene exposición con los filtros y el radio actuales. ✅</p> : (
            <div className="estaciones-tabla" role="table" aria-label="Estaciones expuestas">
              <div className="est-fila est-cab" role="row">
                <span role="columnheader">Exposición</span>
                <span role="columnheader">Estación</span>
                <span role="columnheader">Puntos críticos a ≤ {fmtKm(radioKm)}</span>
                <span role="columnheader">Alertas DMC</span>
                <span role="columnheader">Incendios ≤ {RADIO_INCENDIO_KM} km</span>
                <span role="columnheader" />
              </div>
              {mostrar.map(a => (
                <div key={a.estacion.id} role="row" className={`est-fila ${seleccion === a.estacion.id ? 'sel' : ''}`}>
                  <span role="cell"><span className="est-nivel" style={{ background: EXPOSICION[a.nivel].color }}>{EXPOSICION[a.nivel].texto}</span></span>
                  <span role="cell" className="est-nombre">
                    <b>{a.estacion.name}</b>
                    <small>{a.estacion.address}</small>
                  </span>
                  <span role="cell" data-label="Puntos críticos">
                    {a.puntos.total ? (
                      <>
                        <span className="est-niveles">
                          {NIVELES.filter(n => a.puntos.porNivel[n]).map(n => (
                            <span key={n} style={{ color: COLOR_NIVEL[n] }} title={n}>● {a.puntos.porNivel[n]} {n}</span>
                          ))}
                        </span>
                        <small>más cercano a {fmtKm(a.puntos.masCercano)}</small>
                      </>
                    ) : <small className="est-nada">Ninguno</small>}
                  </span>
                  <span role="cell" data-label="Alertas DMC">
                    {a.alertas.length ? a.alertas.map(x => (
                      <span key={x.id} className="est-alerta" style={{ borderColor: COLOR_TIPO[x.tipo] }}>{x.tipo} · {limpiarTexto(x.fenomeno)}</span>
                    )) : <small className="est-nada">Sin alertas</small>}
                  </span>
                  <span role="cell" data-label="Incendios">
                    {a.incendios.cantidad
                      ? <span className="est-fuego">🔥 {a.incendios.cantidad} · a {fmtKm(a.incendios.masCercano)}</span>
                      : <small className="est-nada">Ninguno</small>}
                  </span>
                  <span role="cell"><button type="button" className="btn-mini" onClick={() => verEnMapa(a.estacion.id)}>📍 Ver en mapa</button></span>
                </div>
              ))}
            </div>
          )}
          {lista.length > MAX_INICIAL && (
            <button type="button" className="btn-mini est-mas" onClick={() => setTodas(t => !t)}>
              {todas ? 'Mostrar menos' : `Mostrar las ${lista.length} estaciones`}
            </button>
          )}
          <p className="estaciones-nota">
            <b>Criterio:</b> <i>Alta</i> = foco de incendio a ≤ {RADIO_INCENDIO_KM} km, punto "Muy Alto" dentro del radio o alerta/alarma DMC en la región.
            {' '}<i>Media</i> = punto "Alto" dentro del radio, o aviso DMC con puntos críticos cerca. <i>Baja</i> = otros puntos dentro del radio o solo aviso DMC.
            {' '}Las alertas DMC son por zonas de la región (cordillera, costa…), no por comuna: revisa la zona exacta.
          </p>
        </>
      )}
    </section>
  );
}
