import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

let _uid = 1;
const uid = () => ++_uid;

export default function OtrosAnalisis({ disabled = false, onChange, initialData = [] }) {
  const [items, setItems] = useState(
    initialData && initialData.length > 0 
      ? initialData.map(a => ({ id: uid(), analisis: a.analisis || '', resultado: a.resultado || '' }))
      : []
  );

  const notify = useCallback((list) => {
    if (onChange) {
      onChange(
        list
          .filter((a) => a.analisis.trim() && a.resultado.trim())
          .map((a) => ({ analisis: a.analisis.trim(), resultado: a.resultado.trim() }))
      );
    }
  }, [onChange]);

  const update = (id, field, value) => {
    setItems((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, [field]: value } : a));
      notify(next);
      return next;
    });
  };

  const add = () => {
    setItems((prev) => {
      const next = [...prev, { id: uid(), analisis: '', resultado: '' }];
      return next;
    });
  };

  const remove = (id) => {
    setItems((prev) => {
      const next = prev.filter((a) => a.id !== id);
      notify(next);
      return next;
    });
  };

  useEffect(() => {
    window.agregarOtroAnalisis = () => {
      setItems((prev) => {
        const next = [...prev, { id: uid(), analisis: '', resultado: '' }];
        return next;
      });
    };
    return () => {
      delete window.agregarOtroAnalisis;
    };
  }, []);

  return (
    <div id="seccion-otros-analisis" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Otros Análisis (Opcionales)</h3>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={add}
            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={13} />
            <span>+ Agregar Análisis</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
          <p className="text-xs text-slate-600 font-semibold">
            ¿Desea registrar algún otro análisis o parámetro adicional?
          </p>
          <p className="text-[11px] text-slate-400">
            Haga clic en el botón para ingresar el nombre de la prueba y su valor o descripción.
          </p>
          {!disabled && (
            <button
              type="button"
              onClick={add}
              className="mt-1 px-4 py-1.5 text-xs font-semibold text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>+ Agregar Análisis (Nombre y Valor / Descripción)</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="border border-purple-100 rounded-xl bg-purple-50/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                  Análisis #{index + 1}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                    title="Eliminar este análisis"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Nombre del análisis / parámetro
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Ácido Úrico, Hemoglobina, Colesterol, VDRL..."
                    value={item.analisis}
                    onChange={(e) => update(item.id, 'analisis', e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-500 bg-white disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Valor o Descripción / Resultado
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 150 mg/dL, Negativo, Normal, 13.5 g/dL..."
                    value={item.resultado}
                    onChange={(e) => update(item.id, 'resultado', e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-500 bg-white disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>
          ))}

          {!disabled && (
            <button
              type="button"
              onClick={add}
              className="w-full py-2 border-2 border-dashed border-purple-200 rounded-xl text-xs font-semibold text-purple-700 hover:border-purple-400 hover:bg-purple-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus size={13} />
              <span>+ Agregar otro análisis adicional</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
