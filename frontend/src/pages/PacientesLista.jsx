import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Search, Users, Eye, History, PlusCircle, AlertCircle, Calendar, ArrowLeft, Printer, Edit3 } from 'lucide-react';
import CarnetTemplate from '../components/CarnetTemplate';
import { Settings2, X } from 'lucide-react';

export default function PacientesLista({ onNavigate, setSharedData }) {
  const [query, setQuery] = useState('');
  const [mercado, setMercado] = useState('');
  const [ocupacion, setOcupacion] = useState('');
  
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Detalles de un paciente seleccionado
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Impresión de Carnet desde el expediente
  const [carnetToPrint, setCarnetToPrint] = useState(null);
  const [printSize, setPrintSize] = useState('standard');

  // Nuevo Trámite Form para paciente existente
  const [showNewTramiteModal, setShowNewTramiteModal] = useState(false);
  const [newTramiteType, setNewTramiteType] = useState('Renovación');
  const [submittingTramite, setSubmittingTramite] = useState(false);

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
    // Cargar sin filtros
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

  const handleOpenNewTramite = () => {
    setShowNewTramiteModal(true);
  };

  const handleCreateTramite = async (e) => {
    e.preventDefault();
    if (!selectedPaciente) return;

    setSubmittingTramite(true);
    setError('');

    try {
      await api.pacientes.openTramite(selectedPaciente.id, {
        tipo_tramite: newTramiteType
      });
      setShowNewTramiteModal(false);
      
      // Recargar historial del paciente
      handleViewDetails(selectedPaciente);
      
      // Mensaje rápido
      alert('Trámite iniciado con éxito. El paciente ha sido enviado a la cola de Laboratorio.');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al iniciar el trámite.');
    } finally {
      setSubmittingTramite(false);
    }
  };

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
                onClick={handleOpenNewTramite}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 transition-colors cursor-pointer flex items-center gap-1"
              >
                <PlusCircle size={14} />
                Abrir Nuevo Trámite
              </button>
            </div>

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

        {/* Modal de Nuevo Trámite */}
        {showNewTramiteModal && (
          <div className="bg-slate-900/50 backdrop-blur-xs fixed inset-0 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm w-full shadow-2xl space-y-4">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Nuevo Trámite de Renovación</h3>
              <form onSubmit={handleCreateTramite} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo Trámite *</label>
                  <select
                    value={newTramiteType}
                    onChange={(e) => setNewTramiteType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white outline-none focus:border-blue-500"
                  >
                    <option value="Renovación">Renovación</option>
                    <option value="Apertura">Apertura (Duplicado / Nueva)</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewTramiteModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTramite}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    {submittingTramite ? 'Iniciando...' : 'Iniciar Trámite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                            <span className="font-semibold text-slate-400">Sangre:</span> Glucosa {item.quimica_sanguinea?.glucosa || '—'} mg/dL, Urea {item.quimica_sanguinea?.urea || '—'} mg/dL, Creatinina {item.quimica_sanguinea?.creatinina || '—'} mg/dL
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
                            <strong className={item.vih?.resultado === 'Reactivo' ? 'text-red-700' : 'text-slate-800'}>
                              {item.vih?.resultado || 'No Reactivo'}
                            </strong>
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
                          <li><span className="font-semibold text-slate-400">Examen Físico:</span> Piel {item.examen_fisico?.piel}, Dental {item.examen_fisico?.dental}</li>
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
                        Carnet emitido: <strong className="text-blue-700 font-mono">{item.codigo_carnet}</strong> 
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
                    📄 Cartulina Estándar (10 × 7.5 cm)
                  </label>
                  <label className={`cursor-pointer px-4 py-3 border-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${printSize === 'cr80' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <input type="radio" name="pacientePrintSize" value="cr80" checked={printSize === 'cr80'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                    💳 Tarjeta PVC CR80 (8.6 × 5.4 cm)
                  </label>
                </div>

                <div className="text-xs text-slate-500">Vista previa:</div>
                
                <div style={{ transform: 'scale(1.4)', transformOrigin: 'top center', marginBottom: '90px' }}>
                  <CarnetTemplate carnet={carnetToPrint} size={printSize} />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end gap-3">
                <button onClick={() => setCarnetToPrint(null)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer">
                  Cerrar
                </button>
                <button onClick={() => window.print()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
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

      {/* Formulario Filtros */}
      <form onSubmit={handleSearch} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre / C.I. / Empresa</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej. Juan Pérez o 9876543"
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

      {/* Resultados de la búsqueda */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500">Filtrando expedientes...</p>
        </div>
      ) : pacientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <Users size={40} className="text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-500">No se encontraron expedientes coincidentes</p>
          <p className="text-[10px] text-slate-400 mt-1">Intente cambiar la palabra clave o limpie los filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">Foto</th>
                <th className="py-3.5 px-6">Paciente</th>
                <th className="py-3.5 px-6">Cédula de Identidad</th>
                <th className="py-3.5 px-6">Ocupación / Rubro</th>
                <th className="py-3.5 px-6">Estado Último Carnet</th>
                <th className="py-3.5 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {pacientes.map((paciente) => (
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
                  <td className="py-3 px-6 font-medium text-slate-750">{paciente.ocupacion}</td>
                  <td className="py-3 px-6">
                    {paciente.estado ? getStatusBadge(paciente.estado) : <span className="text-slate-400 italic">Ninguno iniciado</span>}
                  </td>
                  <td className="py-3 px-6 text-center">
                    <button
                      onClick={() => handleViewDetails(paciente)}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-950 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                    >
                      <Eye size={12} />
                      Ver Expediente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
