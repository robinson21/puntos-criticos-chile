import { useFilters } from '../data/FilterContext';

export default function Ranking() {
  const { ranking } = useFilters();

  return (
    <div className="panel ranking-panel">
      <div className="panel-head">
        <h2>Ranking · Complejidad</h2>
        <span className="count">{ranking.length} comunas</span>
      </div>
      <div className="rank-list">
        {ranking.slice(0, 50).map((r, i) => (
          <div key={r.c} className={`rank-row ${i < 3 ? 'top' : ''}`}>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-info">
              <div className="rank-name">{r.c}</div>
              <div className="rank-region">{r.region}</div>
              <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{ width: `${r.idx}%` }}></div>
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
