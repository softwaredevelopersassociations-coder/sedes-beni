import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { FileText, Printer, Calendar, AlertCircle, TrendingUp, ShieldAlert, Award } from 'lucide-react';

export default function Reportes() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [reporteData, setReporteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReporte = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.estadisticas.getForm303(selectedMonth);
      setReporteData(data);
    } catch (err) {
      console.error(err);
      setError('Error al generar el Formulario 303.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReporte();
  }, [selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const getMonthName = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="space-y-6">
      
      {/* Header (Oculto en Impresión) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Generación de Reportes Oficiales</h2>
          <p className="text-xs text-slate-500 mt-1">Consolide reportes sanitarios y genere la planilla mensual de control Formulario 303.</p>
        </div>

        <div className="flex gap-2.5 items-center bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs outline-none font-bold text-slate-800 bg-transparent cursor-pointer"
          />
          <button
            onClick={handlePrint}
            disabled={loading || !reporteData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer size={14} />
            Imprimir Reporte
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2 print:hidden">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 print:hidden">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Procesando registros mensuales...</p>
        </div>
      ) : reporteData ? (
        <>
          {/* BANDEJA IMPRIMIBLE DEL FORMULARIO 303 */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0 print-area">
            
            {/* Cabecera Oficial */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-sm font-extrabold text-slate-900 tracking-wider">SEDES BENI - MINISTERIO DE SALUD Y DEPORTES</h1>
              <h2 className="text-xs font-bold text-slate-700 uppercase mt-0.5">Unidad de Salud Ambiental - Trinidad, Bolivia</h2>
              <h3 className="text-sm font-extrabold text-blue-900 mt-3.5 tracking-widest border border-slate-900 py-1.5 max-w-sm mx-auto uppercase">
                Formulario 303 - Control Epidemiológico
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-2 font-mono">
                PERIODO: {getMonthName(reporteData.mes)}
              </p>
            </div>

            {/* Ficha Resumen de Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center print:bg-white print:border-slate-300">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Evaluados</span>
                <span className="text-xl font-bold text-slate-900 block mt-1 font-mono">{reporteData.resumen.total_evaluados}</span>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center print:bg-white print:border-slate-300">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Aprobados</span>
                <span className="text-xl font-bold text-blue-700 block mt-1 font-mono">{reporteData.resumen.total_aprobados}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center print:bg-white print:border-slate-300">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Rechazados</span>
                <span className="text-xl font-bold text-red-600 block mt-1 font-mono">{reporteData.resumen.total_rechazados}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center print:bg-white print:border-slate-300 col-span-1">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Copro Positivos</span>
                <span className="text-xl font-bold text-amber-600 block mt-1 font-mono">{reporteData.resumen.total_copro_positivos}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-center print:bg-white print:border-slate-300 col-span-1">
                <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">VIH Reactivos</span>
                <span className="text-xl font-bold text-red-700 block mt-1 font-mono">{reporteData.resumen.total_vih_positivos}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              
              {/* Tabla Parasitos */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                  Prevalencia de Parásitos Detectados
                </h4>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold font-mono">
                        <th className="py-2 px-4">Especie Parasitaria</th>
                        <th className="py-2 px-4 text-right">Casos Registrados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700">
                      {reporteData.parasitos.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-slate-400 italic">No se detectaron parasitosis en el periodo.</td>
                        </tr>
                      ) : (
                        reporteData.parasitos.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{p.parasito}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">{p.cantidad}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla Rubros */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Award size={15} className="text-blue-600 shrink-0" />
                  Consolidado por Sectores / Ocupaciones
                </h4>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold font-mono">
                        <th className="py-2 px-4">Rubro Comercial</th>
                        <th className="py-2 px-4 text-center">Evaluados</th>
                        <th className="py-2 px-4 text-right">Aptos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-700">
                      {reporteData.rubros.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-slate-400 italic">Sin trámites evaluados en el periodo.</td>
                        </tr>
                      ) : (
                        reporteData.rubros.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-semibold text-slate-800">{r.ocupacion}</td>
                            <td className="py-2.5 px-4 text-center font-mono font-medium">{r.total}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700">{r.aprobados}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Firmas Oficiales al imprimir */}
            <div className="hidden print:flex justify-around items-end pt-20 text-[10px]">
              <div className="flex flex-col items-center">
                <span className="w-40 border-t border-slate-600" />
                <span className="font-bold text-slate-700 uppercase tracking-wider mt-1.5">Responsable Sanitario</span>
                <span className="text-[8px] text-slate-400">Unidad de Salud Ambiental</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="w-40 border-t border-slate-600" />
                <span className="font-bold text-slate-700 uppercase tracking-wider mt-1.5">Director SEDES Beni</span>
                <span className="text-[8px] text-slate-400">Firma y Sello Oficial</span>
              </div>
            </div>

          </div>
        </>
      ) : (
        <div className="text-slate-400 text-xs text-center py-12">No hay datos de reportes disponibles para el mes seleccionado.</div>
      )}

    </div>
  );
}
