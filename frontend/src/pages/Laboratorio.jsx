import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Beaker, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, UserCheck, Plus } from 'lucide-react';
import OtrosAnalisis from '../components/OtrosAnalisis';




export default function Laboratorio({ sharedData, setSharedData, onNavigate }) {
  // Si no hay trámite seleccionado, mostramos la lista de pendientes de laboratorio
  const [pendientes, setPendientes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  // Campos del formulario
  const [glucosa, setGlucosa] = useState('90');
  const [urea, setUrea] = useState('30');
  const [creatinina, setCreatinina] = useState('0.8');
  
  const [grupoSanguineo, setGrupoSanguineo] = useState('O');
  const [factorRh, setFactorRh] = useState('+');
  
  // Coproparasitológico — campos libres según ficha KARDEX oficial
  const [copro_aspecto, setCoproAspecto] = useState('');
  const [copro_moco, setCoproMoco] = useState('');
  const [copro_sangre, setCoproSangre] = useState('');
  const [copro_microscopico, setCoproMicroscopico] = useState('');
  
  const [vihResultado, setVihResultado] = useState('No Reactivo');
  const [consentimiento, setConsentimiento] = useState(false);
  
const [observaciones, setObservaciones] = useState('');
  const [otrosAnalisis, setOtrosAnalisis] = useState([]);
   
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPendientes = async () => {
    setLoadingList(true);
    try {
      const data = await api.laboratorios.getPendientes();
      setPendientes(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar la lista de pendientes de laboratorio.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!sharedData) {
      loadPendientes();
    }
  }, [sharedData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!sharedData) return;

    if (!glucosa || !urea || !creatinina) {
      setError('Por favor, rellene todos los campos obligatorios del análisis de laboratorio.');
      return;
    }

    if (!consentimiento) {
      setError('Debe confirmar y marcar que cuenta con el Consentimiento Informado Firmado por el paciente para procesar la prueba de VIH.');
      return;
    }

    setSubmitting(true);

    const payload = {
      quimica_sanguinea: {
        glucosa: parseFloat(glucosa),
        urea: parseFloat(urea),
        creatinina: parseFloat(creatinina),
        grupo_sanguineo: grupoSanguineo,
        factor_rh: factorRh
      },
      coproparasitologico: {
        aspecto: copro_aspecto,
        moco: copro_moco,
        sangre_macroscopica: copro_sangre,
        sangre: copro_sangre,
        examen_microscopico: copro_microscopico,
        parasito: copro_microscopico || 'Negativo',
        consistencia: copro_aspecto
      },
      vih: {
        resultado: vihResultado,
        consentimiento
      },
      observaciones,
      otros_analisis: otrosAnalisis
    };

    try {
      await api.laboratorios.saveResults(sharedData.tramite_id, payload);
      setSuccess('Resultados de laboratorio registrados con éxito. Trámite derivado al área médica.');
      
      // Limpiar datos compartidos después de un éxito
      setTimeout(() => {
        setSharedData(null);
        onNavigate('dashboard');
      }, 2000);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al guardar los resultados.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectTramite = (tramite) => {
    setSharedData(tramite);
    setError('');
    setSuccess('');
  };

  // VISTA 1: NO SELECCIONADO (Mostrar bandeja de pendientes)
  if (!sharedData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Bandeja de Laboratorio</h2>
          <p className="text-xs text-slate-500 mt-1">Seleccione un paciente de la lista para cargar sus resultados de análisis clínicos.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loadingList ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Buscando trámites pendientes...</p>
          </div>
        ) : pendientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Beaker size={40} className="text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-500">No hay pacientes esperando exámenes en laboratorio</p>
            <p className="text-[10px] text-slate-400 mt-1">Los trámites aparecerán aquí tras ser registrados en recepción.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Foto</th>
                  <th className="py-3.5 px-6">Paciente / CI</th>
                  <th className="py-3.5 px-6">Ocupación / Rubro</th>
                  <th className="py-3.5 px-6">Tipo Trámite</th>
                  <th className="py-3.5 px-6">Fecha Solicitud</th>
                  <th className="py-3.5 px-6 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pendientes.map((p) => (
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
                    <td className="py-3 px-6 font-medium text-slate-800">{p.ocupacion}</td>
                    <td className="py-3 px-6">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md font-bold text-[10px]">
                        {p.tipo_tramite}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-500">
                      {new Date(p.fecha_inicio).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => handleSelectTramite(p)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        Cargar Lab
                        <ArrowRight size={12} />
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

  // VISTA 2: FORMULARIO ACTIVO PARA CARGA DE RESULTADOS
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSharedData(null)}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Registro de Laboratorio Clínico</h2>
          <p className="text-xs text-slate-500 mt-1">Trámite ID: #{sharedData.tramite_id} para {sharedData.nombres} {sharedData.apellidos}.</p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-xl flex items-center gap-2.5 shadow-xs">
          <CheckCircle className="shrink-0" size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjeta Resumen del Paciente */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
          {sharedData.foto_url ? (
            <img src={sharedData.foto_url} alt="Paciente" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-200">
              {sharedData.nombres[0]}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 text-xs w-full">
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Paciente</p>
            <p className="font-bold text-slate-900 truncate">{sharedData.nombres} {sharedData.apellidos}</p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Cédula de Identidad</p>
            <p className="font-bold text-slate-900 font-mono">{sharedData.ci} {sharedData.ci_exp}</p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Ocupación</p>
            <p className="font-medium text-slate-850 truncate">{sharedData.ocupacion}</p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Empresa / Negocio</p>
            <p className="font-medium text-slate-850 truncate">{sharedData.empresa_trabajo || 'Independiente'}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Módulo 1: Química Sanguínea */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
              <Beaker size={16} className="text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Química Sanguínea</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Glucosa (mg/dL) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={glucosa}
                  onChange={(e) => setGlucosa(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Rango de ref: 70 - 110 mg/dL</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Urea (mg/dL) *</label>
                <input
                  type="number"
                  step="0.1"
                  value={urea}
                  onChange={(e) => setUrea(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Rango de ref: 15 - 45 mg/dL</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Creatinina (mg/dL) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={creatinina}
                  onChange={(e) => setCreatinina(e.target.value)}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Rango de ref: 0.6 - 1.2 mg/dL</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Grupo Sang. *</label>
                  <select
                    value={grupoSanguineo}
                    onChange={(e) => setGrupoSanguineo(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Factor Rh *</label>
                  <select
                    value={factorRh}
                    onChange={(e) => setFactorRh(e.target.value)}
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="+">Positivo (+)</option>
                    <option value="-">Negativo (-)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Módulo 2: Coproparasitológico */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
              <Beaker size={16} className="text-amber-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Coproparasitológico</h3>
            </div>

            {/* Examen Macroscópico */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Examen Macroscópico</p>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Aspecto</label>
                <input
                  type="text"
                  value={copro_aspecto}
                  onChange={(e) => setCoproAspecto(e.target.value)}
                  placeholder="Ej. Amarillo oscuro"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Moco</label>
                <input
                  type="text"
                  value={copro_moco}
                  onChange={(e) => setCoproMoco(e.target.value)}
                  placeholder="Ej. Ausente / Presente"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sangre (macroscópica)</label>
                <input
                  type="text"
                  value={copro_sangre}
                  onChange={(e) => setCoproSangre(e.target.value)}
                  placeholder="Ej. Ausente / Presente"
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Examen Microscópico Directo */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Examen Microscópico Directo</p>
              <textarea
                value={copro_microscopico}
                onChange={(e) => setCoproMicroscopico(e.target.value)}
                placeholder="Ej. No se observan parásitos intestinales / Se observan quistes de Giardia lamblia..."
                rows={3}
                disabled={submitting}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Módulo 3: Inmunología / VIH */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
              <Beaker size={16} className="text-red-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Inmunología (VIH)</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Resultado Prueba VIH *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="vih_res"
                      value="No Reactivo"
                      checked={vihResultado === 'No Reactivo'}
                      onChange={() => setVihResultado('No Reactivo')}
                      disabled={submitting}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    No Reactivo (Negativo)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="vih_res"
                      value="Reactivo"
                      checked={vihResultado === 'Reactivo'}
                      onChange={() => setVihResultado('Reactivo')}
                      disabled={submitting}
                      className="text-red-600 focus:ring-red-500"
                    />
                    Reactivo (Positivo)
                  </label>
                </div>
              </div>

              {/* Checkbox Consentimiento Informado */}
              <div className="p-3 bg-red-50/50 border border-red-200/50 rounded-lg">
                <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentimiento}
                    onChange={(e) => setConsentimiento(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-[10px] leading-relaxed font-semibold text-slate-600">
                    Confirmo que el expediente del paciente cuenta con el **Consentimiento Informado Firmado** para la prueba voluntaria de VIH. *
                  </span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* Módulo 4: Otros Análisis */}
        <OtrosAnalisis
          ref={(el) => { window.otrosAnalisisRef = el; }}
          disabled={submitting}
          initialData={otrosAnalisis}
          onChange={setOtrosAnalisis}
        />

        {/* Observaciones generales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Observaciones de Laboratorio</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Comentarios sobre muestras hemolizadas, parásitos comensales, etc."
            rows={2}
            disabled={submitting}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
          />
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
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
            className="w-full sm:w-auto justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
          >
            {submitting ? 'Guardando...' : 'Registrar y Derivar a Medicina'}
            <ArrowRight size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
