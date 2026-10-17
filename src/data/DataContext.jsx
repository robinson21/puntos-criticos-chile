import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { leerUrl } from './url';
import { REGION_SLUGS } from './regiones';

const DataContext = createContext(null);

export { REGION_SLUGS };

export function DataProvider({ children }) {
  const [metadata, setMetadata] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRegion, setLoadingRegion] = useState(null);
  const [error, setError] = useState(null);
  const [regionActual, setRegionActual] = useState('');
  // Caché en memoria: cada región se descarga una sola vez por sesión.
  const cache = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('./data/meta.json');
        if (!res.ok) throw new Error('meta.json no encontrado');
        setMetadata(await res.json());
      } catch (e) {
        setError('Error cargando metadata: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Región pedida en la URL (?region=slug): se carga apenas existe el callback.
  const regionUrl = useRef(leerUrl().region);

  const loadRegion = useCallback(async (region) => {
    if (!region) {
      setRecords([]);
      setRegionActual('');
      return;
    }
    setRegionActual(region);
    if (cache.current[region]) {
      setRecords(cache.current[region]);
      return;
    }
    setLoadingRegion(region);
    try {
      const slug = REGION_SLUGS[region];
      if (!slug) {
        cache.current[region] = [];
        setRecords([]);
        setError('');
        setLoadingRegion(null);
        return;
      }
      const res = await fetch(`./data/${slug}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      cache.current[region] = data;
      setRecords(data);
    } catch (e) {
      setError(`Error cargando ${region}: ${e.message}`);
    }
    setLoadingRegion(null);
  }, []);

  useEffect(() => {
    if (regionUrl.current) {
      loadRegion(regionUrl.current);
      regionUrl.current = '';
    }
  }, [loadRegion]);

  return (
    <DataContext.Provider
      value={{
        records,
        metadata,
        loading,
        loadingRegion,
        error,
        loadRegion,
        regionActual,
        setRegionActual,
        hasRegion: records.length > 0,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}
