import { useMemo, useState } from 'react';
import { useIncendios, CLASE_INCENDIO, TIPO_INCENDIO, RADIO_GRAN_INCENDIO_KM, irAlMapa } from '../data/incendios';
import { useEstaciones } from '../data/EstacionesContext';
import { distanciaKm, fmtKm } from '../data/estaciones';

const hace = iso => {
  if (!iso) return '—';
  const h = Math.round((Date.now() - Date.parse(iso)) / 36e5);
  return h < 1 ? 'hace < 1 h' : h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
};

// Panel nacional: incendios que pueden afectar la operación (grandes e incendios de vegetación, 72 h)
export default function IncendiosPanel() {
  const data = useIncendios();
  const { estaciones } = useEstaciones();
  const [verTodo, setVerTodo] = useState(false);

  const lista = useMemo(() => {
    const ev = (data?.eventos || []).filter(e => e.clase !== 'foco' && e.tipo !== 'industrial');
    return ev.map(e => {
      let cerca = null;
      for (const s of estaciones) {
        const d = distanciaKm({ lat: e.lat, lon: e.lon }, { lat: s.coords.lat, lon: s.coords.lng });
        if (!cerca || d < cerca.d) cerca = { d, s };
      }
      return { ...e, cerca };
    }).sort((a, b) => Number(b.activo) - Number(a.activo) || (a.clase === 'gran' ? -1 : 0) - (b.clase === 'gran' ? -1 : 0) || b.area_km2 - a.area_km2);
  }, [data, estaciones]);

  if (!data) return null;
  const industriales = (data.eventos || []).filter(e => e.tipo === 'industrial').length;
  const mostrar = verTodo ? lista : lista.slice(0, 8);
  const grandes = lista.filter(e => e.clase === 'gran' && e.activo && e.tipo === 'vegetacion').length;

  return (
    <section className="panel incendios-panel" aria-labelledby="titulo-incendios">
      <div className="panel-head">
        <div>
          <h2 id="titulo-incendios">🔥 Incendios que pueden afectar la operación</h2>
          <p className="estaciones-sub">
            Focos NASA FIRMS de las últimas 72 h agrupados en incendios · {grandes} {grandes === 1 ? 'gran incendio activo' : 'grandes incendios activos'}
            {industriales ? ` · ${industriales} fuentes industriales o persistentes excluidas` : ''}
          </p>
        </div>
      </div>
      {!lista.length ? <p className="estaciones-vacio">Sin incendios de vegetación relevantes en las últimas 72 h. ✅</p> : (
        <div className="inc-lista">
          {mostrar.map(e => {
            const c = CLASE_INCENDIO[e.clase];
            const amenaza = e.cerca && e.cerca.d <= (e.clase === 'gran' ? RADIO_GRAN_INCENDIO_KM : 10);
            return (
              <div key={e.id} className={`inc-fila ${e.activo ? '' : 'inactivo'}`}>
                <span className="inc-clase" style={{ background: c.color }}>{c.texto}</span>
                <span className="inc-datos">
                  <b>{String(e.area_km2).replace('.', ',')} km² · {e.detecciones} detecciones</b>
                  <small>{TIPO_INCENDIO[e.tipo].corto} · {e.activo ? `activo, última detección ${hace(e.ultima)}` : `sin detecciones desde ${hace(e.ultima)}`}</small>
                </span>
                <span className={`inc-estacion ${amenaza ? 'amenaza' : ''}`}>
                  {e.cerca ? <>⛽ {e.cerca.s.name}<small>a {fmtKm(e.cerca.d)}{amenaza ? ' · dentro del radio' : ''}</small></> : '—'}
                </span>
                <button type="button" className="btn-mini" onClick={() => irAlMapa(e.lat, e.lon, e.clase === 'gran' ? 11 : 12)}>📍 Ver en mapa</button>
              </div>
            );
          })}
        </div>
      )}
      {lista.length > 8 && <button type="button" className="btn-mini est-mas" onClick={() => setVerTodo(v => !v)}>{verTodo ? 'Mostrar menos' : `Mostrar los ${lista.length}`}</button>}
      <p className="estaciones-nota">
        <b>Cómo se calcula:</b> los satélites VIIRS detectan pixeles calientes de ~375 m; los focos a ≤ 1,5 km se agrupan en un incendio.
        {' '}<i>Gran incendio</i>: ≥ 2 km² detectados o ≥ 500 MW en un paso de satélite. <i>Incendio</i>: ≥ 0,4 km² o ≥ 50 MW.
        {' '}Se excluyen como fuente industrial los junto a industrias, faenas, canteras o vertederos (OpenStreetMap) y los que arden en el mismo lugar casi todos los días.
        {' '}En el desierto (norte de la Región de Atacama) se marcan "verificar": suelen ser faenas.
        {' '}Es una detección satelital, no la información oficial de CONAF/SENAPRED.
      </p>
    </section>
  );
}
