import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { AlertCircle, FileCheck2, Edit3, Printer } from 'lucide-react';
import CarnetOverprintEditor, { PrintOverprintFields } from '../components/CarnetOverprintEditor';

export default function EmisionCarnets() {
  const [carnets, setCarnets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedCarnet, setSelectedCarnet] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [printWithBackground, setPrintWithBackground] = useState(false);

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

  const openEditor = (carnet) => {
    setSelectedCarnet(carnet);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleQuickPrint = (carnet, withBg = false) => {
    setSelectedCarnet(carnet);
    setPrintWithBackground(withBg);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* ===== PANTALLA PRINCIPAL ===== */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Emisión y Backup de Carnets</h2>
            <p className="text-xs text-slate-500 mt-1">Gestione, revise e imprima los carnets sanitarios oficiales de SEDES Beni.</p>
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Código Carnet</th>
                  <th className="py-3.5 px-6">Paciente</th>
                  <th className="py-3.5 px-6">Cédula</th>
                  <th className="py-3.5 px-6">Válido Hasta</th>
                  <th className="py-3.5 px-6 text-center">Acciones de Impresión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {carnets.map(c => (
                  <tr key={c.tramite_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 font-mono font-bold text-blue-700">{c.codigo_carnet}</td>
                    <td className="py-3 px-6 font-semibold">{c.nombres} {c.apellidos}</td>
                    <td className="py-3 px-6 font-mono">{c.ci} {c.ci_exp}</td>
                    <td className="py-3 px-6">
                      {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="py-3 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleQuickPrint(c, true)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Imprime el carnet con su diseño oficial completo en hoja limpia o cartulina"
                        >
                          <Printer size={12} />
                          Carnet Completo
                        </button>
                        <button
                          onClick={() => handleQuickPrint(c, false)}
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Imprime sólo los datos sobre la cartulina del carnet ya preimpreso"
                        >
                          <Printer size={12} />
                          Sobreimpresión
                        </button>
                        <button
                          onClick={() => openEditor(c)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-slate-300"
                          title="Ajustar posiciones milimétricas de los textos"
                        >
                          <Edit3 size={12} />
                          Calibrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== EDITOR Y CALIBRADOR DE CARNET ===== */}
      {showEditor && selectedCarnet && (
        <CarnetOverprintEditor
          carnetData={selectedCarnet}
          onPrint={handlePrint}
          onClose={closeEditor}
        />
      )}

      {/* ===== ZONA DE IMPRESIÓN (activada por window.print) ===== */}
      {selectedCarnet && (
        <div className="hidden print:block print-page crop-marks">
          <div className="crop-mark tl" />
          <div className="crop-mark tr" />
          <div className="crop-mark bl" />
          <div className="crop-mark br" />
          <PrintOverprintFields carnetData={selectedCarnet} includeBackground={printWithBackground} />
        </div>
      )}
    </div>
  );
}