import React, { useState } from 'react';
import logo from '../assets/logo.jpeg';

/**
 * CarnetTemplate — Réplica exacta del carnet sanitario físico oficial del SEDES Beni.
 * Formato oficial calibrado: 9 cm de anchura x 7 cm de altura (90mm x 70mm).
 */
export default function CarnetTemplate({ carnet, size = 'standard', defaultSide = 'both' }) {
  if (!carnet) return null;

  // Estado para alternar entre Frente (Anverso), Atrás (Reverso) o Ambos Lados
  const [activeSide, setActiveSide] = useState(defaultSide);

  // Extraer grupo sanguíneo
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

  // Dimensiones oficiales exactas: 9 cm de anchura x 7 cm de altura (90 mm x 70 mm)
  const isCR80 = size === 'cr80';
  const cardW = isCR80 ? '86mm' : '90mm';
  const cardH = isCR80 ? '54mm' : '70mm';
  const s = isCR80 ? 0.75 : 0.96;

  // Formatear el número de carnet oficial
  const numCarnet = (() => {
    const fisico = carnet.numero_carnet_fisico || carnet.carnet_fisico;
    if (fisico && String(fisico).trim()) {
      const limpio = String(fisico).trim();
      return /^\d+$/.test(limpio) && limpio.length < 6 ? limpio.padStart(6, '0') : limpio;
    }
    if (!carnet.codigo_carnet) return '000001';
    const match = String(carnet.codigo_carnet).match(/\d+$/);
    if (match) {
      return match[0].padStart(6, '0');
    }
    const clean = String(carnet.codigo_carnet).replace(/[^0-9]/g, '');
    return clean ? clean.slice(-6).padStart(6, '0') : '000001';
  })();

  // Formatear lugar de trabajo
  const lugarTrabajo = [
    carnet.empresa_trabajo,
    carnet.mercado ? `(${carnet.mercado})` : ''
  ].filter(Boolean).join(' ').trim().toUpperCase() || '—';

  // Formatear fecha de validez
  const fechaValidez = (() => {
    if (!carnet.fecha_vencimiento) return '—';
    try {
      const d = new Date(carnet.fecha_vencimiento);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
    } catch {
      return '—';
    }
  })();

  const nombreCompleto = `${carnet.nombres || ''} ${carnet.apellidos || ''}`.trim().toUpperCase();
  const medicoNombre = carnet.nombre_medico || (typeof carnet.firma_medico === 'string' && !carnet.firma_medico.startsWith('data:') ? carnet.firma_medico : '') || '';

  // Contenedor base de la tarjeta (90x70 mm)
  const cardStyle = {
    width: cardW,
    height: cardH,
    minWidth: cardW,
    maxWidth: cardW,
    minHeight: cardH,
    maxHeight: cardH,
    fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
    backgroundColor: '#FDE047', // Amarillo oficial de cartulina física
    border: '1.2px solid #ca8a04',
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    padding: '2.5mm 3.2mm 2.5mm 3.2mm',
    color: '#000000',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Selector de vistas (Oculto al imprimir) */}
      <div className="print:hidden flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveSide('front')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSide === 'front' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Anverso (Frente)
        </button>
        <button
          type="button"
          onClick={() => setActiveSide('back')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSide === 'back' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Reverso (Atrás)
        </button>
        <button
          type="button"
          onClick={() => setActiveSide('both')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeSide === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ambos Lados (9 × 7 cm)
        </button>
      </div>

      {/* ZONA DE CARNETS (ANVERSO / REVERSO) */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
        
        {/* ==================== ANVERSO (FRENTE) 90 x 70 mm ==================== */}
        {(activeSide === 'front' || activeSide === 'both') && (
          <div className="carnet-oficial carnet-anverso" style={cardStyle}>
            
            {/* 1. Encabezado Institucional (Alto: ~12mm) */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2mm' }}>
              {/* Escudo + Textos Institucionales */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', width: '56%' }}>
                <img
                  src={logo}
                  alt="Escudo SEDES"
                  style={{
                    width: `${12 * s}mm`,
                    height: `${12 * s}mm`,
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                    flexShrink: 0
                  }}
                />
                <div style={{ textAlign: 'left', fontSize: `${4.5 * s}pt`, lineHeight: 1.15, fontWeight: 700, color: '#000' }}>
                  GOBIERNO AUTÓNOMO DEPARTAMENTAL DEL BENI<br />
                  <span style={{ fontSize: `${4.4 * s}pt`, color: '#166534', fontWeight: 800 }}>SERVICIO DEPARTAMENTAL DE SALUD - SEDES BENI</span><br />
                  UNIDAD SALUD AMBIENTAL
                </div>
              </div>

              {/* Nº en Rojo + CARNET SANITARIO */}
              <div style={{ width: '44%', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ color: '#dc2626', fontWeight: 900, fontSize: `${10 * s}pt`, display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                  <span style={{ fontSize: `${8 * s}pt` }}>Nº</span>
                  <span style={{ fontFamily: "'Courier New', monospace", letterSpacing: '0.8px' }}>
                    {numCarnet}
                  </span>
                </div>
                <div style={{ fontWeight: 900, fontSize: `${9 * s}pt`, letterSpacing: '0.3px', color: '#000', marginTop: '0.5px' }}>
                  CARNET SANITARIO
                </div>
              </div>
            </div>

            {/* 2. Cuerpo Central: Foto a la izquierda | Datos oficiales a la derecha (Alto: ~35mm) */}
            <div style={{ display: 'flex', width: '100%', gap: '2.5mm', alignItems: 'flex-start' }}>
              
              {/* Columna Izquierda: Recuadro Foto (23 x 27 mm) */}
              <div style={{ width: `${23 * s}mm`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div
                  style={{
                    width: `${23 * s}mm`,
                    height: `${28 * s}mm`,
                    border: '1.5px solid #000',
                    backgroundColor: '#fff',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {carnet.foto_url ? (
                    <img
                      src={carnet.foto_url}
                      alt="Foto"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: `${5.5 * s}pt`, color: '#666', fontWeight: 'bold' }}>FOTO</span>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Campos Oficiales Punteados */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1mm', fontSize: `${6.5 * s}pt`, color: '#000', minWidth: 0 }}>
                
                {/* Nombre y Apellidos */}
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Nombre y Apellidos:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '2px', fontWeight: 800, fontSize: `${6.8 * s}pt`, paddingLeft: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nombreCompleto || '—'}
                  </span>
                </div>
                {/* Segunda línea de continuidad */}
                <div style={{ borderBottom: '1px dotted #000', width: '100%', height: '1.5mm' }} />

                {/* Actividad */}
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Actividad:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '2px', fontWeight: 800, paddingLeft: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(carnet.ocupacion || '').toUpperCase() || '—'}
                  </span>
                </div>

                {/* Lugar de Trabajo */}
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Lugar de Trabajo:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '2px', fontWeight: 800, paddingLeft: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lugarTrabajo}
                  </span>
                </div>

                {/* Grupo Sanguíneo y Factor Rh */}
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Grupo Sanguineo:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '2px', marginRight: '3px', fontWeight: 800, textAlign: 'center' }}>
                    {sangre.grupo && sangre.grupo !== '—' ? `"${sangre.grupo}"` : '—'}
                  </span>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Factor Rh:</span>
                  <span style={{ minWidth: `${9 * s}mm`, borderBottom: '1px dotted #000', marginLeft: '2px', fontWeight: 800, textAlign: 'center' }}>
                    {sangre.rh && sangre.rh !== '—' ? `(${sangre.rh})` : '—'}
                  </span>
                </div>

                {/* Fecha de Validez */}
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Fecha de validez:</span>
                  <span style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '2px', fontWeight: 800, paddingLeft: '3px' }}>
                    {fechaValidez}
                  </span>
                </div>

              </div>
            </div>

            {/* 3. Pie: RESP. DE UNIDAD EN MEDIO (Alto: ~14mm) */}
            <div
              style={{
                position: 'absolute',
                bottom: '2.5mm',
                left: '0',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  width: '46mm',
                  borderBottom: '1.2px dotted #000',
                  height: '4mm',
                  marginBottom: '1.5px'
                }}
              />
              <span
                style={{
                  fontSize: `${5.8 * s}pt`,
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: '#000'
                }}
              >
                RESP. DE UNIDAD
              </span>
            </div>

          </div>
        )}

        {/* ==================== REVERSO (ATRÁS) 90 x 70 mm ==================== */}
        {(activeSide === 'back' || activeSide === 'both') && (
          <div className="carnet-oficial carnet-reverso" style={cardStyle}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', position: 'relative' }}>
              
              {/* Título IMPORTANTE */}
              <div style={{ textAlign: 'center', marginTop: '2.5mm' }}>
                <h3 style={{ fontSize: `${10.5 * s}pt`, fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: '#000', margin: 0 }}>
                  IMPORTANTE
                </h3>
              </div>

              {/* Texto Legal Oficial */}
              <div style={{ padding: '0 3mm', marginTop: '4mm', textAlign: 'justify', lineHeight: 1.35, fontSize: `${7 * s}pt`, fontWeight: 700, color: '#111' }}>
                Todo persona que fabrique, manipule, expenda alimentos, bebidas o que tenga contacto con el público esta obligado a recabar este documento de acuerdo al <strong>CODIGO DE SALUD</strong>.
              </div>

              {/* Firma Médico al pie (Centrado en medio) */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '3mm',
                  left: '0',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center'
                }}
              >
                {medicoNombre ? (
                  <span style={{ fontSize: `${6.2 * s}pt`, fontWeight: 800, color: '#000', marginBottom: '1px', textTransform: 'uppercase' }}>
                    {medicoNombre}
                  </span>
                ) : (
                  <div style={{ height: '4mm' }} />
                )}
                <div style={{ width: '48mm', borderBottom: '1.2px dotted #000', height: medicoNombre ? '1.5mm' : '4.5mm', marginBottom: '1.5px' }} />
                <span style={{ fontSize: `${5.8 * s}pt`, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#000' }}>
                  FIRMA MÉDICO
                </span>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
