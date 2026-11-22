import React, { useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';

export default function AdvancedQueueFilters({
  items,
  filters,
  setFilters,
  resultCount,
  areaLabel,
  onRefresh,
  accent = 'blue',
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const options = useMemo(() => ({
    tipos: [...new Set(items.map((item) => item.tipo_tramite).filter(Boolean))].sort(),
    ocupaciones: [...new Set(items.map((item) => item.ocupacion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    mercados: [...new Set(items.map((item) => item.mercado).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
  }), [items]);

  const activeAdvanced = Boolean(filters.tipo || filters.ocupacion || filters.mercado || filters.desde || filters.hasta);
  const controlClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500';
  const activeText = accent === 'emerald' ? 'text-emerald-700' : 'text-blue-700';

  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clear = () => setFilters({ query: '', tipo: '', ocupacion: '', mercado: '', desde: '', hasta: '' });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder={`Buscar ${areaLabel} por nombre, C.I., kardex, teléfono o rubro...`}
            aria-label={`Buscar en ${areaLabel}`}
            className={`${controlClass} pl-10 pr-9`}
          />
          {filters.query && (
            <button type="button" onClick={() => update('query', '')} aria-label="Limpiar texto de búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="whitespace-nowrap px-1 text-xs font-semibold text-slate-500">
            {resultCount} {resultCount === 1 ? 'paciente en espera' : 'pacientes en espera'}
          </span>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${activeAdvanced ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            <SlidersHorizontal size={14} />
            Filtros
            {activeAdvanced && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
          </button>
          <button type="button" onClick={onRefresh} aria-label="Actualizar bandeja" title="Actualizar bandeja" className={`rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 ${activeText}`}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-[11px] font-semibold text-slate-500">
            Tipo de trámite
            <select value={filters.tipo} onChange={(event) => update('tipo', event.target.value)} className={controlClass}>
              <option value="">Todos</option>
              {options.tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-500">
            Ocupación / rubro
            <select value={filters.ocupacion} onChange={(event) => update('ocupacion', event.target.value)} className={controlClass}>
              <option value="">Todos</option>
              {options.ocupaciones.map((ocupacion) => <option key={ocupacion} value={ocupacion}>{ocupacion}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-500">
            Mercado
            <select value={filters.mercado} onChange={(event) => update('mercado', event.target.value)} className={controlClass}>
              <option value="">Todos</option>
              {options.mercados.map((mercado) => <option key={mercado} value={mercado}>{mercado}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Desde</span>
            <input type="date" value={filters.desde} onChange={(event) => update('desde', event.target.value)} className={controlClass} />
          </label>
          <label className="space-y-1 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Hasta</span>
            <input type="date" value={filters.hasta} onChange={(event) => update('hasta', event.target.value)} className={controlClass} />
          </label>
          {activeAdvanced && (
            <button type="button" onClick={clear} className="text-left text-xs font-semibold text-slate-500 hover:text-slate-800 sm:col-span-2 xl:col-span-5">
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}
