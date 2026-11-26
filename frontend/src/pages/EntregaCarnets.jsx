import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Clock3, RotateCcw, Search } from 'lucide-react';
import api from '../utils/api';
import useLiveRefresh from '../hooks/useLiveRefresh';

const formatDate = (value) => {
  if (!value) return '—';
  const datePart = String(value).slice(0, 10);
  const date = new Date(`${datePart}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-BO');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
};

const formatPatientName = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('es-BO')
  .replace(/(^|[\s'-])([\p{L}])/gu, (_match, separator, letter) => separator + letter.toLocaleUpperCase('es-BO'));

const matchesDeliveryDate = (value, filter) => {
  if (filter === 'todas') return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (filter === 'hoy') return day.getTime() === today.getTime();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (filter === 'ayer') return day.getTime() === yesterday.getTime();

  if (filter === 'semana') {
    const mondayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(monday.getDate() - mondayOffset);
    return day >= monday && day <= today;
  }

  return true;
};

export default function EntregaCarnets() {
  const [items, setItems] = useState([]);
  const [resumen, setResumen] = useState({ pendientes: 0, entregados: 0 });
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [filtroFecha, setFiltroFecha] = useState('todas');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setBusquedaAplicada(busqueda.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [busqueda]);

  const fetchEntregas = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.entregasCarnets.list({ estado: filtroEstado, query: busquedaAplicada });
      setItems(data.items || []);
      setResumen(data.resumen || { pendientes: 0, entregados: 0 });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar la bandeja de entrega.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [filtroEstado, busquedaAplicada]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  useLiveRefresh(() => fetchEntregas({ quiet: true }), true, 12000);

  const handleMarkDelivered = async (carnet) => {
    if (!carnet || savingId !== null || carnet.estado_entrega === 'Entregado') return;

    setSavingId(carnet.tramite_id);
    setError('');
    try {
      await api.entregasCarnets.markDelivered(carnet.tramite_id);
      await fetchEntregas({ quiet: true });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo registrar la entrega del carnet.');
    } finally {
      setSavingId(null);
    }
  };

  const handleUndoDelivery = async (carnet) => {
    if (!carnet || savingId !== null || carnet.estado_entrega !== 'Entregado') return;
    const confirmed = window.confirm(`¿Deshacer la entrega del carnet N.º ${carnet.numero_carnet_fisico}? Volverá a Pendientes de entrega.`);
    if (!confirmed) return;

    setSavingId(carnet.tramite_id);
    setError('');
    try {
      await api.entregasCarnets.undoDelivery(carnet.tramite_id);
      await fetchEntregas({ quiet: true });
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo revertir la entrega del carnet.');
    } finally {
      setSavingId(null);
    }
  };

  const itemsVisibles = filtroEstado === 'entregado'
    ? items.filter((carnet) => matchesDeliveryDate(carnet.fecha_entrega, filtroFecha))
    : items;
  const noHayRegistros = itemsVisibles.length === 0 && !loading && !error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Entrega de Carnets</h2>
          <p className="text-xs text-slate-500 mt-1">Registra cuándo se recoge físicamente cada carnet aprobado.</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tablist" aria-label="Estado de entrega">
        <button
          type="button"
          role="tab"
          aria-selected={filtroEstado === 'pendiente'}
          onClick={() => { setFiltroEstado('pendiente'); setFiltroFecha('todas'); }}
          className={`rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${filtroEstado === 'pendiente' ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-slate-200 hover:bg-amber-50/50'}`}
        >
          <div className="flex items-center gap-2 text-amber-800">
            <Clock3 size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">Pendientes de entrega</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{resumen.pendientes}</p>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filtroEstado === 'entregado'}
          onClick={() => setFiltroEstado('entregado')}
          className={`rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${filtroEstado === 'entregado' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-slate-200 hover:bg-emerald-50/50'}`}
        >
          <div className="flex items-center gap-2 text-emerald-800">
            <Check size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">Entregados</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{resumen.entregados}</p>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por carnet, código, paciente o cédula..."
              className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-xs outline-none focus:border-green-600 bg-white"
              aria-label="Buscar carnets"
            />
          </div>
          {filtroEstado === 'entregado' && (
            <select
              value={filtroFecha}
              onChange={(event) => setFiltroFecha(event.target.value)}
              aria-label="Filtrar por fecha de entrega"
              className="sm:w-44 px-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-700 bg-white outline-none focus:border-green-600"
            >
              <option value="todas">Todas las fechas</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="semana">Esta semana</option>
            </select>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {itemsVisibles.length} {itemsVisibles.length === 1 ? 'carnet en esta vista' : 'carnets en esta vista'}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : noHayRegistros ? (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          {filtroEstado === 'pendiente' ? <Clock3 size={36} className="text-slate-300 mb-2" /> : <Check size={36} className="text-slate-300 mb-2" />}
          <p className="text-xs font-bold text-slate-600">
            {busquedaAplicada
              ? 'No se encontraron carnets con esos datos.'
              : filtroEstado === 'pendiente'
                ? 'No hay carnets pendientes de entrega.'
                : filtroFecha !== 'todas'
                  ? 'No hay entregas en el período seleccionado.'
                  : 'Todavía no se registraron entregas.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className={`w-full text-left text-xs ${filtroEstado === 'entregado' ? 'min-w-[1080px]' : 'min-w-[960px]'}`}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 whitespace-nowrap">N.º carnet físico</th>
                <th className="py-3.5 px-4">Paciente</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Cédula</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Fechas</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Estado</th>
                {filtroEstado === 'entregado' && <th className="py-3.5 px-4 whitespace-nowrap">Registro de entrega</th>}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{filtroEstado === 'entregado' ? 'Acciones' : 'Acción'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {itemsVisibles.map((carnet) => {
                const entregado = carnet.estado_entrega === 'Entregado';
                return (
                  <tr key={carnet.tramite_id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                      <div className="font-mono font-bold text-blue-700">N.º {carnet.numero_carnet_fisico || '—'}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-1">Código: {carnet.codigo_carnet || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 capitalize">{formatPatientName(`${carnet.nombres} ${carnet.apellidos}`)}</div>
                      {carnet.telefono && <div className="text-[10px] text-slate-500 mt-1 tabular-nums">Tel. {carnet.telefono}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap">{carnet.ci} {carnet.ci_exp}</td>
                    <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                      <div className="font-semibold text-slate-800">{formatDate(carnet.fecha_emision)}</div>
                      <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-500">Vence: {formatDate(carnet.fecha_vencimiento)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-bold ${entregado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {carnet.estado_entrega}
                      </span>
                    </td>
                    {filtroEstado === 'entregado' && <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                      {entregado ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-700">{formatDateTime(carnet.fecha_entrega)}</div>
                          <div className="text-[10px] text-slate-500">Por: {carnet.entregado_por_nombre || 'Usuario del sistema'}</div>
                        </div>
                      ) : '—'}
                    </td>}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {entregado ? (
                        <button
                          type="button"
                          onClick={() => handleUndoDelivery(carnet)}
                          disabled={savingId !== null}
                          title="Deshacer la entrega si se registró por error"
                          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold text-[10px] disabled:opacity-50 whitespace-nowrap"
                        >
                          <RotateCcw size={12} />
                          {savingId === carnet.tramite_id ? 'Revirtiendo...' : 'Deshacer'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkDelivered(carnet)}
                          disabled={savingId !== null}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check size={12} />
                          {savingId === carnet.tramite_id ? 'Registrando...' : 'Marcar entregado'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
