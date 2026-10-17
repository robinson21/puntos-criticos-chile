import { useCallback, useEffect, useMemo, useState } from 'react';
import { horaChile } from '../data/gibs';

const PASO_MS = 650;
const PAUSA_FINAL_MS = 2200;

// Estado de la línea de tiempo compartida por las capas animadas (lluvia NASA, radar, nubes).
// `cuadros` = { idCapa: [iso…] | { error } | null }. Devuelve el tiempo actual (ms) y los controles.
export function useLineaTiempo(cuadros) {
  const tiempos = useMemo(() => {
    const todos = Object.values(cuadros).filter(Array.isArray).flat().map(t => Date.parse(t));
    return [...new Set(todos)].sort((a, b) => a - b);
  }, [cuadros]);
  const [idx, setIdx] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(true);

  // Al llegar cuadros nuevos se parte en el más reciente
  useEffect(() => { setIdx(tiempos.length - 1); }, [tiempos]);

  useEffect(() => {
    if (!reproduciendo || tiempos.length < 2 || idx < 0) return;
    const t = setTimeout(() => setIdx(i => (i + 1) % tiempos.length), idx === tiempos.length - 1 ? PAUSA_FINAL_MS : PASO_MS);
    return () => clearTimeout(t);
  }, [reproduciendo, idx, tiempos]);

  const ir = useCallback(i => { setReproduciendo(false); setIdx(Math.max(0, Math.min(tiempos.length - 1, i))); }, [tiempos]);
  return { tiempos, idx, tiempo: tiempos[idx] ?? null, reproduciendo, setReproduciendo, ir };
}

function relativo(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return `hace ${h} h${m >= 10 ? ` ${m} min` : ''}`;
}
const diaChile = ms => {
  const f = d => new Date(d).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' });
  return f(ms) === f(Date.now()) ? 'Hoy' : f(ms) === f(Date.now() - 864e5) ? 'Ayer' : new Date(ms).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', timeZone: 'America/Santiago' });
};

// Barra estilo Zoom Earth: play/pausa, hora del cuadro, deslizador con los tramos de cada capa y escala de lluvia.
export default function LineaTiempo({ linea, capas, mostrarEscala }) {
  const { tiempos, idx, tiempo, reproduciendo, setReproduciendo, ir } = linea;
  if (!tiempos.length) {
    const errores = capas.filter(c => c.cuadros?.error);
    return errores.length ? <div className="linea-tiempo vacia">{errores.map(c => `${c.icono} ${c.nombre}: no disponible`).join(' · ')}</div> : null;
  }
  const t0 = tiempos[0], t1 = tiempos[tiempos.length - 1];
  const pos = ms => (t1 === t0 ? 100 : ((ms - t0) / (t1 - t0)) * 100);

  return (
    <div className="linea-tiempo" onMouseDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
      <div className="lt-fila">
        <button type="button" className="lt-play" onClick={() => setReproduciendo(r => !r)} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}>
          {reproduciendo ? '❚❚' : '▶'}
        </button>
        <div className="lt-hora">
          <b>{diaChile(tiempo)} {horaChile(new Date(tiempo).toISOString())}</b>
          <span>{relativo(tiempo)}</span>
        </div>
        <div className="lt-capas">
          {capas.filter(c => Array.isArray(c.cuadros)).map(c => {
            const propios = c.cuadros.map(Date.parse);
            const mostrado = [...propios].reverse().find(ms => ms <= tiempo);
            return (
              <span key={c.id} className={`lt-chip ${mostrado ? '' : 'apagado'}`} style={{ '--c': c.color }}
                title={mostrado ? `${c.nombre}: imagen de las ${horaChile(new Date(mostrado).toISOString())}` : `${c.nombre}: sin imagen para esta hora`}>
                {c.icono} {c.nombre}{mostrado && mostrado !== tiempo ? ` · ${horaChile(new Date(mostrado).toISOString())}` : ''}
              </span>
            );
          })}
        </div>
      </div>

      <div className="lt-pista">
        {capas.filter(c => Array.isArray(c.cuadros) && c.cuadros.length).map((c, i) => {
          const a = Date.parse(c.cuadros[0]), b = Date.parse(c.cuadros[c.cuadros.length - 1]);
          return <div key={c.id} className="lt-tramo" title={c.nombre}
            style={{ left: `${pos(a)}%`, width: `${Math.max(1.5, pos(b) - pos(a))}%`, background: c.color, top: `${2 + i * 5}px` }} />;
        })}
        {tiempos.map((ms, i) => (
          <button type="button" key={ms} className={`lt-marca ${i === idx ? 'actual' : ''}`} style={{ left: `${pos(ms)}%` }}
            onClick={() => ir(i)} aria-label={`Ir a las ${horaChile(new Date(ms).toISOString())}`} />
        ))}
        <input type="range" min={0} max={tiempos.length - 1} step={1} value={Math.max(0, idx)} onChange={e => ir(Number(e.target.value))}
          aria-label="Hora de la animación" />
      </div>
      <div className="lt-extremos">
        <span>{horaChile(new Date(t0).toISOString())}</span>
        <span>{horaChile(new Date(t1).toISOString())}</span>
      </div>

      {mostrarEscala && (
        <div className="lt-escala" title="Intensidad de lluvia (escala de NASA IMERG; el radar usa una paleta similar)">
          <span className="lt-unidad">mm/h</span>
          <div className="lt-gradiente lluvia" />
          <div className="lt-valores"><span>0,1</span><span>1</span><span>2</span><span>5</span><span>10</span><span>25</span><span>50+</span></div>
          <span className="lt-nieve" title="La lluvia NASA muestra la nieve en tonos azul a morado"><i /> nieve</span>
        </div>
      )}
    </div>
  );
}
