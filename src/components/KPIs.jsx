import { useData } from '../data/DataContext';

export default function KPIs() {
  const { metadata, records } = useData();
  const total = metadata?.total || 0;
  const niveles = metadata?.niveles || {};
  const riesgoAlto = (niveles['Alto'] || 0) + (niveles['Muy Alto'] || 0);
  const pctAlto = total ? Math.round(riesgoAlto / total * 100) : 0;
  const topComuna = metadata?.ranking?.[0];

  return (
    <div className="kpis">
      <div className="kpi">
        <div className="label">Puntos Críticos</div>
        <div className="value">{total.toLocaleString('es-CL')}</div>
        <div className="sub">total nacional</div>
      </div>
      <div className="kpi accent">
        <div className="label">Riesgo Alto o Superior</div>
        <div className="value">{pctAlto}%<span> · {riesgoAlto.toLocaleString('es-CL')}</span></div>
        <div className="sub">{total ? `${Math.round(riesgoAlto/total*100)}% del total` : 'sin datos'}</div>
      </div>
      <div className="kpi">
        <div className="label">Comunas afectadas</div>
        <div className="value">{metadata?.comunas || '—'}</div>
        <div className="sub">en 14 regiones</div>
      </div>
      <div className="kpi">
        <div className="label">Región más crítica</div>
        <div className="value" style={{fontSize:'18px'}}>Metropolitana</div>
        <div className="sub">2.320 puntos</div>
      </div>
      <div className="kpi">
        <div className="label">Comuna top</div>
        <div className="value" style={{fontSize:'17px'}}>{topComuna?.c || '—'}</div>
        <div className="sub">{topComuna ? `${topComuna.n} pts · índice ${topComuna.idx}` : ''}</div>
      </div>
    </div>
  );
}
