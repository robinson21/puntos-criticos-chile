import { useState } from 'react';
import { DataProvider, useData } from './data/DataContext';
import { FilterProvider } from './data/FilterContext';
import KPIs from './components/KPIs';
import Filters from './components/Filters';
import MapView from './components/MapView';
import Ranking from './components/Ranking';
import Charts from './components/Charts';
import Insights from './components/Insights';
import Alertas from './components/Alertas';

function Dashboard() {
  const { records, metadata, loading, loadingRegion, error, hasRegion } = useData();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="loading-screen">
        <div className="errbox">
          <strong>Error</strong><br />No se pudieron cargar los datos
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
              {metadata
                ? `Diagnóstico nacional de los ${metadata.total.toLocaleString('es-CL')} puntos críticos reportados a SENAPRED. Selecciona una región para explorar sus datos.`
                : 'Cargando metadata...'}
            </p>
          </div>
          <div className="meta">
            <div><b>Fuente:</b> SENAPRED</div>
            {metadata && <div><b>Datos:</b> {metadata.total.toLocaleString('es-CL')} · {metadata.comunas} comunas</div>}
          </div>
        </header>

        <KPIs />
        <Filters />
        {loadingRegion && <div className="loading-bar">Cargando datos regionales...</div>}
        {hasRegion ? (
          <div className="grid">
            <MapView />
            <Ranking />
          </div>
        ) : (
          <div className="empty-state">
            <p>Selecciona una región para ver el mapa y ranking detallado</p>
            <p className="sub">Los datos globales (KPI, causas, soluciones) se muestran abajo sin necesidad de descargar nada</p>
          </div>
        )}
        <Charts />
        <Insights />
        <Alertas />

        <footer>
          <span>Puntos Críticos Chile · GesstIA</span>
          <span>Datos: SENAPRED</span>
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
