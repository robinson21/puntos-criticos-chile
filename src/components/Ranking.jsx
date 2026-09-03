import { useState } from 'react';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FilterContext';

export default function Ranking() {
  const { metadata } = useData();
  const { filtered } = useFilters();
  const [open, setOpen] = useState(false); // plegado por defecto: solo ocupa espacio al abrirlo

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
  const top = ranking.slice(0, 50);

  return (
    <section className={`panel ranking-panel ${open ? 'open' : 'closed'}`}>
      <button
        className="rank-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Ocultar ranking de complejidad' : 'Mostrar ranking de complejidad'}
      >
        <span className="rank-toggle-title">
          🏆 Ranking · Complejidad
          <small className="rank-toggle-count">Top {Math.min(50, ranking.length)}</small>
        </span>
        <span className={`rank-chevron ${open ? 'up' : ''}`}>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="rank-list">
          {top.map((r, i) => (
            <div key={r.c} className={`rank-row ${i < 3 ? 'top' : ''}`}>
              <div className="rank-num">{i + 1}</div>
              <div className="rank-info">
                <div className="rank-name">{r.c}</div>
                <div className="rank-region">{r.region || r.r}</div>
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
      )}
    </section>
  );
}
