import React from 'react';
import { Printer } from 'lucide-react';

const MAX_PHOTO_COPIES = 12;

export function PatientPhotoPrintControls({ photoUrl, copies, onCopiesChange, onPrint }) {
  return (
    <section className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h4 className="text-xs font-bold text-blue-900">Foto independiente</h4>
        <p className="text-[10px] text-blue-700 mt-1">
          Hoja 10 × 15 cm · cada foto 3 × 3 cm · 300 ppp en la impresora
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="photo-print-copies" className="text-[10px] font-semibold text-slate-600">
          Copias
        </label>
        <select
          id="photo-print-copies"
          value={copies}
          onChange={(event) => onCopiesChange(Number(event.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"
          aria-label="Cantidad de fotos para imprimir"
        >
          {Array.from({ length: MAX_PHOTO_COPIES }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>{count}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onPrint}
          disabled={!photoUrl}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Printer size={14} />
          Imprimir foto
        </button>
      </div>
      {!photoUrl && <p className="w-full text-[10px] text-amber-700">Este paciente no tiene una foto registrada.</p>}
    </section>
  );
}
