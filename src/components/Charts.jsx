import { useData } from '../data/DataContext';
import { useFilters } from '../data/FilterContext';

export default function Charts() {
  const { metadata, records } = useData();
  const { filtered } = useFilters();

  // Si hay región seleccionada, usar filtered (datos regionales)
  // Si no, usar metadata global
  const mostrar = filtered.length > 0 ? filtered : null;
  const causas = {};
  const niveles = {};
  const tipos = {};

  if (mostrar) {
    mostrar.forEach(r => {
      causas[r.cs] = (causas[r.cs] || 0) + 1;
      niveles[r.lv] = (niveles[r.lv] || 0) + 1;
      tipos[r.tp] = (tipos[r.tp] || 0) + 1;
    });
  } else if (metadata) {
    Object.assign(causas, metadata.causas);
    Object.assign(niveles, metadata.niveles);
    Object.assign(tipos, metadata.tipos);
  }

  const total = mostrar ? mostrar.length : (metadata?.total || 1);
  const colors = {'Bajo':'#4FB6A8','Medio':'#E0B84D','Alto':'#E08D45','Muy Alto':'#D5514A'};

  const renderBar = ([c, n]) => {
    const pct = Math.round(n / total * 100);
    return (
      <div key={c} className="chart-bar-row">
        <div className="chart-label" title={c}>{c}</div>
        <div className="chart-track"><div className="chart-fill" style={{width:`${pct}%`,background:'#D5514A'}}></div></div>
        <div className="chart-pct">{pct}%</div>
      </div>
    );
  };

  return (
    <div className="charts">
      <div className="chart-box">
        <h3>Por Causa</h3>
        <div className="chart-list">
          {Object.entries(causas).sort((a,b)=>b[1]-a[1]).slice(0,8).map(renderBar)}
        </div>
      </div>
      <div className="chart-box">
        <h3>Nivel de Riesgo</h3>
        <div className="chart-list">
          {['Bajo','Medio','Alto','Muy Alto'].filter(n => niveles[n]).map(n => {
            const v = niveles[n];
            const pct = Math.round(v / total * 100);
            return (
              <div key={n} className="chart-bar-row">
                <div className="chart-label">{n}</div>
                <div className="chart-track"><div className="chart-fill" style={{width:`${pct}%`,background:colors[n]||'#5D7284'}}></div></div>
                <div className="chart-pct">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chart-box">
        <h3>Tipo de Solución</h3>
        <div className="chart-list">
          {Object.entries(tipos).sort((a,b)=>b[1]-a[1]).map(renderBar)}
        </div>
      </div>
    </div>
  );
}
