import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Search, Users, Eye, History, PlusCircle, AlertCircle, Calendar, ArrowLeft, Printer, 
  Edit3, Settings2, X, RefreshCw, AlertTriangle, CheckCircle2, Clock, Check
} from 'lucide-react';
import CarnetTemplate from '../components/CarnetTemplate';

export default function PacientesLista({ onNavigate, setSharedData }) {
  const [query, setQuery] = useState('');
  const [mercado, setMercado] = useState('');
  const [ocupacion, setOcupacion] = useState('');
  const [filtroTab, setFiltroTab] = useState('todos'); // 'todos' | 'vencidos' | 'vigentes' | 'en_tramite'
  
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Detalles de un paciente seleccionado
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Impresión de Carnet desde el expediente
  const [carnetToPrint, setCarnetToPrint] = useState(null);
  const [printSize, setPrintSize] = useState('standard');

  // Modal de Renovación de Carnet
  const [renovacionPaciente, setRenovacionPaciente] = useState(null);
  const [renovacionKardex, setRenovacionKardex] = useState('');
  const [renovacionCosto, setRenovacionCosto] = useState('30.00');
  const [submittingRenovacion, setSubmittingRenovacion] = useState(false);

  const fetchPacientes = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.pacientes.list({ query, mercado, ocupacion });
      setPacientes(data);
    } catch (err) {
      console.error(err);
      setError('Error al buscar pacientes en el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacientes();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPacientes();
  };

  const handleClearFilters = () => {
    setQuery('');
    setMercado('');
    setOcupacion('');
    setFiltroTab('todos');
    setLoading(true);
    api.pacientes.list({})
      .then(data => setPacientes(data))
      .catch(err => setError('Error al recargar pacientes.'))
      .finally(() => setLoading(false));
  };

  const handleViewDetails = async (paciente) => {
    setSelectedPaciente(paciente);
    setLoadingHistory(true);
    setError('');
    try {
      const res = await api.pacientes.get(paciente.id);
      setHistorial(res.historial);
    } catch (err) {
      console.error(err);
      setError('Error al obtener el historial médico del paciente.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Apertura del modal de renovación
  const handleOpenRenovacion = (paciente) => {
    setRenovacionPaciente(paciente);
    setRenovacionKardex('');
    setRenovacionCosto('30.00');
    setError('');
  };

  // Confirmar inicio de renovación
  const handleConfirmRenovacion = async (e) => {
    e.preventDefault();
    if (!renovacionPaciente) return;

    if (renovacionKardex) {
      const trimmed = renovacionKardex.trim();
      if (trimmed.startsWith('-') || /^-\d+$/.test(trimmed)) {
        setError('El número de carnet físico no puede ser un número negativo.');
        return;
      }
    }

    setSubmittingRenovacion(true);
    setError('');
    setSuccess('');

    try {
      await api.pacientes.openTramite(renovacionPaciente.id, {
        tipo_tramite: 'Renovación',
        costo_bs: parseFloat(renovacionCosto) || 30.00,
        numero_carnet_fisico: renovacionKardex.trim().toUpperCase() || null
      });

      const pacNombre = `${renovacionPaciente.nombres} ${renovacionPaciente.apellidos}`;
      setRenovacionPaciente(null);

      // Si estábamos viendo los detalles de este paciente, recargarlos
      if (selectedPaciente && selectedPaciente.id === renovacionPaciente.id) {
        handleViewDetails(selectedPaciente);
      }

      // Recargar lista general
      await fetchPacientes();

      setSuccess(`¡Trámite de Renovación iniciado con éxito para ${pacNombre}! Ha sido derivado a la bandeja de Laboratorio.`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al iniciar la renovación del carnet.');
    } finally {
      setSubmittingRenovacion(false);
    }
  };

  // Helper para calcular el estado de vigencia y expiración del carnet
  const getEstadoCarnetInfo = (paciente) => {
    if (!paciente) return { estado: 'desconocido', badge: null, isVencido: false, canRenovar: false };

    // 1. Trámite activo en laboratorio o medicina
    if (paciente.estado === 'Pendiente Laboratorio') {
      return {
        estado: 'en_tramite',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-semibold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            EN LABORATORIO
          </span>
        ),
        isVencido: false,
        canRenovar: false,
        motivoNoRenovar: 'El paciente ya tiene un trámite activo en Laboratorio.'
      };
    }
    if (paciente.estado === 'Pendiente Medicina') {
      return {
        estado: 'en_tramite',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-300 rounded-lg font-semibold text-[11px]">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            EN ÁREA MÉDICA
          </span>
        ),
        isVencido: false,
        canRenovar: false,
        motivoNoRenovar: 'El paciente ya tiene un trámite activo en Consulta Médica.'
      };
    }

    // 2. Fecha de vencimiento
    const fechaVenc = paciente.fecha_vencimiento || paciente.ultima_fecha_vencimiento;
    if (!fechaVenc) {
      return {
        estado: 'sin_carnet',
        badge: (
          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[11px] font-medium">
            Sin carnet previo
          </span>
        ),
        isVencido: false,
        canRenovar: true
      };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaVenc);
    venc.setHours(0, 0, 0, 0);
    const diffTime = venc.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const diasVencido = Math.abs(diffDays);
      return {
        estado: 'vencido',
        badge: (
          <span className="inline-flex flex-col items-start gap-0.5 px-2.5 py-1 bg-red-100/90 text-red-800 border border-red-300 rounded-lg text-[11px] font-bold shadow-2xs">
            <span className="flex items-center gap-1 text-red-900">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block"></span>
              🔴 VENCIDO
            </span>
            <span className="text-[10px] text-red-700 font-normal">
              El {venc.toLocaleDateString('es-ES')} ({diasVencido} d. atrás)
            </span>
          </span>
        ),
        isVencido: true,
        canRenovar: true,
        fechaVenc: venc.toLocaleDateString('es-ES'),
        diasVencido
      };
    } else if (diffDays <= 30) {
      return {
        estado: 'por_vencer',
        badge: (
          <span className="inline-flex flex-col items-start gap-0.5 px-2.5 py-1 bg-amber-100/80 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold">
            <span className="flex items-center gap-1 text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
              🟡 POR VENCER
            </span>
            <span className="text-[10px] text-amber-800 font-normal">
              El {venc.toLocaleDateString('es-ES')} (en {diffDays} d.)
            </span>
          </span>
        ),
        isVencido: false,
        canRenovar: true,
        fechaVenc: venc.toLocaleDateString('es-ES'),
        diffDays
      };
    } else {
      return {
        estado: 'vigente',
        badge: (
          <span className="inline-flex flex-col items-start gap-0.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold">
            <span className="flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              🟢 VIGENTE
            </span>
            <span className="text-[10px] text-emerald-700">
              Hasta el {venc.toLocaleDateString('es-ES')}
            </span>
          </span>
        ),
        isVencido: false,
        canRenovar: true,
        fechaVenc: venc.toLocaleDateString('es-ES')
      };
    }
  };

  // Conteo dinámico para pestañas
  const totalVencidos = pacientes.filter(p => getEstadoCarnetInfo(p).isVencido).length;
  const totalVigentes = pacientes.filter(p => {
    const s = getEstadoCarnetInfo(p).estado;
    return s === 'vigente' || s === 'por_vencer';
  }).length;
  const totalEnTramite = pacientes.filter(p => getEstadoCarnetInfo(p).estado === 'en_tramite').length;

  const pacientesFiltrados = pacientes.filter(p => {
    const info = getEstadoCarnetInfo(p);
    if (filtroTab === 'vencidos') return info.isVencido;
    if (filtroTab === 'vigentes') return info.estado === 'vigente' || info.estado === 'por_vencer';
    if (filtroTab === 'en_tramite') return info.estado === 'en_tramite';
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pendiente Laboratorio':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-sm font-semibold text-[10px]">PENDIENTE LAB</span>;
      case 'Pendiente Medicina':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm font-semibold text-[10px]">PENDIENTE MED</span>;
      case 'Aprobado':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm font-semibold text-[10px]">APROBADO</span>;
      case 'Rechazado':
        return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-sm font-semibold text-[10px]">RECHAZADO</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-150 text-slate-600 rounded-sm font-semibold text-[10px]">{status}</span>;
    }
  };

  // VISTA 1: DETALLE DE PACIENTE SELECCIONADO e HISTORIAL
  if (selectedPaciente) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedPaciente(null)}
            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Expediente Clínico Digital</h2>
            <p className="text-xs text-slate-500 mt-1">Historial cronológico de carnets y pruebas médicas.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Ficha demográfica */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-6">
          <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shrink-0 self-center md:self-start">
            {selectedPaciente.foto_url ? (
              <img src={selectedPaciente.foto_url} alt="Paciente" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200">
                {selectedPaciente.nombres[0]}
              </div>
            )}
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedPaciente.nombres} {selectedPaciente.apellidos}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Cédula: {selectedPaciente.ci} {selectedPaciente.ci_exp}</p>
              </div>
              
              <button
                onClick={() => handleOpenRenovacion(selectedPaciente)}
                disabled={!getEstadoCarnetInfo(selectedPaciente).canRenovar}
                title={!getEstadoCarnetInfo(selectedPaciente).canRenovar ? getEstadoCarnetInfo(selectedPaciente).motivoNoRenovar : 'Iniciar renovación anual de carnet'}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 ${
                  !getEstadoCarnetInfo(selectedPaciente).canRenovar
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : getEstadoCarnetInfo(selectedPaciente).isVencido
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20 cursor-pointer animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 cursor-pointer'
                }`}
              >
                <RefreshCw size={13} />
                Renovar Carnet Sanitario
              </button>
            </div>

            {/* Alerta si el carnet está vencido */}
            {getEstadoCarnetInfo(selectedPaciente).isVencido && (
              <div className="p-3.5 bg-red-50 border-2 border-red-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 shadow-xs">
                <div className="flex items-center gap-2.5 text-xs">
                  <AlertTriangle size={20} className="text-red-600 shrink-0" />
                  <div>
                    <span className="font-black text-red-900">¡CARNET SANITARIO VENCIDO!</span>
                    <p className="text-red-700 text-[11px] mt-0.5">
                      Expiró el <strong>{getEstadoCarnetInfo(selectedPaciente).fechaVenc}</strong> ({getEstadoCarnetInfo(selectedPaciente).diasVencido} días atrás). Debe realizarse la renovación correspondiente.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenRenovacion(selectedPaciente)}
                  className="whitespace-nowrap px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={12} />
                  Renovar Ahora
                </button>
              </div>
            )}

            {/* N° Carnet Físico — PRINCIPAL */}
            {selectedPaciente.numero_carnet_fisico && (
              <div className="mb-4 p-4 bg-blue-600 rounded-xl flex items-center gap-4">
                <span className="text-blue-200 text-xs font-bold uppercase tracking-wider shrink-0">N° Carnet Físico</span>
                <span className="text-white font-black font-mono text-3xl tracking-widest">
                  {selectedPaciente.numero_carnet_fisico}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Fecha Nacimiento</span>
                <p className="font-bold text-slate-800">{new Date(selectedPaciente.fecha_nacimiento).toLocaleDateString('es-ES')}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Género</span>
                <p className="font-bold text-slate-800">{selectedPaciente.genero}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Ocupación</span>
                <p className="font-bold text-slate-800">{selectedPaciente.ocupacion}</p>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Empresa / Mercado</span>
                <p className="font-bold text-slate-800">
                  {selectedPaciente.empresa_trabajo || 'Independiente'} 
                  {selectedPaciente.mercado ? ` (Mercado: ${selectedPaciente.mercado})` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Historial de Trámites */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <History size={16} className="text-slate-500" />
            Historial Clínico de Trámites
          </h4>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historial.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-xl bg-white">El paciente no registra trámites anteriores.</p>
          ) : (
            <div className="space-y-4">
              {historial.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  
                  {/* Trámite Header */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 flex-wrap gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">Trámite ID: #{item.id} ({item.tipo_tramite})</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Iniciado: {new Date(item.fecha_inicio).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.codigo_carnet && (
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-sm">
                          Cód: {item.codigo_carnet}
                        </span>
                      )}
                      {getStatusBadge(item.estado)}
                    </div>
                  </div>

                  {/* Resultados detallados si existen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Lab Section */}
                    {item.lab_id ? (
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2">
                        <h5 className="font-bold text-blue-600 text-[10px] uppercase tracking-wider">Resultados Bioquímicos y Parasitológicos</h5>
                        <ul className="space-y-1.5 text-slate-700">
                          <li>
                            <span className="font-semibold text-slate-400">Sangre:</span> Glicemia {item.quimica_sanguinea?.glucosa || '—'} mg/dL{item.quimica_sanguinea?.urea ? `, Urea ${item.quimica_sanguinea.urea} mg/dL` : ''}{item.quimica_sanguinea?.creatinina ? `, Creatinina ${item.quimica_sanguinea.creatinina} mg/dL` : ''}
                            {item.quimica_sanguinea?.grupo_sanguineo && (
                              <span className="ml-1 text-slate-500 font-medium">({item.quimica_sanguinea.grupo_sanguineo}{item.quimica_sanguinea.factor_rh})</span>
                            )}
                          </li>
                          <li>
                            <span className="font-semibold text-slate-400">Coproparasitológico (Microscópico):</span>{' '}
                            <strong className={(item.coproparasitologico?.examen_microscopico && item.coproparasitologico.examen_microscopico !== 'Negativo') || (item.coproparasitologico?.parasito && item.coproparasitologico.parasito !== 'Negativo') ? 'text-amber-700' : 'text-slate-800'}>
                              {item.coproparasitologico?.examen_microscopico || item.coproparasitologico?.parasito || 'Negativo'}
                            </strong>
                          </li>
                          {(item.coproparasitologico?.aspecto || item.coproparasitologico?.moco || item.coproparasitologico?.sangre_macroscopica || item.coproparasitologico?.consistencia) && (
                            <li className="text-[11px] text-slate-500 bg-white/70 px-2 py-1 rounded border border-slate-100">
                              <span className="font-semibold text-slate-400">Macroscópico:</span>{' '}
                              Aspecto: {item.coproparasitologico.aspecto || item.coproparasitologico.consistencia || 'Normal'} &bull;{' '}
                              Moco: {item.coproparasitologico.moco || 'Negativo'} &bull;{' '}
                              Sangre: {item.coproparasitologico.sangre_macroscopica || item.coproparasitologico.color || 'Negativo'}
                            </li>
                          )}
                          <li>
                            <span className="font-semibold text-slate-400">VIH Inmunología:</span>{' '}
                            {item.vih?.realizado === false || item.vih?.resultado === 'No Realizado' ? (
                              <span className="text-slate-500 italic text-[11px]">No realizado</span>
                            ) : item.vih?.mostrar_en_registro_medico === false ? (
                              <span className="text-purple-600 font-medium text-[11px]">Omitido en registro médico</span>
                            ) : (
                              <strong className={item.vih?.resultado === 'Reactivo' ? 'text-red-700' : 'text-slate-800'}>
                                {item.vih?.resultado || 'No Reactivo'}
                              </strong>
                            )}
                          </li>
                          {Array.isArray(item.otros_analisis) && item.otros_analisis.length > 0 && (
                            <li className="text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-400">Otros Análisis:</span>{' '}
                              {item.otros_analisis.map((oa, idx) => (
                                <span key={idx} className="inline-block mr-2 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-blue-100">
                                  {oa.analisis}: {oa.resultado}
                                </span>
                              ))}
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-slate-400 flex items-center justify-center italic text-center">
                        Resultados de laboratorio pendientes
                      </div>
                    )}

                    {/* Med Section */}
                    {item.consulta_id ? (
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2">
                        <h5 className="font-bold text-emerald-600 text-[10px] uppercase tracking-wider">Evaluación Médica Conclusiva</h5>
                        <ul className="space-y-1.5 text-slate-700">
                          {item.firma_medico && (
                            <li className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-400">Atendido por:</span>
                              <strong className="text-emerald-700">{item.firma_medico}</strong>
                            </li>
                          )}
                          <li>
                            <span className="font-semibold text-slate-400">Examen Físico:</span> Piel: {item.examen_fisico?.piel || '—'}, Resp: {item.examen_fisico?.respiratorio || '—'}, Card: {item.examen_fisico?.cardiovascular || '—'}, Dental: {item.examen_fisico?.dental || '—'}
                            {item.examen_fisico?.otros && (
                              <span className="block text-[11px] text-slate-500 mt-0.5">
                                <strong>Otros hallazgos:</strong> {item.examen_fisico.otros}
                              </span>
                            )}
                          </li>
                          <li><span className="font-semibold text-slate-400">Antecedentes:</span> {item.antecedentes_patologicos || 'Ninguno'}</li>
                          <li><span className="font-semibold text-slate-400">Diagnóstico:</span> <strong>{item.diagnostico}</strong></li>
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-slate-400 flex items-center justify-center italic text-center">
                        Evaluación médica pendiente
                      </div>
                    )}
                  </div>

                  {/* Acciones del carnet si el trámite está Aprobado */}
                  {item.estado === 'Aprobado' && item.codigo_carnet && (
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        {item.numero_carnet_fisico && (
                          <span className="mr-2 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold font-mono">
                            Nº Físico: {item.numero_carnet_fisico}
                          </span>
                        )}
                        Carnet: <strong className="text-blue-700 font-mono">{item.codigo_carnet}</strong> 
                        {item.fecha_vencimiento && ` (Vence: ${new Date(item.fecha_vencimiento).toLocaleDateString('es-ES')})`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCarnetToPrint({
                              ...selectedPaciente,
                              ...item,
                              tramite_id: item.id
                            });
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-950 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Ver y configurar impresión oficial del carnet"
                        >
                          <Printer size={12} />
                          Ver / Imprimir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Previsualización Oficial de Carnet */}
        {carnetToPrint && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Settings2 size={16} className="text-blue-600" />
                  Configuración de Impresión de Carnet
                </h3>
                <button onClick={() => setCarnetToPrint(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 flex flex-col items-center gap-6">
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                  <label className={`cursor-pointer px-4 py-3 border-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${printSize === 'standard' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <input type="radio" name="pacientePrintSize" value="standard" checked={printSize === 'standard'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                    🪪 Kardex Oficial (9 × 7 cm)
                  </label>
                  <label className={`cursor-pointer px-4 py-3 border-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${printSize === 'cr80' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <input type="radio" name="pacientePrintSize" value="cr80" checked={printSize === 'cr80'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                    💳 Tarjeta PVC CR80 (8.6 × 5.4 cm)
                  </label>
                </div>

                <div className="text-xs text-slate-500">Vista previa:</div>
                
                <div className="w-full flex justify-center overflow-x-auto py-2">
                  <div className="scale-[0.8] sm:scale-110 md:scale-130 origin-top mb-16 sm:mb-24">
                    <CarnetTemplate carnet={carnetToPrint} size={printSize} />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-2">
                <button onClick={() => setCarnetToPrint(null)} className="w-full sm:w-auto text-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer">
                  Cerrar
                </button>
                <button onClick={() => window.print()} className="w-full sm:w-auto justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                  <Printer size={15} />
                  Proceder a Imprimir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zona de impresión oculta en pantalla, visible al imprimir */}
        {carnetToPrint && (
          <div className="hidden print:block print-area print-carnet-wrapper">
            <CarnetTemplate carnet={carnetToPrint} size={printSize} />
          </div>
        )}
      </div>
    );
  }

  // VISTA 2: LISTADO Y FORMULARIO DE BÚSQUEDA
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Búsqueda Avanzada de Expedientes</h2>
        <p className="text-xs text-slate-500 mt-1">Busque pacientes por cédula de identidad, nombre, rubros comerciales o mercados.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Formulario Filtros */}
      <form onSubmit={handleSearch} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Nombre / C.I. / N° de Kardex / Empresa
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por Nombre, Cédula o N° Kardex (ej. 5791)..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mercado</label>
          <input
            type="text"
            value={mercado}
            onChange={(e) => setMercado(e.target.value)}
            placeholder="Ej. Pompeya"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2 w-full">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer text-center"
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            type="button"
            onClick={handleClearFilters}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Limpiar
          </button>
        </div>
      </form>

      {/* Pestañas de Estado de Carnet */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setFiltroTab('todos')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filtroTab === 'todos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Todos ({pacientes.length})
        </button>

        <button
          type="button"
          onClick={() => setFiltroTab('vencidos')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filtroTab === 'vencidos'
              ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
              : totalVencidos > 0
              ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100'
              : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>🔴 Carnets Vencidos</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${filtroTab === 'vencidos' ? 'bg-white text-red-700' : 'bg-red-200 text-red-800'}`}>
            {totalVencidos}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroTab('vigentes')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filtroTab === 'vigentes'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>🟢 Carnets Vigentes</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${filtroTab === 'vigentes' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'}`}>
            {totalVigentes}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFiltroTab('en_tramite')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filtroTab === 'en_tramite'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>⏳ En Trámite</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${filtroTab === 'en_tramite' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'}`}>
            {totalEnTramite}
          </span>
        </button>
      </div>

      {/* Resultados de la búsqueda */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Filtrando expedientes...</p>
        </div>
      ) : pacientesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <Users size={40} className="text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-500">
            {filtroTab === 'vencidos'
              ? 'No hay pacientes con carnet sanitario vencido'
              : filtroTab === 'vigentes'
              ? 'No hay pacientes con carnet vigente'
              : filtroTab === 'en_tramite'
              ? 'No hay trámites activos en proceso'
              : 'No se encontraron expedientes coincidentes'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {filtroTab !== 'todos' ? 'Cambie de pestaña o limpie los filtros.' : 'Intente cambiar la palabra clave o limpie los filtros.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">Foto</th>
                <th className="py-3.5 px-6">Paciente</th>
                <th className="py-3.5 px-6">Cédula de Identidad</th>
                <th className="py-3.5 px-6">N° Kardex</th>
                <th className="py-3.5 px-6">Ocupación / Rubro</th>
                <th className="py-3.5 px-6">Estado del Carnet</th>
                <th className="py-3.5 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {pacientesFiltrados.map((paciente) => {
                const infoCarnet = getEstadoCarnetInfo(paciente);
                return (
                  <tr key={paciente.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        {paciente.foto_url ? (
                          <img src={paciente.foto_url} alt="Paciente" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200">
                            {paciente.nombres[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <p className="font-bold text-slate-900">{paciente.nombres} {paciente.apellidos}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{paciente.empresa_trabajo || 'Independiente'}</p>
                    </td>
                    <td className="py-3 px-6 font-semibold font-mono text-slate-800">
                      {paciente.ci} {paciente.ci_exp}
                    </td>
                    <td className="py-3 px-6">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                        {paciente.numero_carnet_fisico ? `N° ${paciente.numero_carnet_fisico}` : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-6 font-medium text-slate-750">{paciente.ocupacion}</td>
                    <td className="py-3 px-6">
                      {infoCarnet.badge}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewDetails(paciente)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-950 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Ver expediente clínico"
                        >
                          <Eye size={12} />
                          Ver
                        </button>

                        {infoCarnet.canRenovar ? (
                          <button
                            onClick={() => handleOpenRenovacion(paciente)}
                            title={infoCarnet.isVencido ? 'Carnet vencido - Iniciar renovación' : 'Renovar carnet sanitario'}
                            className={`px-3 py-1.5 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs ${
                              infoCarnet.isVencido
                                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <RefreshCw size={11} />
                            Renovar
                          </button>
                        ) : (
                          <span
                            className="px-2 py-1.5 bg-slate-100 text-slate-400 font-semibold text-[10px] rounded-lg border border-slate-200 cursor-not-allowed"
                            title={infoCarnet.motivoNoRenovar}
                          >
                            En curso
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== MODAL DE RENOVACIÓN DE CARNET SANITARIO ===== */}
      {renovacionPaciente && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-600" />
                Renovación de Carnet Sanitario
              </h3>
              <button
                onClick={() => setRenovacionPaciente(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Paciente:</span>
                <span className="font-bold text-slate-900">{renovacionPaciente.nombres} {renovacionPaciente.apellidos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Cédula:</span>
                <span className="font-mono font-bold text-slate-800">{renovacionPaciente.ci} {renovacionPaciente.ci_exp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Ocupación / Rubro:</span>
                <span className="font-medium text-slate-800">{renovacionPaciente.ocupacion}</span>
              </div>
              {renovacionPaciente.numero_carnet_fisico && (
                <div className="flex justify-between pt-1 border-t border-blue-200/60">
                  <span className="text-blue-800 font-semibold">Último Kardex registrado:</span>
                  <span className="font-mono font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-300">
                    N° {renovacionPaciente.numero_carnet_fisico}
                  </span>
                </div>
              )}
            </div>

            {getEstadoCarnetInfo(renovacionPaciente).isVencido && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0 text-red-600" />
                <span>
                  Carnet vencido el {getEstadoCarnetInfo(renovacionPaciente).fechaVenc}. La renovación iniciará una nueva vigencia de 1 año tras aprobación.
                </span>
              </div>
            )}

            <form onSubmit={handleConfirmRenovacion} className="space-y-4">
              {/* N° Nuevo de Carnet Físico / Kardex */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🪪 N° Nuevo de Carnet Físico / Kardex
                  <span className="text-[11px] font-normal text-slate-400 ml-1">(Número pre-impreso del nuevo cartón)</span>
                </label>
                <input
                  type="text"
                  value={renovacionKardex}
                  onChange={(e) => {
                    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                    if (val.startsWith('-')) val = val.replace(/^-+/, '');
                    setRenovacionKardex(val);
                  }}
                  placeholder="Ej. 000386 o nuevo código..."
                  className="w-full px-3 py-2 border-2 border-blue-300 rounded-xl text-base font-bold font-mono text-blue-800 outline-none focus:border-blue-600 bg-white uppercase placeholder:text-slate-300"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Opcional si aún no se tiene el cartón en mano; se puede asignar o confirmar al emitir.
                </p>
              </div>

              {/* Costo del trámite y Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Costo Trámite (Bs.)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={renovacionCosto}
                    onChange={(e) => setRenovacionCosto(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold font-mono outline-none focus:border-blue-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Trámite</label>
                  <input
                    type="text"
                    value="Renovación (1 Año)"
                    readOnly
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed">
                💡 Al confirmar la renovación, el paciente será enviado inmediatamente a la <strong>Bandeja de Laboratorio</strong> para registrar sus nuevos análisis clínicos.
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setRenovacionPaciente(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingRenovacion}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <RefreshCw size={13} className={submittingRenovacion ? 'animate-spin' : ''} />
                  {submittingRenovacion ? 'Iniciando Renovación...' : 'Confirmar e Iniciar Renovación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
