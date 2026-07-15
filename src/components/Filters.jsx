import { useFilters } from '../data/FilterContext';
import { REGIONES } from '../data/constantes';

export default function Filters() {
  const {
    region, setRegion, comuna, setComuna,
    causa, setCausa, nivel, setNivel, tipoSolucion, setTipoSolucion,
    comunas, causas, niveles, tipos, filtered
  } = useFilters();

  return (
    <div className="filters">
      <select value={region} onChange={e => { setRegion(e.target.value); setComuna(''); }}>
        <option value="">Todas las regiones</option>
        {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={comuna} onChange={e => setComuna(e.target.value)}>
        <option value="">Todas las comunas</option>
        {comunas.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={causa} onChange={e => setCausa(e.target.value)}>
        <option value="">Todas las causas</option>
        {causas.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={nivel} onChange={e => setNivel(e.target.value)}>
        <option value="">Todo nivel de riesgo</option>
        {niveles.length > 0 ? niveles.map(n => <option key={n} value={n}>{n}</option>)
          : ['Bajo','Medio','Alto','Muy Alto'].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={tipoSolucion} onChange={e => setTipoSolucion(e.target.value)}>
        <option value="">Todo tipo de solución</option>
        {tipos.length > 0 ? tipos.map(t => <option key={t} value={t}>{t}</option>)
          : ['Infraestructura','Mantención','Estudios','No Aplica'].map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <div className="filter-count">{filtered.length.toLocaleString('es-CL')} puntos</div>
    </div>
  );
}
