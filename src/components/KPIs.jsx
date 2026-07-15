import { useFilters } from '../data/FilterContext';

export default function KPIs() {
  const { stats, ranking } = useFilters();
  const topComuna = ranking[0];

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="label">Puntos Críticos</div>
        <div className="value">{stats.total.toLocaleString('es-CL')}</div>
        <div className="sub">bajo el filtro actual</div>
      </div>
      <div className="kpi accent">
        <div className="label">Riesgo Alto o Superior</div>
        <div className="value">{stats.pctAlto}%<span> · {stats.riesgoAlto.toLocaleString('es-CL')}</span></div>
        <div className="sub">{stats.total ? Math.round(stats.riesgoAlto/stats.total*100)+'% del total' : 'sin datos'}</div>
      </div>
      <div className="kpi">
        <div className="label">Tasa de riesgo</div>
        <div className="value" style={{fontSize:'22px'}}>
          {stats.total ? (stats.riesgoAlto / stats.total * 100).toFixed(1) : '—'}%
        </div>
        <div className="sub">puntos con nivel alto o muy alto</div>
      </div>
      <div className="kpi">
        <div className="label">Comuna más compleja</div>
        <div className="value" style={{fontSize:'18px'}}>{topComuna?.c || '—'}</div>
        <div className="sub">{topComuna ? `${topComuna.n} puntos · índice ${topComuna.idx}/100` : 'sin datos'}</div>
      </div>
      <div className="kpi">
        <div className="label">Requieren infraestructura</div>
        <div className="value">42%</div>
        <div className="sub">del total con solución definida</div>
      </div>
    </div>
  );
}
