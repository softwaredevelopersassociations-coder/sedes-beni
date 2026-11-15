import React, { useState } from 'react';
import frenteModelo from '../assets/cardex/carnet-nuevo-frente.png';
import reversoModelo from '../assets/cardex/carnet-nuevo-reverso.png';

export default function CarnetTemplate({ carnet, size = 'standard', defaultSide = 'both' }) {
  const [activeSide, setActiveSide] = useState(defaultSide);
  if (!carnet) return null;

  const isCR80 = size === 'cr80';
  // Medidas oficiales reales del carnet físico: 8,8 cm de largo (ancho) x 6,9 cm de altura para hoja Carta
  const cardWidth = isCR80 ? 86 : 88;
  const cardHeight = isCR80 ? 54 : 69;
  const sizeClass = isCR80 ? 'carnet-oficial-cr80' : 'carnet-oficial-standard';

  const cardStyle = {
    width: cardWidth + 'mm',
    height: cardHeight + 'mm',
    minWidth: cardWidth + 'mm',
    maxWidth: cardWidth + 'mm',
    minHeight: cardHeight + 'mm',
    maxHeight: cardHeight + 'mm',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    backgroundColor: '#ffde59',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  };

  const sangre = (() => {
    try {
      const q = typeof carnet.quimica_sanguinea === 'string'
        ? JSON.parse(carnet.quimica_sanguinea)
        : carnet.quimica_sanguinea;
      return {
        grupo: q?.grupo_sanguineo || '—',
        rh: q?.factor_rh || '—'
      };
    } catch {
      return { grupo: '—', rh: '—' };
    }
  })();

  const numCarnet = (() => {
    const fisico = carnet.numero_carnet_fisico || carnet.carnet_fisico;
    if (fisico && String(fisico).trim()) {
      const limpio = String(fisico).trim();
      return /^\d+$/.test(limpio) && limpio.length < 6 ? limpio.padStart(6, '0') : limpio;
    }
    if (!carnet.codigo_carnet) return '000001';
    const match = String(carnet.codigo_carnet).match(/\d+$/);
    if (match) return match[0].padStart(6, '0');
    const clean = String(carnet.codigo_carnet).replace(/[^0-9]/g, '');
    return clean ? clean.slice(-6).padStart(6, '0') : '000001';
  })();

  const lugarTrabajo = [carnet.empresa_trabajo, carnet.mercado ? '(' + carnet.mercado + ')' : '']
    .filter(Boolean).join(' ').trim().toUpperCase() || '—';

  const fechaValidez = (() => {
    if (!carnet.fecha_vencimiento) return '—';
    try {
      const d = new Date(carnet.fecha_vencimiento);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
    } catch {
      return '—';
    }
  })();

  const nombres = (carnet.nombres || '').trim().toUpperCase() || '—';
  const apellidos = (carnet.apellidos || '').trim().toUpperCase() || '—';
  const medicoNombre = carnet.nombre_medico || (typeof carnet.firma_medico === 'string' && !carnet.firma_medico.startsWith('data:') ? carnet.firma_medico : '') || '';

  const fieldStyle = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    height: '4.4%',
    boxSizing: 'border-box',
    padding: '0 1%',
    backgroundColor: '#ffde59',
    color: '#111111',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: isCR80 ? '6.8pt' : '7.2pt',
    fontWeight: 800,
    lineHeight: 1,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  const field = (key, value, placement) => (
    <div key={key} style={{ ...fieldStyle, ...placement }}>{value}</div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="print:hidden flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSide('front')}
          className={'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ' + (activeSide === 'front' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          Anverso (Frente)
        </button>
        <button
          type="button"
          onClick={() => setActiveSide('back')}
          className={'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ' + (activeSide === 'back' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          Reverso (Atrás)
        </button>
        <button
          type="button"
          onClick={() => setActiveSide('both')}
          className={'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ' + (activeSide === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100')}
        >
          Ambos lados
        </button>
      </div>

      <div className="carnet-print-pair flex flex-col md:flex-row gap-6 items-center justify-center">
        {(activeSide === 'front' || activeSide === 'both') && (
          <div className={`carnet-oficial ${sizeClass} carnet-anverso`} style={cardStyle}>
            <img
              src={frenteModelo}
              alt=""
              aria-hidden="true"
              draggable="false"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
            />
            <div style={{ position: 'absolute', top: '4.8%', right: '3.5%', width: '27%', height: '6%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#dc2626', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isCR80 ? '8pt' : '9pt', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              Nº {numCarnet}
            </div>

            {carnet.foto_url && (
              <img
                src={carnet.foto_url}
                alt="Foto del paciente"
                style={{ position: 'absolute', left: '9.7%', top: '32.8%', width: '28.1%', height: '41.9%', objectFit: 'cover' }}
              />
            )}

            {[
              field('nombres', nombres, { left: '56.6%', top: '31.7%', width: '38.5%' }),
              field('apellidos', apellidos, { left: '39.1%', top: '40.1%', width: '55.8%' }),
              field('actividad', (carnet.ocupacion || '').toUpperCase() || '—', { left: '48.2%', top: '46.8%', width: '46.2%' }),
              field('trabajo', lugarTrabajo, { left: '55.2%', top: '54.3%', width: '39.2%' }),
              field('grupo', sangre.grupo, { left: '57.5%', top: '61.9%', width: '12.5%' }),
              field('rh', sangre.rh, { left: '80.5%', top: '61.9%', width: '9%' }),
              field('validez', fechaValidez, { left: '53.6%', top: '69.6%', width: '42%' }),
            ]}
          </div>
        )}

        {(activeSide === 'back' || activeSide === 'both') && (
          <div className={`carnet-oficial ${sizeClass} carnet-reverso`} style={cardStyle}>
            <img
              src={reversoModelo}
              alt=""
              aria-hidden="true"
              draggable="false"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }}
            />
            {medicoNombre && (
              <div style={{ position: 'absolute', left: '18%', top: '71.8%', width: '64%', height: '4.5%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1%', boxSizing: 'border-box', backgroundColor: '#ffde59', color: '#111111', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isCR80 ? '6pt' : '6.5pt', fontWeight: 800, lineHeight: 1, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {medicoNombre}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
