import { createContext, useContext, useMemo, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children, records }) {
  const [comuna, setComuna] = useState('');
  const [causa, setCausa] = useState('');
  const [nivel, setNivel] = useState('');
  const [tipoSolucion, setTipoSolucion] = useState('');

  const filtered = useMemo(() => {
    if (!records.length) return [];
    return records.filter(r =>
      !(comuna && r.c !== comuna) &&
      !(causa && r.cs !== causa) &&
      !(nivel && r.lv !== nivel) &&
      !(tipoSolucion && r.tp !== tipoSolucion)
    );
  }, [records, comuna, causa, nivel, tipoSolucion]);

  const comunas = useMemo(() => [...new Set(records.map(r => r.c))].sort(), [records]);
  const causas = useMemo(() => [...new Set(records.map(r => r.cs))].sort(), [records]);

  const value = {
    comuna, setComuna,
    causa, setCausa,
    nivel, setNivel,
    tipoSolucion, setTipoSolucion,
    filtered,
    comunas,
    causas,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be inside FilterProvider');
  return ctx;
}
