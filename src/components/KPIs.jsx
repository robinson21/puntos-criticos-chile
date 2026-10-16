import { useData } from '../data/DataContext';
import { resumen, tituloRegion } from '../data/stats';

export default function KPIs() {
  const { metadata } = useData();
  const { total, riesgoAlto, pctAlto, regiones, numRegiones, fmt } = resumen(metadata);
  const topComuna = metadata?.ranking?.[0];
  const topRegion = regiones[0];

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="label">Puntos Críticos</div>
        <div className="value">{fmt(total)}</div>
        <div className="sub">total nacional</div>
      </div>
      <div className="kpi accent">
        <div className="label">Riesgo Alto o Superior</div>
        <div className="value">{pctAlto}%<span> · {fmt(riesgoAlto)}</span></div>
        <div className="sub">{total ? `${pctAlto}% del total` : 'sin datos'}</div>
      </div>
      <div className="kpi">
        <div className="label">Comunas afectadas</div>
        <div className="value">{metadata?.comunas || '—'}</div>
        <div className="sub">en {numRegiones} regiones</div>
      </div>
      <div className="kpi">
        <div className="label">Región más crítica</div>
        <div className="value" style={{fontSize:'18px'}}>{topRegion ? tituloRegion(topRegion[0]) : '—'}</div>
        <div className="sub">{topRegion ? `${fmt(topRegion[1])} puntos` : ''}</div>
      </div>
      <div className="kpi">
        <div className="label">Comuna top</div>
        <div className="value" style={{fontSize:'17px'}}>{topComuna?.c || '—'}</div>
        <div className="sub">{topComuna ? `${topComuna.n} pts · índice ${topComuna.idx}` : ''}</div>
      </div>
    </div>
  );
}
