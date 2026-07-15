import { DataProvider, useData } from './data/DataContext';
import { FilterProvider } from './data/FilterContext';
import KPIs from './components/KPIs';
import Filters from './components/Filters';
import MapView from './components/MapView';
import Ranking from './components/Ranking';
import Charts from './components/Charts';
import Insights from './components/Insights';

function Dashboard() {
  const { records, loading, error } = useData();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando datos SENAPRED...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <div className="errbox">
          <strong>Error al cargar datos</strong><br />
          {error}<br /><br />
          <small>Verifica que el archivo de datos esté en la carpeta correcta.</small>
        </div>
      </div>
    );
  }

  return (
    <FilterProvider records={records}>
      <div className="wrap">
        <header>
          <div>
            <p className="eyebrow">🇨🇱 Chile · Temporada Invierno 2026</p>
            <h1>Puntos Críticos <em>Chile</em></h1>
            <p className="subtitle">
              Diagnóstico nacional de los {records.length.toLocaleString('es-CL')} puntos críticos
              reportados a SENAPRED frente a precipitaciones — causas, niveles de riesgo
              y soluciones propuestas por región y comuna.
            </p>
          </div>
          <div className="meta">
            <div><b>Fuente:</b> Datos oficiales SENAPRED</div>
            <div><b>Datos:</b> {records.length.toLocaleString('es-CL')} registros · 14 regiones</div>
          </div>
        </header>

        <KPIs />
        <Filters />

        <div className="grid">
          <MapView />
          <Ranking />
        </div>

        <Charts />
        <Insights />

        <footer>
          <span>Puntos Críticos Chile · GesstIA</span>
          <span>Datos: SENAPRED · Diseño: GesstIA</span>
          <span>v1.0 — {new Date().getFullYear()}</span>
        </footer>
      </div>
    </FilterProvider>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Dashboard />
    </DataProvider>
  );
}
