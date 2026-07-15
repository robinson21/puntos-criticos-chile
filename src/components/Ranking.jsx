import { useData } from '../data/DataContext';
import { useFilters } from '../data/FilterContext';

export default function Ranking() {
  const { metadata } = useData();
  const { filtered } = useFilters();

  // Si hay datos regionales cargados, ranking regional
  // Si no, ranking global desde metadata
  const ranking = filtered.length > 0
    ? (() => {
        const comMap = {};
        filtered.forEach(r => {
          if (!comMap[r.c]) comMap[r.c] = { n: 0, region: r.r || '' };
          comMap[r.c].n++;
        });
        return Object.entries(comMap)
          .map(([c, v]) => ({ c, n: v.n, region: v.region, idx: Math.min(100, Math.round(v.n / 4.21)) }))
          .sort((a, b) => b.idx - a.idx);
      })()
    : (metadata?.ranking || []);

  if (!ranking.length) return null;

  return (
    <div className="panel ranking-panel">
      <div className="panel-head">
        <h2>Ranking · Complejidad</h2>
        <span className="count">Top {Math.min(50, ranking.length)}</span>
      </div>
      <div className="rank-list">
        {ranking.slice(0, 50).map((r, i) => (
          <div key={r.c} className={`rank-row ${i < 3 ? 'top' : ''}`}>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-info">
              <div className="rank-name">{r.c}</div>
              <div className="rank-region">{r.region || r.r}</div>
              <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{width:`${r.idx}%`}}></div>
              </div>
            </div>
            <div className="rank-score">
              {r.idx}
              <div className="rank-sub">{r.n} pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
