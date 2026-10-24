import React, { useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

let _uid = 1;
const uid = () => ++_uid;

export default function OtrosAnalisis({ disabled = false, onChange }) {
  const [items, setItems] = useState([{ id: uid(), analisis: '', resultado: '' }]);

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
    setItems((prev) => [...prev, { id: uid(), analisis: '', resultado: '' }]);
  };

  const remove = (id) => {
    setItems((prev) => {
      const next = prev.filter((a) => a.id !== id);
      const final = next.length === 0 ? [{ id: uid(), analisis: '', resultado: '' }] : next;
      notify(final);
      return final;
    });
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Otros Analisis</h3>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={add}
            className="px-2.5 py-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus size={10} />
            Agregar
          </button>
        )}
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="border border-slate-200 rounded-xl bg-slate-50/40 overflow-hidden">
            <div className="p-3 flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">#{index + 1}</span>
              <input
                type="text"
                placeholder="Nombre del analisis (ej. Chagas, Hemoglobina...)"
                value={item.analisis}
                onChange={(e) => update(item.id, 'analisis', e.target.value)}
                disabled={disabled}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-500 bg-white disabled:bg-slate-100"
              />
              {!disabled && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="px-3 pb-3">
              <label className="block text-[10px] font-semibold text-slate-500 mb-1">Resultado</label>
              <input
                type="text"
                placeholder="ej. No Reactivo, Reactivo, 12.5 mg/dL..."
                value={item.resultado}
                onChange={(e) => update(item.id, 'resultado', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-purple-500 bg-white disabled:bg-slate-100"
              />
            </div>
          </div>
        ))}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          Agregar otro analisis
        </button>
      )}
    </div>
  );
}
