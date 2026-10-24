import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { 
  Users, 
  Beaker, 
  Stethoscope, 
  CreditCard, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';

export default function Dashboard({ onNavigate, setSharedData }) {
  const { user, isAdmin, isLab, isMedico } = useAuth();
  
  // Estados para Admin
  const [resumen, setResumen] = useState(null);
  const [mensuales, setMensuales] = useState([]);
  const [labResumen, setLabResumen] = useState(null);
  const [auditorias, setAuditorias] = useState([]);

  // Estados para Lab / Médico
  const [pendientesLab, setPendientesLab] = useState([]);
  const [pendientesMed, setPendientesMed] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const [resData, monthlyData, labData, auditData] = await Promise.all([
          api.estadisticas.getResumen(),
          api.estadisticas.getMensuales(),
          api.estadisticas.getLabResumen(),
          api.estadisticas.getAuditoria()
        ]);
        setResumen(resData);
        setMensuales(monthlyData);
        setLabResumen(labData);
        setAuditorias(auditData.slice(0, 8)); // Mostrar solo las 8 más recientes
      }
      
      if (isLab || isAdmin) {
        const labPendientes = await api.laboratorios.getPendientes();
        setPendientesLab(labPendientes);
      }
      
      if (isMedico || isAdmin) {
        const medPendientes = await api.consultas.getPendientes();
        setPendientesMed(medPendientes);
      }
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
      setError('No se pudieron cargar los datos del dashboard. Verifica tu base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleSelectLabTramite = (tramite) => {
    setSharedData(tramite);
    onNavigate('laboratorio-formulario');
  };

  const handleSelectMedTramite = (tramite) => {
    setSharedData(tramite);
    onNavigate('medicina-formulario');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium animate-pulse">Cargando datos del sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-lg shadow-blue-950/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">¡Bienvenido de nuevo, {user?.nombre_completo}!</h2>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Sistema activo en la Unidad de Salud Ambiental del SEDES Beni.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-xs">
          <Calendar size={14} />
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* RENDER POR ROL: ADMINISTRADOR */}
      {isAdmin && resumen && (
        <>
          {/* Tarjetas de Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pacientes</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{resumen.total_pacientes}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                <Beaker size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cola Laboratorio</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{resumen.pendientes_laboratorio}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <Stethoscope size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cola Médica</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{resumen.pendientes_medicina}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-colors">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <CreditCard size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Carnets Vigentes</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{resumen.carnets_activos}</h3>
              </div>
            </div>
          </div>

          {/* Gráficos Estadísticos Simples mediante SVG */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Gráfico de Línea SVG - Emisión Mensual */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Tendencia de Emisión Mensual</h4>
                <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded-full text-slate-500">Últimos meses</span>
              </div>
              
              {mensuales.length === 0 ? (
                <div className="h-48 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  Sin datos suficientes para graficar
                </div>
              ) : (
                <div className="relative">
                  {/* SVG Line Chart */}
                  <svg viewBox="0 0 500 150" className="w-full h-48 overflow-visible">
                    {/* Grid Lines */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="65" x2="480" y2="65" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="110" x2="480" y2="110" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="130" x2="480" y2="130" stroke="#cbd5e1" strokeWidth="1.5" />
                    
                    {/* Draw Line Points */}
                    {(() => {
                      const maxVal = Math.max(...mensuales.map(m => parseInt(m.cantidad)), 5);
                      const points = mensuales.map((m, idx) => {
                        const x = 40 + (idx * (440 / Math.max(mensuales.length - 1, 1)));
                        const y = 130 - (parseInt(m.cantidad) * (110 / maxVal));
                        return { x, y, label: m.mes, val: m.cantidad };
                      });

                      const pathD = points.reduce((acc, p, idx) => {
                        return acc + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
                      }, '');

                      return (
                        <>
                          {/* Path Line */}
                          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          
                          {/* Area Fill */}
                          {points.length > 0 && (
                            <path 
                              d={`${pathD} L ${points[points.length - 1].x} 130 L ${points[0].x} 130 Z`} 
                              fill="url(#gradient-blue)" 
                              opacity="0.1" 
                            />
                          )}
                          
                          {/* Gradient definition */}
                          <defs>
                            <linearGradient id="gradient-blue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                            </linearGradient>
                          </defs>

                          {/* Points and Tooltips */}
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="4.5" fill="#2563eb" stroke="white" strokeWidth="1.5" className="cursor-pointer" />
                              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">
                                {p.val}
                              </text>
                              {/* X Axis Label */}
                              <text x={p.x} y="145" textAnchor="middle" fontSize="8" fontWeight="semibold" fill="#64748b">
                                {p.label.split('-')[1]}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

            {/* Panel de Casos de Laboratorio */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Resumen de Diagnósticos</h4>
                
                {labResumen ? (
                  <div className="space-y-4">
                    {/* Parasitológico */}
                    <div>
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                        <span>Coproparasitológicos Positivos</span>
                        <span className="text-amber-600">{labResumen.coproparasitologico.positivos} de {labResumen.coproparasitologico.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all" 
                          style={{ width: `${(labResumen.coproparasitologico.positivos / (labResumen.coproparasitologico.total || 1)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* VIH */}
                    <div>
                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                        <span>VIH Reactivos (Positivos)</span>
                        <span className="text-red-600">{labResumen.vih.positivos} de {labResumen.vih.total}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-red-500 h-full rounded-full transition-all" 
                          style={{ width: `${(labResumen.vih.positivos / (labResumen.vih.total || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs text-center py-6">Cargando diagnósticos...</div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-medium">Reportes oficiales consolidados</span>
                <button 
                  onClick={() => onNavigate('reportes')} 
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Ver Formulario 303
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Logs de Auditoría para Admin */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Bitácora de Auditoría Reciente</h4>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100">Seguridad</span>
            </div>
            
            {auditorias.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6 border border-dashed border-slate-200 rounded-xl">No hay registros de auditoría aún.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2">Fecha / Hora</th>
                      <th className="py-2">Usuario</th>
                      <th className="py-2">Acción</th>
                      <th className="py-2">Detalles</th>
                      <th className="py-2">Dirección IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditorias.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 whitespace-nowrap text-slate-500 font-mono">
                          {new Date(log.fecha).toLocaleString('es-ES', { hour12: false })}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-900">{log.nombre_completo || 'Sistema'} ({log.rol})</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-sm font-semibold font-mono text-[10px] ${
                            log.accion.includes('RECHAZO') ? 'bg-red-50 text-red-700 border border-red-100' :
                            log.accion.includes('APROBACION') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.accion}
                          </span>
                        </td>
                        <td className="py-2.5 max-w-xs truncate">{log.detalles}</td>
                        <td className="py-2.5 text-slate-500 font-mono">{log.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* RENDER POR ROL: OPERADOR DE LABORATORIO */}
      {(isLab || (isAdmin && activeTabLayout('lab'))) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cola Pendiente de Laboratorio</h3>
              <p className="text-xs text-slate-500 mt-0.5">Procedimientos registrados listos para la carga de exámenes clínicos.</p>
            </div>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5">
              <Activity size={12} className="animate-pulse" />
              {pendientesLab.length} Pendientes
            </span>
          </div>

          {pendientesLab.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Beaker size={36} className="text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-500">No hay trámites pendientes de laboratorio</p>
              <p className="text-[10px] text-slate-400 mt-1">Los trámites aparecerán aquí tras ser registrados en recepción.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendientesLab.map((tramite) => (
                <div 
                  key={tramite.tramite_id} 
                  className="border border-slate-200 hover:border-blue-400 rounded-xl p-5 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Paciente Card Header */}
                    <div className="flex gap-3 mb-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                        {tramite.foto_url ? (
                          <img src={tramite.foto_url} alt="Paciente" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg bg-slate-200">
                            {tramite.nombres[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 leading-snug truncate">
                          {tramite.nombres} {tramite.apellidos}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">CI: {tramite.ci} {tramite.ci_exp}</p>
                      </div>
                    </div>

                    {/* Tramite Details */}
                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Trámite:</span>
                        <span className="font-bold text-slate-700">{tramite.tipo_tramite}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Rubro:</span>
                        <span className="truncate max-w-[120px] font-medium text-slate-800">{tramite.ocupacion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Fecha Registro:</span>
                        <span>{new Date(tramite.fecha_inicio).toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectLabTramite(tramite)}
                    className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-blue-500/10"
                  >
                    <Beaker size={14} />
                    Cargar Laboratorios
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RENDER POR ROL: MÉDICO */}
      {(isMedico || (isAdmin && activeTabLayout('med'))) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cola Pendiente de Consulta Médica</h3>
              <p className="text-xs text-slate-500 mt-0.5">Pacientes con exámenes de laboratorio cargados, listos para evaluación final.</p>
            </div>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
              <Activity size={12} className="animate-pulse animate-duration-1000" />
              {pendientesMed.length} Pendientes
            </span>
          </div>

          {pendientesMed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Stethoscope size={36} className="text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-500">No hay trámites pendientes de consulta médica</p>
              <p className="text-[10px] text-slate-400 mt-1">Los trámites pasarán aquí una vez cargados sus resultados de laboratorio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendientesMed.map((tramite) => (
                <div 
                  key={tramite.tramite_id} 
                  className="border border-slate-200 hover:border-emerald-400 rounded-xl p-5 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Paciente Card Header */}
                    <div className="flex gap-3 mb-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                        {tramite.foto_url ? (
                          <img src={tramite.foto_url} alt="Paciente" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg bg-slate-200">
                            {tramite.nombres[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 leading-snug truncate">
                          {tramite.nombres} {tramite.apellidos}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">CI: {tramite.ci} {tramite.ci_exp}</p>
                      </div>
                    </div>

                    {/* Tramite Details */}
                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Trámite:</span>
                        <span className="font-bold text-slate-700">{tramite.tipo_tramite}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Rubro:</span>
                        <span className="truncate max-w-[120px] font-medium text-slate-800">{tramite.ocupacion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-400">Laboratorio:</span>
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 rounded-sm">
                          Cargado ({new Date(tramite.lab_fecha).toLocaleDateString()})
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectMedTramite(tramite)}
                    className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-emerald-500/10"
                  >
                    <Stethoscope size={14} />
                    Evaluar Clínicamente
                    <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Utilidad auxiliar para Layout de tabs de prueba en cuenta de Admin
function activeTabLayout(tabName) {
  // En este MVP, el administrador puede visualizar todas las bandejas integradas en su dashboard
  return true; 
}
