import { useData } from '../data/DataContext';
import { resumen, tituloRegion } from '../data/stats';

// Lista "A, B y C"
const enumerar = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');

export default function Insights() {
  const { metadata } = useData();
  if (!metadata) return null;
  const s = resumen(metadata);
  const topRegiones = s.regiones.slice(0, 3).map(([r]) => tituloRegion(r));

  return (
    <div className="insights">
      <div className="insight">
        <h3>⚠️ Riesgo Alto o Muy Alto</h3>
        <p>
          El <b>{s.pctAlto}% de los puntos críticos</b> ({s.fmt(s.riesgoAlto)}) tienen nivel de riesgo Alto o Muy Alto.
          {topRegiones.length > 0 && (
            <> Las regiones {enumerar(topRegiones)} concentran la mayor cantidad de puntos,
            lo que exige priorizar recursos en esas zonas.</>
          )}
        </p>
      </div>
      <div className="insight">
        <h3>🏗️ Tipo de solución</h3>
        <p>
          De los puntos con solución definida, el <b>{s.pct(s.infra, s.conTipo)}% requiere obras de infraestructura</b> (defensas
          fluviales, colectores, muros de contención) y el {s.pct(s.mant, s.conTipo)}% mantención preventiva.
          Ojo: el <b>{s.pct(s.sinTipo, s.total)}% de los puntos ({s.fmt(s.sinTipo)}) no tiene tipo de solución</b> informado por SENAPRED.
        </p>
      </div>
      <div className="insight">
        <h3>🌊 Causas predominantes</h3>
        <p>
          Las tres causas más frecuentes son{' '}
          {s.top3Causas.map(([c, n], i) => (
            <span key={c}>
              {i > 0 && (i === s.top3Causas.length - 1 ? ' y ' : ', ')}
              <b>{c.toLowerCase()}</b> ({s.fmt(n)})
            </span>
          ))}
          , que suman el <b>{s.pct(s.top3CausasN, s.total)}%</b> de los puntos reportados.
        </p>
      </div>
    </div>
  );
}
