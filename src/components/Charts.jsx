import { useFilters } from '../data/FilterContext';

export default function Charts() {
  const { filtered } = useFilters();

  // Compute stats
  const causas = {};
  const niveles = {};
  const tipos = {};
  filtered.forEach(r => {
    causas[r.causa] = (causas[r.causa] || 0) + 1;
    niveles[r.nivel] = (niveles[r.nivel] || 0) + 1;
    tipos[r.tipo] = (tipos[r.tipo] || 0) + 1;
  });

  return (
    <div className="charts">
      <div className="chart-box">
        <h3>Por Causa</h3>
        <div className="chart-list">
          {Object.entries(causas)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([c, n]) => {
              const pct = Math.round(n / filtered.length * 100);
              return (
                <div key={c} className="chart-bar-row">
                  <div className="chart-label">{c}</div>
                  <div className="chart-track">
                    <div className="chart-fill" style={{ width: `${pct}%`, background: '#D5514A' }}></div>
                  </div>
                  <div className="chart-pct">{pct}%</div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="chart-box">
        <h3>Nivel de Riesgo</h3>
        <div className="chart-list">
          {Object.entries(niveles)
            .sort((a, b) => b[1] - a[1])
            .map(([n, v]) => {
              const pct = Math.round(v / filtered.length * 100);
              const colors = { 'Bajo': '#4FB6A8', 'Medio': '#E0B84D', 'Alto': '#E08D45', 'Muy Alto': '#D5514A' };
              return (
                <div key={n} className="chart-bar-row">
                  <div className="chart-label">{n}</div>
                  <div className="chart-track">
                    <div className="chart-fill" style={{ width: `${pct}%`, background: colors[n] || '#5D7284' }}></div>
                  </div>
                  <div className="chart-pct">{pct}%</div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="chart-box">
        <h3>Tipo de Solución</h3>
        <div className="chart-list">
          {Object.entries(tipos)
            .sort((a, b) => b[1] - a[1])
            .map(([t, v]) => {
              const pct = Math.round(v / filtered.length * 100);
              return (
                <div key={t} className="chart-bar-row">
                  <div className="chart-label">{t}</div>
                  <div className="chart-track">
                    <div className="chart-fill" style={{ width: `${pct}%`, background: '#8E6BB8' }}></div>
                  </div>
                  <div className="chart-pct">{pct}%</div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
