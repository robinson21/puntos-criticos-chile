import { useState, useMemo } from 'react';
import { useFilters, SIN_INFO } from '../data/FilterContext';
import { useData } from '../data/DataContext';
import { useAlertas, alertasDeRegion } from '../data/alertas';
import { tituloRegion } from '../data/stats';

export default function Filters() {
  const { comuna, setComuna, causa, setCausa, nivel, setNivel, tipoSolucion, setTipoSolucion, filtered, comunas, causas, tipos, haySinTipo } = useFilters();
  const { metadata, loadRegion, regionActual, records } = useData();
  const [buscar, setBuscar] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const regiones = metadata?.regiones ? Object.keys(metadata.regiones) : [];
  const { data: alertas } = useAlertas();
  const [copiado, setCopiado] = useState(false);

  // La URL ya refleja región y filtros (FilterContext); basta con copiarla.
  const copiarEnlace = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      window.prompt('Copia este enlace:', url);
    }
  };

  const comunasFiltradas = useMemo(() => {
    if (!buscar) return comunas.slice(0, 20);
    const q = buscar.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return comunas.filter(c =>
      c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)
    ).slice(0, 30);
  }, [buscar, comunas]);

  const handleRegionChange = (e) => {
    const r = e.target.value;
    // loadRegion('') limpia los registros, así el mapa no queda con la región anterior.
    loadRegion(r);
    setComuna('');
    setCausa('');
    setTipoSolucion('');
    setBuscar('');
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
          <option key={r} value={r}>
            {tituloRegion(r)}{alertasDeRegion(alertas?.alertas, r).length ? ' ⚠️' : ''}
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
            <option value="">Todo tipo de solución</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            {haySinTipo && <option value={SIN_INFO}>Sin información</option>}
          </select>

          <div className="filter-count">{filtered.length.toLocaleString('es-CL')} pts</div>
          <button type="button" className="filter-btn filter-share" onClick={copiarEnlace} title="Copiar enlace a esta vista">
            {copiado ? '✅ Copiado' : '🔗 Compartir'}
          </button>
        </>
      )}
    </div>
  );
}
