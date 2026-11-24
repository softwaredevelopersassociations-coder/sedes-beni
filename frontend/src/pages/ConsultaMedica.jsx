import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import CarnetTemplate from '../components/CarnetTemplate';
import { PatientPhotoPrintControls } from '../components/PatientPhotoPrint';
import AdvancedQueueFilters from '../components/AdvancedQueueFilters';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { filterPendingTramites } from '../utils/queueSearch';
import { printDocument, printPhotoSheet } from '../utils/printDocument';
import {
  Stethoscope,
  PlusCircle, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  ArrowLeft, 
  Activity, 
  Printer, 
  Heart,
  FileText,
  BadgeAlert,
  ArrowRight,
  Settings2,
  Search
} from 'lucide-react';

const emptyRevision = () => ({
  evaluacion_dermica: '',
  evaluacion_respiratoria: '',
  evaluacion_cardiovascular: '',
  evaluacion_gastrointestinal: '',
  peso: '',
  altura: '',
  presion: '',
  temperatura: '',
  pulso: '',
});

export default function ConsultaMedica({ sharedData, setSharedData, onNavigate }) {
  const [pendientes, setPendientes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filters, setFilters] = useState({ query: '', tipo: '', ocupacion: '', mercado: '', desde: '', hasta: '' });

  const [revision, setRevision] = useState(emptyRevision);

  const [antecedentes, setAntecedentes] = useState('');
  const [diagnostico, setDiagnostico] = useState('Apto para la manipulación de alimentos.');
  const [aprobado, setAprobado] = useState(true);
  const [nombreMedico, setNombreMedico] = useState('');
  const [printSize, setPrintSize] = useState('standard');
  const [photoCopies, setPhotoCopies] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emitResult, setEmitResult] = useState(null);

  const loadPendientes = async ({ quiet = false } = {}) => {
    if (!quiet) setLoadingList(true);
    try {
      const data = await api.consultas.getPendientes();
      setPendientes(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la lista de pendientes de medicina.');
    } finally {
      if (!quiet) setLoadingList(false);
    }
  };

  const handleSelectTramite = (tramite) => {
    setRevision(emptyRevision());
    setAntecedentes('');
    setSharedData(tramite);
    if (onNavigate) {
      onNavigate('medicina-formulario');
    }
  };

  useEffect(() => {
    if (!sharedData) {
      loadPendientes();
    }
  }, [sharedData]);

  useLiveRefresh(() => {
    if (!sharedData) loadPendientes({ quiet: true });
  }, !sharedData);

  // Si se aprueba o se carga con datos previos, sugerir diagnóstico
  useEffect(() => {
    if (sharedData) {
      const microText = sharedData.coproparasitologico?.examen_microscopico || sharedData.coproparasitologico?.parasito || '';
      const hasParasitos = microText && !/no se observan|negativo/i.test(microText);
      const vihRealizado = sharedData.vih?.realizado !== false && sharedData.vih?.resultado !== 'No Realizado';
      const vihVisible = sharedData.vih?.mostrar_en_registro_medico !== false;
      const hasVih = vihRealizado && vihVisible && sharedData.vih?.resultado === 'Reactivo';
      
      if (hasParasitos || hasVih) {
        setAprobado(false);
        setDiagnostico(
          `No Apto temporalmente. Se detectó: ${
            hasParasitos ? 'Parasitosis (' + sharedData.coproparasitologico.parasito + ')' : ''
          }${hasVih ? (hasParasitos ? ' y ' : '') + 'VIH Reactivo' : ''}. Se prescribe tratamiento.`
        );
      } else {
        setAprobado(true);
        setDiagnostico('Apto para la manipulación de alimentos.');
      }
    }
  }, [sharedData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!sharedData) return;

    setSubmitting(true);

    const payload = {
      revision_general: {
        evaluacion_dermica: revision.evaluacion_dermica.trim() || null,
        evaluacion_respiratoria: revision.evaluacion_respiratoria.trim() || null,
        evaluacion_cardiovascular: revision.evaluacion_cardiovascular.trim() || null,
        evaluacion_gastrointestinal: revision.evaluacion_gastrointestinal.trim() || null,
        peso: revision.peso === '' ? null : Number(revision.peso),
        altura: revision.altura === '' ? null : Number(revision.altura),
        presion: revision.presion.trim() || null,
        temperatura: revision.temperatura === '' ? null : Number(revision.temperatura),
        pulso: revision.pulso === '' ? null : Number(revision.pulso)
      },
      antecedentes_patologicos: antecedentes,
      diagnostico,
      aprobado,
      firma_medico: nombreMedico.trim()
    };

    try {
      const response = await api.consultas.saveConsult(sharedData.tramite_id, payload);
      setSuccess(response.message);
      setEmitResult(response);
      setSharedData(prev => prev ? {
        ...prev,
        estado: response.estado,
        codigo_carnet: response.codigo_carnet,
        numero_carnet_fisico: response.numero_carnet_fisico || prev.numero_carnet_fisico,
        fecha_emision: response.fecha_emision,
        fecha_vencimiento: response.fecha_vencimiento
      } : null);
      
      // Permitir la impresión directa del carnet recién emitido
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al registrar la evaluación médica.');
      setSubmitting(false);
    }
  };

  const handlePrint = () => printDocument();

  const handleVolverBandeja = () => {
    setSharedData(null);
    setEmitResult(null);
    setSuccess('');
    setError('');
    if (onNavigate) {
      onNavigate('medicina');
    }
  };

  const handleFinish = () => {
    setSharedData(null);
    setEmitResult(null);
    setSuccess('');
    setError('');
    if (onNavigate) {
      onNavigate('dashboard');
    }
  };

  // VISTA 1: LISTADO DE PENDIENTES
  if (!sharedData) {
    const pendientesFiltrados = filterPendingTramites(pendientes, filters);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bandeja Médica</h2>
          <p className="text-xs text-slate-500 mt-1">Seleccione un paciente de la lista para evaluar su estado clínico e imprimir su carnet.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <AdvancedQueueFilters
          items={pendientes}
          filters={filters}
          setFilters={setFilters}
          resultCount={pendientesFiltrados.length}
          areaLabel="área médica"
          onRefresh={() => loadPendientes()}
          accent="emerald"
        />

        {loadingList ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Buscando expedientes clínicos...</p>
          </div>
        ) : pendientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Stethoscope size={40} className="text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-500">No hay pacientes esperando consulta médica</p>
            <p className="text-[10px] text-slate-400 mt-1">Los trámites aparecerán aquí tras registrarse sus resultados de laboratorio.</p>
          </div>
        ) : pendientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-white text-center">
            <Search size={32} className="text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">No se encontraron pacientes con los filtros seleccionados en medicina</p>
            <button
              onClick={() => setFilters({ query: '', tipo: '', ocupacion: '', mercado: '', desde: '', hasta: '' })}
              className="mt-2 text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Foto</th>
                  <th className="py-3.5 px-6">Paciente / CI</th>
                  <th className="py-3.5 px-6">N° Carnets (Kardex / Digital)</th>
                  <th className="py-3.5 px-6">Ocupación / Rubro</th>
                  <th className="py-3.5 px-6">Coproparasitológico</th>
                  <th className="py-3.5 px-6">VIH</th>
                  <th className="py-3.5 px-6 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pendientesFiltrados.map((p) => {
                  const coproTexto = p.coproparasitologico?.examen_microscopico || p.coproparasitologico?.parasito || 'Negativo';
                  const coproPos = coproTexto && !/no se observan|negativo/i.test(coproTexto);
                  const vihRealizado = p.vih?.realizado !== false && p.vih?.resultado !== 'No Realizado';
                  const vihVisible = p.vih?.mostrar_en_registro_medico !== false;
                  const vihPos = vihRealizado && vihVisible && p.vih?.resultado === 'Reactivo';
                  return (
                    <tr key={p.tramite_id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-6">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                          {p.foto_url ? (
                            <img src={p.foto_url} alt="Paciente" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200">
                              {p.nombres[0]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <p className="font-bold text-slate-900">{p.nombres} {p.apellidos}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">CI: {p.ci} {p.ci_exp}</p>
                      </td>
                      <td className="py-3 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Kardex:</span>
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                              {p.numero_carnet_fisico ? `N° ${p.numero_carnet_fisico}` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Digital:</span>
                            <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {p.codigo_carnet || `Trámite #${p.tramite_id}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6 font-medium text-slate-800">{p.ocupacion}</td>
                      <td className="py-3 px-6">
                        <div className="space-y-0.5">
                          <span className={`px-2 py-0.5 rounded-sm font-semibold text-[10px] inline-block ${
                            coproPos 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {coproTexto}
                          </span>
                          {(p.coproparasitologico?.aspecto || p.coproparasitologico?.sangre_macroscopica) && (
                            <p className="text-[9px] text-slate-400 truncate max-w-[180px]">
                              Asp: {p.coproparasitologico?.aspecto || '—'} | Sgr: {p.coproparasitologico?.sangre_macroscopica || p.coproparasitologico?.sangre || 'Ausente'}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        {!vihRealizado ? (
                          <span className="px-2 py-0.5 rounded-sm font-semibold text-[10px] bg-slate-100 text-slate-500 border border-slate-200">
                            No Realizado
                          </span>
                        ) : !vihVisible ? (
                          <span className="px-2 py-0.5 rounded-sm font-semibold text-[10px] bg-purple-50 text-purple-700 border border-purple-200" title="Omitido del registro médico">
                            No Visible
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-sm font-semibold text-[10px] ${
                            vihPos 
                              ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {p.vih?.resultado || 'No Reactivo'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-center">
                        <button
                          onClick={() => handleSelectTramite(p)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          Evaluar
                          <ArrowRight size={12} />
                        </button>
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

  // VISTA INTERMEDIA: PACIENTE YA EVALUADO PREVIAMENTE
  if (sharedData && (sharedData.estado === 'Aprobado' || sharedData.estado === 'Rechazado') && !emitResult) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle size={30} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Este paciente ya fue evaluado</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              El trámite de <strong>{sharedData.nombres} {sharedData.apellidos}</strong> (CI: {sharedData.ci}) ya fue completado con estado:{' '}
              <span className={`font-bold ${sharedData.estado === 'Aprobado' ? 'text-emerald-700' : 'text-red-700'}`}>
                {sharedData.estado}
              </span>
              {sharedData.codigo_carnet && <> · Código: <span className="font-mono font-bold text-blue-700">{sharedData.codigo_carnet}</span></>}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={handleVolverBandeja}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Volver a la Bandeja Médica
            </button>
            <button
              onClick={handleFinish}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Ir al Panel Central
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VISTA 2: FORMULARIO Y RESULTADOS DE EMISIÓN
  const coproTexto = sharedData.coproparasitologico?.examen_microscopico || sharedData.coproparasitologico?.parasito || '';
  const coproAlert = coproTexto && !/no se observan|negativo/i.test(coproTexto);
  const vihRealizado = sharedData.vih?.realizado !== false && sharedData.vih?.resultado !== 'No Realizado';
  const vihVisible = sharedData.vih?.mostrar_en_registro_medico !== false;
  const vihAlert = vihRealizado && vihVisible && sharedData.vih?.resultado === 'Reactivo';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Botón Volver */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleVolverBandeja}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="Volver a la bandeja de pendientes"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Evaluación Médica del Paciente</h2>
          <p className="text-xs text-slate-500 mt-1">Revise laboratorios, complete el historial físico y decida la aptitud.</p>
        </div>
      </div>

      {/* Banner de Éxito / Emisión y Previsualización Oficial */}
      {success && emitResult && (
        <div className="space-y-6 print:hidden">
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div className="flex gap-3">
              <CheckCircle className="text-emerald-600 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-bold text-emerald-800">Evaluación médica finalizada correctamente</h3>
                <div className="text-xs text-emerald-700 mt-1 space-y-0.5">
                  {aprobado ? (
                    <>
                      <p>
                        Trámite aprobado exitosamente con <strong>N° Kardex / Físico: {emitResult.numero_carnet_fisico || sharedData.numero_carnet_fisico ? `N° ${emitResult.numero_carnet_fisico || sharedData.numero_carnet_fisico}` : '—'}</strong>
                      </p>
                      <p className="text-[11px] text-emerald-600">
                        Código de Carnet Digital SEDES: <strong>{emitResult.codigo_carnet}</strong>
                      </p>
                    </>
                  ) : (
                    <p>El trámite ha sido guardado como rechazado temporalmente por diagnóstico clínico.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {aprobado && (
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Printer size={14} />
                  Imprimir Carnet
                </button>
              )}
              <button
                onClick={handleVolverBandeja}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Volver a la Bandeja
              </button>
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-950 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Panel Central
              </button>
            </div>
          </div>

          {/* Panel de Vista Previa y Configuración de Impresión para el Carnet Aprobado */}
          {aprobado && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center gap-6">
              <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Settings2 size={16} className="text-blue-600" />
                    Vista Previa y Formato de Impresión
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Seleccione el tipo de soporte físico antes de enviar a imprimir.</p>
                </div>

                {/* Selector de tamaño */}
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <label className={`cursor-pointer flex-1 sm:flex-initial px-3.5 py-2 border-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${printSize === 'standard' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <input type="radio" name="consultaPrintSize" value="standard" checked={printSize === 'standard'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                    🪪 Carnet Oficial (8,8 × 6,9 cm)
                  </label>
                  <label className={`cursor-pointer flex-1 sm:flex-initial px-3.5 py-2 border-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${printSize === 'cr80' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                    <input type="radio" name="consultaPrintSize" value="cr80" checked={printSize === 'cr80'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                    💳 Tarjeta CR80 (8.6 × 5.4 cm)
                  </label>
                </div>
              </div>

              {/* Vista previa centrada */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 sm:p-6 w-full flex justify-center overflow-x-auto">
                <div className="w-full max-w-2xl flex justify-center">
                  <CarnetTemplate 
                    carnet={{
                      ...sharedData,
                      codigo_carnet: emitResult.codigo_carnet,
                      numero_carnet_fisico: emitResult.numero_carnet_fisico || sharedData.numero_carnet_fisico,
                      fecha_emision: emitResult.fecha_emision,
                      fecha_vencimiento: emitResult.fecha_vencimiento,
                      nombre_medico: nombreMedico,
                      firma_medico: nombreMedico
                    }} 
                    size={printSize} 
                  />
                </div>
              </div>

              <div className="flex justify-end w-full gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <Printer size={15} />
                  Proceder a Imprimir Carnet
                </button>
              </div>
              <PatientPhotoPrintControls
                photoUrl={sharedData.foto_url}
                copies={photoCopies}
                onCopiesChange={setPhotoCopies}
                onPrint={() => printPhotoSheet(sharedData.foto_url, photoCopies)}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* RENDER EXCLUSIVO PARA IMPRESIÓN (CARNET FÍSICO OFICIAL) */}
      {aprobado && emitResult && sharedData && (
        <div className="hidden print:block print-area print-carnet-wrapper">
          <CarnetTemplate 
            carnet={{
              ...sharedData,
              codigo_carnet: emitResult.codigo_carnet,
              numero_carnet_fisico: emitResult.numero_carnet_fisico || sharedData.numero_carnet_fisico,
              fecha_emision: emitResult.fecha_emision,
              fecha_vencimiento: emitResult.fecha_vencimiento,
              nombre_medico: nombreMedico,
              firma_medico: nombreMedico
            }} 
            size={printSize} 
            isPrintArea={true}
          />
        </div>
      )}
      {/* FORMULARIO CLÍNICO PRINCIPAL (OCULTO TRAS LA EMISIÓN) */}
      {!emitResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna Izquierda: Resultados de Laboratorio (Solo Lectura) */}
          <div className="space-y-4">
            
            {/* Paciente Resumen */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 mb-3 shadow-xs">
                {sharedData.foto_url ? (
                  <img src={sharedData.foto_url} alt="Paciente" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200">
                    {sharedData.nombres[0]}
                  </div>
                )}
              </div>
              <h4 className="text-xs font-bold text-slate-800 leading-tight">
                {sharedData.nombres} {sharedData.apellidos}
              </h4>
              <p className="text-[10px] text-slate-400 font-mono mt-1">CI: {sharedData.ci} {sharedData.ci_exp}</p>
              
              {/* LOS 2 NÚMEROS DE CARNET EN EL ÁREA MÉDICA */}
              <div className="w-full mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-left">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-blue-900 uppercase block">1. N° Carnet Físico (Kardex):</span>
                    <span className="text-[10px] text-blue-600">Tarjeta pre-impresa</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-blue-800 tracking-wider">
                    {sharedData.numero_carnet_fisico ? `N° ${sharedData.numero_carnet_fisico}` : '—'}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-bold text-slate-700 uppercase block">2. N° Carnet Digital:</span>
                    <span className="text-[10px] text-slate-400">Sistema SEDES</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-slate-800">
                    {sharedData.codigo_carnet || `Trámite #${sharedData.tramite_id}`}
                  </span>
                </div>
              </div>

              <div className="mt-3.5 px-3 py-1 bg-slate-100 text-[10px] font-semibold text-slate-700 rounded-full">
                {sharedData.ocupacion}
              </div>
            </div>

            {/* Resultados Laboratorios */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-2">
                <FileText size={16} className="text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Reporte de Laboratorio</h3>
              </div>

              {/* Química */}
              {/* Química */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Química Sanguínea</h5>
                  {sharedData.quimica_sanguinea?.grupo_sanguineo && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 font-bold text-[10px] rounded border border-blue-200">
                      Grupo: {sharedData.quimica_sanguinea?.grupo_sanguineo}{sharedData.quimica_sanguinea?.factor_rh}
                    </span>
                  )}
                </div>
                <div className={`grid ${sharedData.quimica_sanguinea?.urea || sharedData.quimica_sanguinea?.creatinina ? 'grid-cols-3' : 'grid-cols-1'} gap-2`}>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">GLICEMIA / GLUCOSA</span>
                    <span className={`text-base font-bold block mt-0.5 ${
                      parseFloat(sharedData.quimica_sanguinea?.glucosa) > 110 || parseFloat(sharedData.quimica_sanguinea?.glucosa) < 70
                        ? 'text-red-600' : 'text-slate-800'
                    }`}>
                      {sharedData.quimica_sanguinea?.glucosa || '—'}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">mg/dL (Ref: 70 - 110)</span>
                  </div>

                  {sharedData.quimica_sanguinea?.urea && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-[9px] text-slate-400 font-bold block">UREA</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{sharedData.quimica_sanguinea.urea}</span>
                      <span className="text-[8px] text-slate-400 block mt-0.5">mg/dL</span>
                    </div>
                  )}

                  {sharedData.quimica_sanguinea?.creatinina && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-[9px] text-slate-400 font-bold block">CREATININA</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{sharedData.quimica_sanguinea.creatinina}</span>
                      <span className="text-[8px] text-slate-400 block mt-0.5">mg/dL</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coproparasitológico Completo */}
              <div className="space-y-1.5 text-xs">
                <h5 className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Coproparasitológico</h5>
                <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                  coproAlert ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-100'
                }`}>
                  {/* Examen Macroscópico */}
                  <div className="border-b border-slate-200/60 pb-2">
                    <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block mb-1.5">
                      Examen Macroscópico
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="bg-white/80 p-1.5 rounded border border-slate-200/50">
                        <span className="text-slate-400 font-medium block text-[9px] uppercase">Aspecto:</span>
                        <span className="font-semibold text-slate-800 break-words">
                          {sharedData.coproparasitologico?.aspecto || sharedData.coproparasitologico?.consistencia || 'No especificado'}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded border border-slate-200/50">
                        <span className="text-slate-400 font-medium block text-[9px] uppercase">Moco:</span>
                        <span className="font-semibold text-slate-800 break-words">
                          {sharedData.coproparasitologico?.moco || 'Ausente'}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded border border-slate-200/50">
                        <span className="text-slate-400 font-medium block text-[9px] uppercase">Sangre:</span>
                        <span className={`font-semibold break-words ${
                          /presente|positivo|\+/i.test(sharedData.coproparasitologico?.sangre_macroscopica || sharedData.coproparasitologico?.sangre || '') 
                            ? 'text-red-600 font-bold' 
                            : 'text-slate-800'
                        }`}>
                          {sharedData.coproparasitologico?.sangre_macroscopica || sharedData.coproparasitologico?.sangre || 'Ausente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Examen Microscópico Directo */}
                  <div>
                    <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                      Examen Microscópico Directo
                    </span>
                    <div className={`p-2 rounded-lg border text-xs font-medium leading-relaxed ${
                      coproAlert 
                        ? 'bg-amber-100/60 border-amber-300 text-amber-900 font-bold' 
                        : 'bg-white/80 border-slate-200/60 text-slate-800'
                    }`}>
                      {sharedData.coproparasitologico?.examen_microscopico || sharedData.coproparasitologico?.parasito || 'No se observan parásitos intestinales (Negativo)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* VIH */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Inmunología (VIH)</h5>
                  {!vihRealizado && (
                    <span className="text-[9px] text-slate-400 italic">No realizado (Opcional)</span>
                  )}
                  {vihRealizado && !vihVisible && (
                    <span className="text-[9px] text-purple-600 font-semibold">Omitido en registro médico</span>
                  )}
                </div>
                {!vihRealizado ? (
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex justify-between items-center text-slate-500">
                    <span className="text-[11px] font-medium">Prueba no registrada para este trámite</span>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-sm font-semibold text-[9px]">
                      Omitido
                    </span>
                  </div>
                ) : !vihVisible ? (
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/60 flex justify-between items-center text-purple-800">
                    <div>
                      <span className="text-slate-500 font-medium block text-[10px]">Estado en registro:</span>
                      <span className="font-semibold text-purple-900 text-[11px]">
                        Confidencial / Oculto en registro médico
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-sm font-bold text-[9px]">
                      No Visible
                    </span>
                  </div>
                ) : (
                  <div className={`p-3 rounded-lg border flex justify-between items-center ${
                    vihAlert ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div>
                      <span className="text-slate-400 font-medium block">Diagnóstico:</span>
                      <span className={`font-bold ${vihAlert ? 'text-red-700' : 'text-slate-800'}`}>
                        {sharedData.vih?.resultado}
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-sm font-bold text-[9px]">
                      Consentido
                    </span>
                  </div>
                )}
              </div>

              
              {/* Otros Análisis */}
              {sharedData.otros_analisis && sharedData.otros_analisis.length > 0 && (
                <div className="space-y-2 text-xs">
                  <h5 className="font-bold text-slate-500 uppercase text-[9px] tracking-wider flex items-center gap-1">
                    <PlusCircle size={10} className="text-purple-600" />
                    Pruebas Adicionales
                  </h5>
                  <div className="space-y-1">
                    {sharedData.otros_analisis.map((oa, idx) => (
                      <div key={idx} className="p-2.5 bg-purple-50 border border-purple-100 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-semibold">{oa.analisis}</span>
                          <span className="font-bold text-purple-800">{oa.resultado}</span>
                        </div>
                        {oa.unidad && (
                          <span className="text-[9px] text-slate-400">{oa.unidad}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones del Laboratorio */}
              {sharedData.lab_observaciones && (
                <div className="space-y-1.5 text-xs">
                  <h5 className="font-bold text-slate-500 uppercase text-[9px] tracking-wider">Observaciones de Lab.</h5>
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium leading-snug">{sharedData.lab_observaciones}</p>
                  </div>
                </div>
              )}

              {/* Advertencias automáticas */}
              {(coproAlert || vihAlert) && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-[10px] text-red-700 flex gap-2">
                  <BadgeAlert size={14} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    **Alerta de Aptitud**: Paciente presenta marcadores positivos. Se aconseja suspender la emisión del carnet hasta completar tratamiento de curación.
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Columna Derecha: Formulario Evaluación Médica */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Revisión General */}
              <div>
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-4">
                  <Heart size={16} className="text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Revisión General</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {[
                    ['evaluacion_dermica', 'Evaluación dérmica'],
                    ['evaluacion_respiratoria', 'Evaluación respiratoria'],
                    ['evaluacion_cardiovascular', 'Evaluación cardiovascular'],
                    ['evaluacion_gastrointestinal', 'Evaluación gastrointestinal'],
                  ].map(([field, label]) => (
                    <label key={field} className="block space-y-1.5">
                      <span className="block text-xs font-semibold text-slate-500">{label}</span>
                      <textarea
                        value={revision[field]}
                        onChange={(e) => setRevision((current) => ({ ...current, [field]: e.target.value }))}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white resize-y"
                      />
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-500">Peso (kg)</span>
                    <input type="number" min="0" max="999.99" step="0.01" value={revision.peso}
                      onChange={(e) => setRevision((current) => ({ ...current, peso: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-500">Altura (m)</span>
                    <input type="number" min="0" max="99.99" step="0.01" value={revision.altura}
                      onChange={(e) => setRevision((current) => ({ ...current, altura: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-500">Presión</span>
                    <input type="text" maxLength="10" placeholder="120/80" value={revision.presion}
                      onChange={(e) => setRevision((current) => ({ ...current, presion: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-500">Temperatura (°C)</span>
                    <input type="number" min="0" max="999.9" step="0.1" value={revision.temperatura}
                      onChange={(e) => setRevision((current) => ({ ...current, temperatura: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-xs font-semibold text-slate-500">Pulso (lpm)</span>
                    <input type="number" min="0" step="1" value={revision.pulso}
                      onChange={(e) => setRevision((current) => ({ ...current, pulso: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500" />
                  </label>
                </div>
              </div>

              {/* Antecedentes clínicos */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Antecedentes Clínicos / Patológicos</label>
                <textarea
                  value={antecedentes}
                  onChange={(e) => setAntecedentes(e.target.value)}
                  placeholder="Alergias, tratamientos crónicos, cirugías recientes, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              {/* Diagnóstico */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Diagnóstico y Tratamiento *</label>
                <textarea
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  placeholder="Diagnóstico clínico conclusivo."
                  rows={2}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Nombre del Médico Evaluador */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  👨‍⚕️ Nombre del Médico Evaluador
                </label>
                <input
                  type="text"
                  value={nombreMedico}
                  onChange={(e) => setNombreMedico(e.target.value)}
                  placeholder="Ej. Dr. Carlos Mendoza Roca"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 bg-white placeholder:font-normal placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-500">Si lo dejas vacío, se guardará el nombre de la cuenta médica conectada.</p>
              </div>

              {/* Decisión de aprobación */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Resolución del Trámite</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Defina si el paciente está apto para portar carnet.</p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAprobado(true);
                      setDiagnostico('Apto para la manipulación de alimentos.');
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      aprobado 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Aprobado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAprobado(false);
                      setDiagnostico('No Apto temporalmente por diagnóstico clínico.');
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-all border ${
                      !aprobado 
                        ? 'bg-red-600 text-white border-red-600 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Rechazado
                  </button>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSharedData(null)}
                  className="w-full sm:w-auto text-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
                >
                  {submitting ? 'Emitiendo...' : 'Registrar Evaluación y Emitir'}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}
    </div>
  );
}
