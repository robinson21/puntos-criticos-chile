import { useEffect, useState } from 'react';
import { DataProvider, useData } from './data/DataContext';
import { FilterProvider } from './data/FilterContext';
import KPIs from './components/KPIs';
import Filters from './components/Filters';
import MapView from './components/MapView';
import Ranking from './components/Ranking';
import Charts from './components/Charts';
import Insights from './components/Insights';
import Alertas from './components/Alertas';
import PronosticoRegional from './components/PronosticoRegional';
import AlertasRegion from './components/AlertasRegion';
import EstacionesExpuestas from './components/EstacionesExpuestas';
import { EstacionesProvider } from './data/EstacionesContext';

// Estado global de tema (claro por defecto como pidió el usuario).
// Se guarda en localStorage y se aplica al <html data-theme="light|dark">.
const TEMA_KEY = 'pc-tema';
function temaInicial() {
  try {
    return localStorage.getItem(TEMA_KEY) || 'light';
  } catch (e) {
    return 'light';
  }
}

function ThemeToggle() {
  const [tema, setTema] = useState(temaInicial);
  // `setTema` con un updater inline: al montar, asegura estado coherente.
  // Aplica el atributo data-theme en el <html> cada vez que cambia el tema.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  const cambiar = () => {
    const nuevo = tema === 'light' ? 'dark' : 'light';
    setTema(nuevo);
    try { localStorage.setItem(TEMA_KEY, nuevo); } catch (e) { /* noop */ }
  };

  return (
    <button
      className="theme-toggle"
      onClick={cambiar}
      title={tema === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label="Cambiar tema claro/oscuro"
    >
      {tema === 'light' ? '🌙' : '☀️'}
      <span className="theme-label">{tema === 'light' ? 'Oscuro' : 'Claro'}</span>
    </button>
  );
}

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
      <EstacionesProvider>
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
            <ThemeToggle />
          </div>
        </header>

        <Filters />

        {/* MOSTRAR SELECCIÓN / FILTROS Y LUEGO EL MAPA COMO PROTAGONISTA */}
        {loadingRegion && <div className="loading-bar">Cargando datos regionales...</div>}

        {/* ===== MAPA PROTAGONISTA (ancho completo, arriba) ===== */}
        {hasRegion && <AlertasRegion />}
        {hasRegion ? (
          <MapView />
        ) : (
          <div className="empty-state">
            <p>Selecciona una región para ver el mapa de puntos críticos detallado</p>
            <p className="sub">Elige una región arriba para explorar el mapa, ranking y pronóstico</p>
          </div>
        )}

        {/* Cruce de estaciones de servicio con puntos críticos, alertas DMC e incendios */}
        {hasRegion && <EstacionesExpuestas />}

        {/* Ranking desplegable (plegado por defecto): solo ocupa espacio al abrirlo */}
        {hasRegion && <Ranking />}

        {/* Pronóstico del clima: AHORA va después del mapa para no empujarlo hacia abajo */}
        <PronosticoRegional />

        <KPIs />
        <Charts />
        <Insights />
        <Alertas />

        <footer>
          <span>Puntos Críticos Chile · GesstIA</span>
          <span>Datos: SENAPRED</span>
          <span>v1.0 — {new Date().getFullYear()}</span>
        </footer>
      </div>
      </EstacionesProvider>
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
