import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Printer, AlertCircle, FileCheck2, Settings2, X } from 'lucide-react';
import CarnetTemplate from '../components/CarnetTemplate';

export default function EmisionCarnets() {
  const [carnets, setCarnets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedCarnet, setSelectedCarnet] = useState(null);
  const [printSize, setPrintSize] = useState('standard');

  const fetchCarnets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.pacientes.getAprobados();
      setCarnets(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al cargar la lista de carnets aprobados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarnets();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ===== PANTALLA PRINCIPAL (se oculta al imprimir) ===== */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Emisión y Backup de Carnets</h2>
            <p className="text-xs text-slate-500 mt-1">Gestione, revise e imprima los carnets sanitarios aprobados.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : carnets.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <FileCheck2 size={40} className="text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-500">No hay carnets pendientes de emisión.</p>
            <p className="text-[10px] text-slate-400 mt-1">Los carnets aparecerán aquí cuando un médico apruebe un trámite.</p>
          </div>
        ) : carnets.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Código Carnet</th>
                  <th className="py-3.5 px-6">Paciente</th>
                  <th className="py-3.5 px-6">Cédula</th>
                  <th className="py-3.5 px-6">Válido Hasta</th>
                  <th className="py-3.5 px-6 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {carnets.map(c => (
                  <tr key={c.tramite_id} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-mono font-bold text-blue-700">{c.codigo_carnet}</td>
                    <td className="py-3 px-6 font-semibold">{c.nombres} {c.apellidos}</td>
                    <td className="py-3 px-6 font-mono">{c.ci} {c.ci_exp}</td>
                    <td className="py-3 px-6">
                      {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => setSelectedCarnet(c)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-950 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Printer size={12} />
                        Ver / Imprimir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== MODAL DE PREVISUALIZACIÓN (se oculta al imprimir) ===== */}
      {selectedCarnet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Settings2 size={16} className="text-blue-600" />
                Configuración de Impresión
              </h3>
              <button onClick={() => setSelectedCarnet(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 flex flex-col items-center gap-6">
              {/* Selector de tamaño */}
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <label className={`cursor-pointer px-4 py-3 border-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${printSize === 'standard' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <input type="radio" name="size" value="standard" checked={printSize === 'standard'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                  📄 Cartulina Estándar (10 × 7.5 cm)
                </label>
                <label className={`cursor-pointer px-4 py-3 border-2 rounded-xl flex items-center gap-2 text-xs font-bold transition-all ${printSize === 'cr80' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <input type="radio" name="size" value="cr80" checked={printSize === 'cr80'} onChange={(e) => setPrintSize(e.target.value)} className="hidden" />
                  💳 Tarjeta PVC CR80 (8.6 × 5.4 cm)
                </label>
              </div>

              <div className="text-xs text-slate-500">Vista previa:</div>
              
              {/* Previsualización escalada y adaptable */}
              <div className="w-full flex justify-center overflow-x-auto py-2">
                <div className="scale-[0.8] sm:scale-110 md:scale-140 origin-top mb-16 sm:mb-24 md:mb-28">
                  <CarnetTemplate carnet={selectedCarnet} size={printSize} />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button onClick={() => setSelectedCarnet(null)} className="w-full sm:w-auto text-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer">
                Cancelar
              </button>
              <button onClick={handlePrint} className="w-full sm:w-auto justify-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer">
                <Printer size={15} />
                Proceder a Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ZONA DE IMPRESIÓN OFICIAL ===== */}
      {selectedCarnet && (
        <div className="hidden print:block print-area print-carnet-wrapper">
          <CarnetTemplate carnet={selectedCarnet} size={printSize} />
        </div>
      )}
    </div>
  );
}

