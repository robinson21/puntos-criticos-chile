import { useState, useMemo } from 'react';
import { useFilters } from '../data/FilterContext';
import { useData } from '../data/DataContext';
import { REGIONES, REGIONES_SIN_DATOS_SENAPRED } from '../data/constantes.js';

export default function Filters() {
  const { comuna, setComuna, causa, setCausa, nivel, setNivel, tipoSolucion, setTipoSolucion, filtered, comunas, causas } = useFilters();
  const { metadata, loadRegion, regionActual, setRegionActual, records } = useData();
  const [buscar, setBuscar] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Las 16 regiones oficiales de Chile. Las que aún no tienen datos SENAPRED
  // se muestran igual, marcadas, para que el mapa cubra todo el territorio.
  const regionesConDatos = metadata?.regiones ? Object.keys(metadata.regiones) : [];
  const regiones = useMemo(() => {
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[''']/g, "'").trim();
    const mapa = new Map();
    regionesConDatos.forEach(r => mapa.set(norm(r), r));
    const lista = [];
    REGIONES.forEach(r => {
      const key = norm(r);
      const conDatos = mapa.get(key);
      if (conDatos) lista.push({ value: conDatos, label: r.charAt(0) + r.slice(1).toLowerCase(), sinDatos: false });
      else if (REGIONES_SIN_DATOS_SENAPRED.includes(r.toUpperCase())) lista.push({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase(), sinDatos: true });
    });
    // Cualquier región con datos que no esté en REGIONES (por seguridad)
    regionesConDatos.forEach(r => { if (!lista.some(x => norm(x.value) === norm(r))) lista.push({ value: r, label: r.charAt(0) + r.slice(1).toLowerCase(), sinDatos: false }); });
    return lista;
  }, [regionesConDatos]);

  const comunasFiltradas = useMemo(() => {
    if (!buscar) return comunas.slice(0, 20);
    const q = buscar.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return comunas.filter(c =>
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    ).slice(0, 30);
  }, [buscar, comunas]);

  const handleRegionChange = (e) => {
    const r = e.target.value;
    setRegionActual(r);
    if (r) {
      loadRegion(r);
      setComuna('');
      setBuscar('');
    }
  };

  return (
    <div className="filters">
      {/* Selector de región */}
      <select
        value={regionActual}
        onChange={handleRegionChange}
        className="region-select"
        style={{ minWidth: 200, flex: 2 }}
      >
        <option value="">🌎 Selecciona región</option>
        {regiones.map(r => (
          <option key={r.value} value={r.value}>
            {r.label}{r.sinDatos ? ' — sin datos SENAPRED' : ''}
          </option>
        ))}
      </select>

      {/* Buscador de comuna con autocomplete — visible solo si hay region seleccionada */}
      {regionActual && (
        <div className="filter-search">
          <input
            type="text"
            placeholder="🔍 Buscar comuna…"
            value={comuna || buscar}
            onChange={e => { setBuscar(e.target.value); setComuna(''); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
          {comuna && (
            <button className="filter-clear" onClick={() => { setComuna(''); setBuscar(''); }}>✕</button>
          )}
          {showDropdown && !comuna && comunasFiltradas.length > 0 && (
            <div className="filter-dropdown">
              {comunasFiltradas.map(c => (
                <div key={c} className="filter-option" onClick={() => { setComuna(c); setBuscar(''); setShowDropdown(false); }}>
                  {c}
                </div>
              ))}
              {comunasFiltradas.length >= 30 && <div className="filter-more">… más resultados (escribe más)</div>}
            </div>
          )}
        </div>
      )}

      {/* Filtros solo si hay datos */}
      {regionActual && records.length > 0 && (
        <>
          <select value={causa} onChange={e => setCausa(e.target.value)}>
            <option value="">Todas las causas</option>
            {causas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="filter-btns">
            {['Bajo','Medio','Alto','Muy Alto'].map(n => (
              <button
                key={n}
                className={`filter-btn ${nivel === n ? 'active' : ''}`}
                onClick={() => setNivel(nivel === n ? '' : n)}
              >
                {n}
              </button>
            ))}
          </div>

          <select value={tipoSolucion} onChange={e => setTipoSolucion(e.target.value)}>
            <option value="">Todo tipo</option>
            <option value="Infraestructura">Infraestructura</option>
            <option value="Mantención">Mantención</option>
            <option value="Estudios">Estudios</option>
            <option value="No Aplica">No Aplica</option>
          </select>

          <div className="filter-count">{filtered.length.toLocaleString('es-CL')} pts</div>
        </>
      )}
    </div>
  );
}
