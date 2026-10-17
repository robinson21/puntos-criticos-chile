import { useState } from 'react';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FilterContext';
import { useEstaciones } from '../data/EstacionesContext';
import { EXPOSICION, NIVELES, RADIOS_KM, RADIO_INCENDIO_KM, LLUVIA_MEDIA_MM, LLUVIA_ALTA_MM, fmtKm, descargarCsvEstaciones } from '../data/estaciones';
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
            {regionActual
              ? <>{comuna ? `${comuna} · ` : ''}{analisis.length} estaciones Aramco · cruce con {filtered.length.toLocaleString('es-CL')} puntos críticos filtrados, alertas DMC e incendios (24 h)</>
              : <>Todo Chile · {analisis.length} estaciones Aramco · alertas DMC e incendios (24 h). Elige una región para sumar los puntos críticos cercanos.</>}
          </p>
        </div>
        <div className="estaciones-acciones">
          {regionActual && <label className="estaciones-radio">
            Radio
            <select value={radioKm} onChange={e => setRadioKm(Number(e.target.value))} aria-label="Radio de búsqueda de puntos críticos">
              {RADIOS_KM.map(r => <option key={r} value={r}>{fmtKm(r)}</option>)}
            </select>
          </label>}
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
                <span role="columnheader">Lluvia 24 h 🔮</span>
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
                    {!regionActual ? <small className="est-nada">Elige una región</small> : a.puntos.total ? (
                      <>
                        <span className="est-niveles">
                          {NIVELES.filter(n => a.puntos.porNivel[n]).map(n => (
                            <span key={n} style={{ color: COLOR_NIVEL[n] }} title={n}>● {a.puntos.porNivel[n]} {n}</span>
                          ))}
                        </span>
                        <small>{a.puntos.afectados ? <b className="est-afectados">🔁 {a.puntos.afectados} afectados este invierno · </b> : null}más cercano a {fmtKm(a.puntos.masCercano)}</small>
                      </>
                    ) : <small className="est-nada">Ninguno</small>}
                  </span>
                  <span role="cell" data-label="Alertas DMC">
                    {a.alertas.length ? a.alertas.map(x => {
                      const rel = a.relacionadas.includes(x);
                      return (
                        <span key={x.id} className={`est-alerta ${rel ? 'rel' : 'op'}`} style={{ borderColor: COLOR_TIPO[x.tipo] }}
                          title={rel ? 'Relacionada: puede activar puntos críticos cercanos a la estación' : 'Operacional: no activa los puntos críticos cercanos'}>
                          {rel ? '🎯 ' : ''}{x.tipo} · {limpiarTexto(x.fenomeno)}
                        </span>
                      );
                    }) : <small className="est-nada">Sin alertas</small>}
                  </span>
                  <span role="cell" data-label="Incendios">
                    {a.incendios.gran && (
                      <span className="est-fuego gran" title={`Gran incendio de vegetación activo (${a.incendios.gran.area_km2} km² en 72 h)`}>
                        🟥 Gran incendio a {fmtKm(a.incendios.gran.distancia)}
                      </span>
                    )}
                    {a.incendios.cantidad
                      ? <span className="est-fuego">🔥 {a.incendios.cantidad} {a.incendios.cantidad === 1 ? 'foco' : 'focos'} · a {fmtKm(a.incendios.masCercano)}</span>
                      : !a.incendios.gran && <small className="est-nada">Ninguno</small>}
                  </span>
                  <span role="cell" data-label="Lluvia pronosticada 24 h">
                    {a.lluvia24 == null ? <small className="est-nada">—</small> : (
                      <span className={`est-lluvia ${a.lluvia24 >= LLUVIA_ALTA_MM ? 'alta' : a.lluvia24 >= LLUVIA_MEDIA_MM ? 'media' : ''}`}
                        title="Lluvia pronosticada por el modelo GFS (NOAA) para las próximas 24 h en la celda de ~25 km de la estación">
                        {a.lluvia24 >= 0.5 ? `${String(a.lluvia24).replace('.', ',')} mm` : 'sin lluvia'}
                      </span>
                    )}
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
            <b>Criterio:</b> <i>Alta</i> = gran incendio de vegetación activo a ≤ 25 km o foco de incendio a ≤ {RADIO_INCENDIO_KM} km (sin fuentes industriales), punto "Muy Alto" en el radio, alerta o alarma DMC 🎯 relacionada (su fenómeno puede activar puntos del radio) o cualquier alarma.
            {' '}<i>Media</i> = punto "Alto" o afectado este invierno en el radio, aviso 🎯 relacionado, o alerta de otro fenómeno. <i>Baja</i> = otros puntos en el radio o solo avisos operacionales.
            {' '}<i>Lluvia pronosticada</i> (GFS, próximas 24 h) con puntos de causas de lluvia en el radio: ≥ {LLUVIA_ALTA_MM} mm → alta; ≥ {LLUVIA_MEDIA_MM} mm → media.
            {' '}Fenómenos que activan puntos: precipitaciones, nevadas, heladas y marejadas; viento, tormentas eléctricas y altas temperaturas son operacionales.
            {' '}Las alertas sin área exacta se aplican a toda la región (la DMC avisa por zonas: cordillera, costa…): revisa la zona.
          </p>
        </>
      )}
    </section>
  );
}
