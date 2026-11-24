import React, { useState, useEffect } from 'react';
import { Sliders, RotateCcw, Check, Eye, EyeOff, Camera, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import escudoBeni from '../assets/cardex/Escudo_del_Beni.png';
import { PHOTO_PRINT_SIZE_MM } from '../utils/photoPrintSettings';

const CALIBRATION_STORAGE_KEY = 'carnet_calibration_v2';
const PRINT_MODE_STORAGE_KEY = 'carnet_print_mode_v2';
const ACTIVE_SIDE_STORAGE_KEY = 'carnet_active_side_v2';

export default function CarnetTemplate({ carnet, size = 'standard', defaultSide = 'both', isPrintArea = false }) {
  // PRIMERA OPCIÓN POR DEFECTO: 'data_only' (Sobreimpresión solo datos)
  // SEGUNDA OPCIÓN: 'official' (Carnet completo con reverso)
  const [printMode, setPrintMode] = useState(() => {
    try {
      const saved = localStorage.getItem(PRINT_MODE_STORAGE_KEY);
      if (saved === 'official' || saved === 'data_only') return saved;
      return 'data_only';
    } catch {
      return 'data_only';
    }
  });

  const [activeSide, setActiveSide] = useState(() => {
    try {
      const savedMode = localStorage.getItem(PRINT_MODE_STORAGE_KEY);
      if (savedMode === 'data_only') return 'front';
      const savedSide = localStorage.getItem(ACTIVE_SIDE_STORAGE_KEY);
      if (savedSide) return savedSide;
    } catch {}
    return printMode === 'data_only' ? 'front' : defaultSide;
  });

  // Estado de calibración milimétrica para alinear la sobreimpresión
  const [calibration, setCalibration] = useState(() => {
    const defaultCal = {
      offsetX: 0,
      offsetY: 0,
      includePhoto: true,
      showGhostGuide: true,
      lineOffsets: {
        codigo: { x: 0, y: 0 },
        linea1: { x: 0, y: 0 },
        linea2: { x: 0, y: 0 },
        actividad: { x: 0, y: 0 },
        trabajo: { x: 0, y: 0 },
        sangre: { x: 0, y: 0 },
        fecha: { x: 0, y: 0 },
        foto: { x: 0, y: 0 }
      }
    };
    try {
      const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultCal,
          ...parsed,
          lineOffsets: { ...defaultCal.lineOffsets, ...(parsed.lineOffsets || {}) }
        };
      }
    } catch {}
    return defaultCal;
  });

  const [showAdvancedOffsets, setShowAdvancedOffsets] = useState(false);

  // Sincronizar solo la instancia oculta de impresión con los cambios hechos en la vista previa
  useEffect(() => {
    if (!isPrintArea) return;

    const handleSync = () => {
      try {
        const savedMode = localStorage.getItem(PRINT_MODE_STORAGE_KEY);
        if (savedMode && (savedMode === 'data_only' || savedMode === 'official')) {
          setPrintMode(savedMode);
          if (savedMode === 'data_only') {
            setActiveSide('front');
          }
        }
        const savedSide = localStorage.getItem(ACTIVE_SIDE_STORAGE_KEY);
        if (savedSide && savedMode !== 'data_only') {
          setActiveSide(savedSide);
        }
        const savedCal = localStorage.getItem(CALIBRATION_STORAGE_KEY);
        if (savedCal) setCalibration(JSON.parse(savedCal));
      } catch {}
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('carnet_settings_changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('carnet_settings_changed', handleSync);
    };
  }, [isPrintArea]);

  // Guardar calibración en localStorage y notificar a la instancia de impresión
  const updateCalibration = (updates) => {
    setCalibration(prev => {
      const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      try {
        localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('carnet_settings_changed'));
      } catch {}
      return next;
    });
  };

  const handlePrintModeChange = (mode) => {
    setPrintMode(mode);
    if (mode === 'data_only') {
      setActiveSide('front'); // En modo solo datos nunca hay reverso
    }
    try {
      localStorage.setItem(PRINT_MODE_STORAGE_KEY, mode);
      window.dispatchEvent(new Event('carnet_settings_changed'));
    } catch {}
  };

  const handleActiveSideChange = (side) => {
    setActiveSide(side);
    try {
      localStorage.setItem(ACTIVE_SIDE_STORAGE_KEY, side);
      window.dispatchEvent(new Event('carnet_settings_changed'));
    } catch {}
  };

  const resetCalibration = () => {
    const resetValues = {
      offsetX: 0,
      offsetY: 0,
      includePhoto: true,
      showGhostGuide: true,
      lineOffsets: {
        codigo: { x: 0, y: 0 },
        linea1: { x: 0, y: 0 },
        linea2: { x: 0, y: 0 },
        actividad: { x: 0, y: 0 },
        trabajo: { x: 0, y: 0 },
        sangre: { x: 0, y: 0 },
        fecha: { x: 0, y: 0 },
        foto: { x: 0, y: 0 }
      }
    };
    updateCalibration(resetValues);
  };

  const updateLineOffset = (field, axis, delta) => {
    setCalibration(prev => {
      const current = prev.lineOffsets?.[field] || { x: 0, y: 0 };
      const nextVal = Math.round((current[axis] + delta) * 10) / 10;
      const next = {
        ...prev,
        lineOffsets: {
          ...prev.lineOffsets,
          [field]: { ...current, [axis]: nextVal }
        }
      };
      try {
        localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('carnet_settings_changed'));
      } catch {}
      return next;
    });
  };

  if (!carnet) return null;

  const isCR80 = size === 'cr80';
  const cardWidth = isCR80 ? 86 : 88;
  const cardHeight = isCR80 ? 54 : 69;
  const sizeClass = isCR80 ? 'carnet-oficial-cr80' : 'carnet-oficial-standard';

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
    if (!carnet.codigo_carnet) return '000385';
    const match = String(carnet.codigo_carnet).match(/\d+$/);
    if (match) return match[0].padStart(6, '0');
    const clean = String(carnet.codigo_carnet).replace(/[^0-9]/g, '');
    return clean ? clean.slice(-6).padStart(6, '0') : '000385';
  })();

  const lugarTrabajo = [carnet.empresa_trabajo, carnet.mercado ? '(' + carnet.mercado + ')' : '']
    .filter(Boolean).join(' ').trim().toUpperCase() || '—';

  const fechaValidez = (() => {
    if (!carnet.fecha_vencimiento) return '—';
    try {
      const value = String(carnet.fecha_vencimiento);
      // PostgreSQL DATE se serializa como YYYY-MM-DD; formatear sus partes evita
      // que zonas horarias al oeste de UTC lo muestren como el día anterior.
      const dateParts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateParts) return `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}`;
      const d = new Date(value);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
    } catch {
      return '—';
    }
  })();

  const nombres = (carnet.nombres || '').trim().toUpperCase();
  const apellidos = (carnet.apellidos || '').trim().toUpperCase();

  // Distribución en las dos rayas para Nombre y Apellidos (exacto al carnet físico real)
  let linea1Nombre = nombres;
  let linea2Nombre = apellidos;

  if (!linea2Nombre && nombres.length > 18) {
    const palabras = nombres.split(' ');
    if (palabras.length > 1) {
      const mitad = Math.ceil(palabras.length / 2);
      linea1Nombre = palabras.slice(0, mitad).join(' ');
      linea2Nombre = palabras.slice(mitad).join(' ');
    }
  }

  const actividadTexto = (carnet.ocupacion || '').trim().toUpperCase() || '—';

  // Factor de escala para tarjeta PVC CR80
  const s = isCR80 ? 54 / 69 : 1;

  // Reducir el valor hasta que quepa en el espacio real disponible de su renglón.
  const getDynamicStyle = (text, maxWidthMm, basePt = 8.5) => {
    let fontSize = basePt;
    const value = String(text || '');

    if (value && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = `700 ${basePt}pt Arial`;
        const measuredWidth = context.measureText(value).width;
        const availableWidth = (maxWidthMm * 96) / 25.4;
        if (measuredWidth > availableWidth) {
          fontSize = Math.max(4.2, basePt * (availableWidth / measuredWidth));
        }
      }
    }

    return { fontSize: `${fontSize * s}pt`, lineHeight: 1 };
  };

  const getFieldValueWidthMm = (labelText = '', gapMm = 1) => {
    const leftMm = isDataOnly ? 33.5 : 34.0;
    const rightMm = isDataOnly ? 4.5 : 4.0;
    const availableBaseMm = (cardWidth - (leftMm + rightMm) * s) / s;
    const label = String(labelText || '');
    let labelWidthMm = (label.length * 8.5 * 25.4) / 72 * 0.5;

    if (label && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '800 8.5pt Arial';
        labelWidthMm = (context.measureText(label).width * 25.4) / 96;
      }
    }

    return Math.max(5, availableBaseMm - labelWidthMm - gapMm);
  };

  // Cálculo de coordenadas calibradas para cada campo
  const isDataOnly = printMode === 'data_only';
  const valueBasePt = isDataOnly ? 6.6 : 8.5;
  const getFieldStyle = (
    fieldId,
    baseTopMm,
    baseLeftMm = isDataOnly ? 33.5 : 34.0,
    baseRightMm = isDataOnly ? 4.5 : 4.0
  ) => {
    const globalX = isDataOnly ? calibration.offsetX : 0;
    const globalY = isDataOnly ? calibration.offsetY : 0;
    const lineX = isDataOnly ? (calibration.lineOffsets?.[fieldId]?.x || 0) : 0;
    const lineY = isDataOnly ? (calibration.lineOffsets?.[fieldId]?.y || 0) : 0;

    const officialFieldTop = {
      linea1: 20.0,
      linea2: 27.0,
      actividad: 32.5,
      trabajo: 39.0,
      sangre: 45.5,
      fecha: 52.0
    };
    const topBaseMm = isDataOnly ? baseTopMm : (officialFieldTop[fieldId] ?? baseTopMm);
    const top = (topBaseMm + globalY + lineY) * s;
    const left = (baseLeftMm + globalX + lineX) * s;
    const right = (baseRightMm - globalX - lineX) * s;

    return {
      top: `${top}mm`,
      left: `${left}mm`,
      right: `${right}mm`
    };
  };

  const getFotoStyle = () => {
    const globalX = isDataOnly ? calibration.offsetX : 0;
    const globalY = isDataOnly ? calibration.offsetY : 0;
    const fotoX = isDataOnly ? (calibration.lineOffsets?.foto?.x || 0) : 0;
    const fotoY = isDataOnly ? (calibration.lineOffsets?.foto?.y || 0) : 0;

    return {
      top: `${((isDataOnly ? 18.8 : 20.5) + globalY + fotoY) * s}mm`,
      left: `${((isDataOnly ? 3.0 : 3.5) + globalX + fotoX) * s}mm`
    };
  };

  const getCodigoStyle = () => {
    const globalX = isDataOnly ? calibration.offsetX : 0;
    const globalY = isDataOnly ? calibration.offsetY : 0;
    const codX = isDataOnly ? (calibration.lineOffsets?.codigo?.x || 0) : 0;
    const codY = isDataOnly ? (calibration.lineOffsets?.codigo?.y || 0) : 0;

    return {
      top: `${(2.8 + globalY + codY) * s}mm`,
      right: `${(7.4 - globalX - codX) * s}mm`
    };
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <style>{`
        /* ===================== TARJETA BASE ===================== */
        .tarjeta-carnet-real {
          width: ${cardWidth}mm;
          height: ${cardHeight}mm;
          min-width: ${cardWidth}mm;
          max-width: ${cardWidth}mm;
          min-height: ${cardHeight}mm;
          max-height: ${cardHeight}mm;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          border-radius: 2px;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          page-break-inside: avoid;
          break-inside: avoid;
          transition: background-color 0.2s ease;
        }

        /* MODO CARNET COMPLETO (OFICIAL) */
        .tarjeta-carnet-real.modo-oficial {
          background-color: #FDE97E !important;
          box-shadow: 0 4px 10px rgba(0,0,0,0.18);
        }

        /* MODO SOLO DATOS (SOBREIMPRESIÓN EN PANTALLA) */
        .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla {
          background-color: #FFFDE7 !important;
          border: 1.5px dashed #F59E0B;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
        }
        .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .elemento-fijo-oficial,
        .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .etiqueta-fija-oficial {
          opacity: 0.32;
        }
        .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .puntos-guia-form {
          border-bottom: 1.2px dashed rgba(0, 0, 0, 0.25) !important;
        }
        .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .foto-box-real {
          border: 1.2px dashed rgba(0, 0, 0, 0.3) !important;
        }

        .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla {
          background-color: #FFFFFF !important;
          border: 1.5px solid #E2E8F0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .elemento-fijo-oficial {
          display: none !important;
        }
        .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .etiqueta-fija-oficial {
          visibility: hidden !important;
          color: transparent !important;
        }
        .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .puntos-guia-form {
          border: none !important;
          border-bottom: 1.2px solid transparent !important;
          background: transparent !important;
        }
        .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .foto-box-real {
          border: none !important;
          border-color: transparent !important;
          background: transparent !important;
        }

        /* ================== BLOQUE LOGO+ESCUDO ================== */
        .bloque-logo-oficial {
          position: absolute;
          top: ${4.8 * s}mm;
          left: ${3.2 * s}mm;
          width: ${30.5 * s}mm;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .fila-escudo-beni {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 0;
        }
        .contenedor-escudo-beni {
          width: ${9.0 * s}mm;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .escudo-img-beni {
          width: 100%;
          max-width: ${9.0 * s}mm;
          height: auto;
          max-height: ${11.0 * s}mm;
          object-fit: contain;
          pointer-events: none;
        }
        .linea-vertical-separador {
          width: ${0.4 * s}mm;
          height: ${11.0 * s}mm;
          background-color: #0A3D18;
          margin: 0 ${0.7 * s}mm;
          flex-shrink: 0;
          align-self: center;
        }
        .textos-beni-arriba {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          text-align: left;
          padding-top: 0;
        }
        .subt-gobierno {
          font-size: ${3.4 * s}pt;
          font-weight: 800;
          line-height: 1.08;
          color: #0A3D18;
          letter-spacing: 0.1px;
          text-align: left;
          white-space: nowrap;
        }
        .palabra-beni {
          font-family: 'Arial Black', Arial, sans-serif;
          font-size: ${14.0 * s}pt;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: 0.8px;
          color: #0A3D18;
          margin-top: ${0.2 * s}mm;
          text-align: left;
        }
        .estrellas-beni {
          color: #D32F2F;
          font-size: ${3.8 * s}pt;
          letter-spacing: 1.0px;
          line-height: 1;
          margin-top: ${0.3 * s}mm;
          text-align: left;
          width: 100%;
          white-space: nowrap;
        }
        .subtitulos-abajo {
          margin-top: ${0.5 * s}mm;
          font-family: 'Arial Narrow', Arial, sans-serif;
          font-size: ${3.0 * s}pt;
          font-weight: 700;
          line-height: 1.18;
          color: #0A3D18;
          text-align: center;
          letter-spacing: -0.05px;
        }

        /* ================== ENCABEZADO DERECHO ================== */
        .bloque-titulos-derecha {
          position: absolute;
          width: ${44.0 * s}mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .numero-rojo-carnet {
          color: #C0392B;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: ${18.0 * s}pt;
          font-weight: 900;
          margin-top: ${1.0 * s}mm;
          letter-spacing: 1px;
          white-space: nowrap;
          line-height: 1;
          text-align: center;
          margin-bottom: ${1.0 * s}mm;
        }
        .titulo-carnet-sanitario {
          color: #111;
          font-family: 'Arial Black', Arial, sans-serif;
          font-size: ${13.2 * s}pt;
          font-weight: 900;
          letter-spacing: 0.5px;
          white-space: nowrap;
          line-height: 1.1;
          text-align: center;
        }

        /* ================== RECUADRO DE FOTO ================== */
        .foto-box-real {
          position: absolute;
          width: ${PHOTO_PRINT_SIZE_MM * s}mm;
          height: ${PHOTO_PRINT_SIZE_MM * s}mm;
          border: 2.5px solid #111;
          background-color: rgba(255,255,255,0.15);
          box-sizing: border-box;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .foto-img-real {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ================== LÍNEAS DEL FORMULARIO ================== */
        .linea-campo-frente {
          position: absolute;
          display: flex;
          align-items: flex-end;
          font-size: ${8.5 * s}pt;
          font-weight: 800;
          color: #111;
          line-height: 1;
          height: auto;
        }
        .etiqueta-form {
          white-space: nowrap;
          font-weight: 800;
          color: #111;
          letter-spacing: 0.1px;
          flex-shrink: 0;
        }
        .puntos-guia-form {
          border-bottom: 1px dotted #111;
          flex-grow: 1;
          min-width: 0;
          margin-left: ${1.0 * s}mm;
          min-height: ${1.5 * s}mm;
          display: flex;
          align-items: flex-end;
          overflow: visible;
          padding-left: 0;
        }
        .valor-impreso-campo {
          display: block;
          max-width: 100%;
          font-weight: 700;
          color: #111;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1;
        }

        /* ================== RESP. DE UNIDAD ================== */
        .bloque-resp-unidad {
          position: absolute;
          bottom: ${3.0 * s}mm;
          left: ${5.0 * s}mm;
          right: ${5.0 * s}mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .linea-puntos-unidad {
          width: ${34.0 * s}mm;
          border-bottom: 1.2px dotted #333;
          margin-bottom: ${1.0 * s}mm;
        }
        .texto-resp-unidad {
          font-size: ${9.0 * s}pt;
          font-weight: 900;
          letter-spacing: 0.5px;
          color: #111;
          white-space: nowrap;
        }

        /* ================== REVERSO (DORSO) ================== */
        .tarjeta-carnet-real.dorso {
          padding: ${6.0 * s}mm ${5.0 * s}mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
        }
        .dorso-titulo-importante {
          text-align: center;
          font-size: ${11.0 * s}pt;
          font-weight: 900;
          letter-spacing: 1.0px;
          margin-top: ${1.0 * s}mm;
          margin-bottom: ${3.0 * s}mm;
          color: #111;
        }
        .dorso-parrafo-legal {
          font-size: ${7.5 * s}pt;
          text-align: justify;
          line-height: 1.4;
          font-weight: bold;
          color: #111;
        }
        .dorso-bloque-firma {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: ${2.0 * s}mm;
        }
        .dorso-linea-firma {
          width: ${40.0 * s}mm;
          border-bottom: 1.5px dotted #111;
          margin-bottom: ${1.0 * s}mm;
        }
        .dorso-texto-firma {
          font-size: ${7.2 * s}pt;
          font-weight: 900;
          letter-spacing: 0.6px;
          color: #111;
        }

        /* ================== REGLAS EXCLUSIVAS DE IMPRESIÓN ================== */
        @media print {
          /* En impresión, ocultar barra de controles */
          .print-controls-bar {
            display: none !important;
          }

          body {
            background: none !important;
          }
          .tarjeta-carnet-real {
            box-shadow: none !important;
            border: none !important;
          }
          .tarjeta-carnet-real:last-child {
            page-break-after: avoid !important;
          }

          /* REGLAS PRECISAS PARA MODO OFICIAL COMPLETO */
          .tarjeta-carnet-real.modo-oficial {
            background-color: #FDE97E !important;
            box-shadow: none !important;
            border: none !important;
          }
          .tarjeta-carnet-real.modo-oficial .elemento-fijo-oficial {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .tarjeta-carnet-real.modo-oficial .bloque-logo-oficial {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .tarjeta-carnet-real.modo-oficial .etiqueta-fija-oficial {
            visibility: visible !important;
            color: #111 !important;
            opacity: 1 !important;
          }
          .tarjeta-carnet-real.modo-oficial .puntos-guia-form {
            border-bottom: 1px dotted #111 !important;
            visibility: visible !important;
          }
          .tarjeta-carnet-real.modo-oficial .foto-box-real {
            border: 2.5px solid #111 !important;
            visibility: visible !important;
          }
          .tarjeta-carnet-real.modo-oficial .bloque-resp-unidad {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
          .tarjeta-carnet-real.modo-oficial .linea-puntos-unidad {
            display: block !important;
            border-bottom: 1px dotted #111 !important;
            visibility: visible !important;
          }

          /* REGLAS PRECISAS PARA SOBREIMPRESIÓN (SOLO DATOS): NO IMPRIMIR FONDOS, TÍTULOS NI NINGUNA LÍNEA */
          .tarjeta-carnet-real.modo-solo-datos,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            outline: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .elemento-fijo-oficial,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .elemento-fijo-oficial,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .elemento-fijo-oficial {
            display: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .etiqueta-fija-oficial,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .etiqueta-fija-oficial,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .etiqueta-fija-oficial {
            visibility: hidden !important;
            color: transparent !important;
            border: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .linea-puntos-unidad,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .linea-puntos-unidad,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .linea-puntos-unidad {
            display: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .puntos-guia-form,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .puntos-guia-form,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .puntos-guia-form {
            border: none !important;
            border-bottom: 1.2px solid transparent !important;
            border-bottom-color: transparent !important;
            background: transparent !important;
            outline: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .foto-box-real,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .foto-box-real,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .foto-box-real {
            border: none !important;
            border-color: transparent !important;
            background: transparent !important;
            background-color: transparent !important;
            box-shadow: none !important;
            outline: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos .foto-img-real,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .foto-img-real,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .foto-img-real {
            display: ${calibration.includePhoto ? 'block' : 'none'} !important;
          }
          /* La foto se imprime por separado; el carnet conserva su espacio vacío. */
          .tarjeta-carnet-real.modo-oficial .foto-img-real,
          .tarjeta-carnet-real.modo-solo-datos .foto-img-real,
          .tarjeta-carnet-real.modo-solo-datos.con-guia-pantalla .foto-img-real,
          .tarjeta-carnet-real.modo-solo-datos.sin-guia-pantalla .foto-img-real {
            display: none !important;
          }
          .tarjeta-carnet-real.modo-solo-datos.dorso {
            display: none !important;
          }
        }
      `}</style>

      {/* ================= BARRA DE CONTROL PRINCIPAL (SOLO VISIBLE EN PANTALLA) ================= */}
      {!isPrintArea && (
        <div className="print-controls-bar print:hidden w-full max-w-2xl flex flex-col gap-2.5 bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Selector de Modo de Impresión (OPCIÓN 1: SOLO DATOS | OPCIÓN 2: CARNET COMPLETO) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              {/* PRIMERA OPCIÓN (POR DEFECTO): SOLO DATOS */}
              <button
                type="button"
                onClick={() => handlePrintModeChange('data_only')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  printMode === 'data_only'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🎯</span>
                <span>1. Solo Datos (Sobreimpresión)</span>
              </button>

              {/* SEGUNDA OPCIÓN: CARNET COMPLETO */}
              <button
                type="button"
                onClick={() => handlePrintModeChange('official')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  printMode === 'official'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span>🪪</span>
                <span>2. Carnet Completo (Oficial)</span>
              </button>
            </div>

            {/* Selector de Lados (SOLO VISIBLE EN MODO CARNET COMPLETO, EN SOLO DATOS NO EXISTE REVERSO) */}
            {printMode === 'official' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => handleActiveSideChange('front')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeSide === 'front' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  Anverso
                </button>
                <button
                  type="button"
                  onClick={() => handleActiveSideChange('back')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeSide === 'back' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  Reverso
                </button>
                <button
                  type="button"
                  onClick={() => handleActiveSideChange('both')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    activeSide === 'both' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-200/50'
                  }`}
                >
                  Ambos
                </button>
              </div>
            )}
          </div>

          {/* ================= CONTROLES DE CALIBRACIÓN DIRECTOS EN MODO SOLO DATOS ================= */}
          {printMode === 'data_only' && (
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100 text-xs">
                {/* Desplazamiento Horizontal (X) */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Mover X:</span>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
                    <button
                      type="button"
                      title="1mm izquierda"
                      onClick={() => updateCalibration(c => ({ ...c, offsetX: Math.round((c.offsetX - 1.0) * 10) / 10 }))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      title="0.5mm izquierda"
                      onClick={() => updateCalibration(c => ({ ...c, offsetX: Math.round((c.offsetX - 0.5) * 10) / 10 }))}
                      className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      -0.5
                    </button>
                    <span className="px-2 font-mono font-bold text-blue-700 text-xs min-w-[48px] text-center">
                      {calibration.offsetX > 0 ? `+${calibration.offsetX}` : calibration.offsetX}mm
                    </span>
                    <button
                      type="button"
                      title="0.5mm derecha"
                      onClick={() => updateCalibration(c => ({ ...c, offsetX: Math.round((c.offsetX + 0.5) * 10) / 10 }))}
                      className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      +0.5
                    </button>
                    <button
                      type="button"
                      title="1mm derecha"
                      onClick={() => updateCalibration(c => ({ ...c, offsetX: Math.round((c.offsetX + 1.0) * 10) / 10 }))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Desplazamiento Vertical (Y) */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Mover Y:</span>
                  <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
                    <button
                      type="button"
                      title="1mm arriba"
                      onClick={() => updateCalibration(c => ({ ...c, offsetY: Math.round((c.offsetY - 1.0) * 10) / 10 }))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      title="0.5mm arriba"
                      onClick={() => updateCalibration(c => ({ ...c, offsetY: Math.round((c.offsetY - 0.5) * 10) / 10 }))}
                      className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      -0.5
                    </button>
                    <span className="px-2 font-mono font-bold text-blue-700 text-xs min-w-[48px] text-center">
                      {calibration.offsetY > 0 ? `+${calibration.offsetY}` : calibration.offsetY}mm
                    </span>
                    <button
                      type="button"
                      title="0.5mm abajo"
                      onClick={() => updateCalibration(c => ({ ...c, offsetY: Math.round((c.offsetY + 0.5) * 10) / 10 }))}
                      className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-[10px] font-bold text-slate-600 cursor-pointer"
                    >
                      +0.5
                    </button>
                    <button
                      type="button"
                      title="1mm abajo"
                      onClick={() => updateCalibration(c => ({ ...c, offsetY: Math.round((c.offsetY + 1.0) * 10) / 10 }))}
                      className="p-1 hover:bg-slate-100 rounded text-slate-600 font-bold cursor-pointer"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>

                {/* Botón Reset a 0 */}
                <button
                  type="button"
                  onClick={resetCalibration}
                  className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium cursor-pointer text-xs"
                  title="Restablecer a 0 mm"
                >
                  <RotateCcw size={12} />
                  <span>0 mm</span>
                </button>
              </div>

              {/* Opciones Rápidas */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={calibration.showGhostGuide}
                      onChange={(e) => updateCalibration({ showGhostGuide: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>👁️ Ver silueta guía en pantalla</span>
                  </label>

                  {isDataOnly && (
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={calibration.includePhoto}
                        onChange={(e) => updateCalibration({ includePhoto: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>📷 Mostrar foto en vista previa (no se imprime)</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedOffsets(p => !p)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  <span>Ajuste fino renglones</span>
                  {showAdvancedOffsets ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Ajuste Fino Individual por Línea */}
              {showAdvancedOffsets && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  {[
                    { id: 'codigo', label: 'Nº Carnet' },
                    { id: 'linea1', label: 'Línea 1: Nombres' },
                    { id: 'linea2', label: 'Línea 2: Apellidos' },
                    { id: 'actividad', label: 'Línea 3: Actividad' },
                    { id: 'trabajo', label: 'Línea 4: Trabajo' },
                    { id: 'sangre', label: 'Línea 5: Grupo y Rh' },
                    { id: 'fecha', label: 'Línea 6: Fecha' },
                    { id: 'foto', label: 'Recuadro Foto' }
                  ].map(field => {
                    const current = calibration.lineOffsets?.[field.id] || { x: 0, y: 0 };
                    return (
                      <div key={field.id} className="p-1.5 bg-white rounded-lg border border-slate-200 flex flex-col gap-1">
                        <span className="font-bold text-slate-700 truncate">{field.label}</span>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-slate-400 font-mono">X:</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateLineOffset(field.id, 'x', -0.5)}
                              className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono text-[9px] min-w-[24px] text-center font-bold text-slate-700">
                              {current.x > 0 ? `+${current.x}` : current.x}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateLineOffset(field.id, 'x', 0.5)}
                              className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-slate-400 font-mono ml-0.5">Y:</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => updateLineOffset(field.id, 'y', -0.5)}
                              className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-mono text-[9px] min-w-[24px] text-center font-bold text-slate-700">
                              {current.y > 0 ? `+${current.y}` : current.y}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateLineOffset(field.id, 'y', 0.5)}
                              className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= CONTENEDOR VISUAL DEL CARNET ================= */}
      <div className="carnet-print-pair flex flex-col md:flex-row gap-6 items-center justify-center">
        {/* ==================== PARTE DELANTERA ==================== */}
        {(activeSide === 'front' || activeSide === 'both') && (
          <div
            className={`tarjeta-carnet-real carnet-oficial ${sizeClass} ${
              printMode === 'official'
                ? 'modo-oficial'
                : `modo-solo-datos ${!isPrintArea && calibration.showGhostGuide ? 'con-guia-pantalla' : 'sin-guia-pantalla'}`
            }`}
          >
            {/* Logo Oficial de Beni con Escudo Centrado (Elemento fijo) */}
            <div className="bloque-logo-oficial elemento-fijo-oficial">
              <div className="fila-escudo-beni">
                <div className="contenedor-escudo-beni">
                  <img src={escudoBeni} alt="Escudo Beni" className="escudo-img-beni" />
                </div>
                <div className="linea-vertical-separador"></div>
                <div className="textos-beni-arriba">
                  <div className="subt-gobierno">GOBIERNO AUTÓNOMO</div>
                  <div className="subt-gobierno">DEPARTAMENTAL DEL</div>
                  <div className="palabra-beni">BENI</div>
                  <div className="estrellas-beni">★ ★ ★ ★ ★ ★ ★ ★ ★</div>
                </div>
              </div>
              <div className="subtitulos-abajo">
                GOBIERNO AUTÓNOMO DPTO. BENI<br />
                SERVICIO DEPARTAMENTAL DE SALUD - SEDES BENI<br />
                UNIDAD SALUD AMBIENTAL
              </div>
            </div>

            {/* Número y Título Derecho Centrados */}
            <div className="bloque-titulos-derecha" style={getCodigoStyle()}>
              {!isDataOnly && <div className="numero-rojo-carnet">N° {numCarnet}</div>}
              <div className="titulo-carnet-sanitario elemento-fijo-oficial">CARNET SANITARIO</div>
            </div>

            {/* Recuadro de Fotografía */}
            <div className="foto-box-real" style={getFotoStyle()}>
              {carnet.foto_url && (
                <img
                  src={carnet.foto_url}
                  alt="Foto paciente"
                  className={`foto-img-real ${isDataOnly && !calibration.includePhoto ? 'hidden' : ''}`}
                />
              )}
            </div>

            {/* ===== Las 6 Líneas del Formulario Oficial ===== */}
            {/* Línea 1: Nombre y Apellidos (Primera raya) */}
            <div className="linea-campo-frente" style={getFieldStyle('linea1', 19.5)}>
              <span className="etiqueta-form etiqueta-fija-oficial">Nombre y Apellidos:</span>
              <div className="puntos-guia-form">
                <span className="valor-impreso-campo" style={getDynamicStyle(linea1Nombre, getFieldValueWidthMm('Nombre y Apellidos:'), valueBasePt)}>
                  {linea1Nombre}
                </span>
              </div>
            </div>

            {/* Línea 2: Segunda raya punteada completa para Apellidos / Continuación */}
            <div className="linea-campo-frente" style={getFieldStyle('linea2', 26.0)}>
              <div className="puntos-guia-form" style={{ marginLeft: 0 }}>
                <span className="valor-impreso-campo" style={getDynamicStyle(linea2Nombre, getFieldValueWidthMm(''), valueBasePt)}>
                  {linea2Nombre}
                </span>
              </div>
            </div>

            {/* Línea 3: Actividad */}
            <div className="linea-campo-frente" style={getFieldStyle('actividad', 32.5)}>
              <span className="etiqueta-form etiqueta-fija-oficial">Actividad:</span>
              <div className="puntos-guia-form">
                <span className="valor-impreso-campo" style={getDynamicStyle(actividadTexto, getFieldValueWidthMm('Actividad:'), valueBasePt)}>
                  {actividadTexto}
                </span>
              </div>
            </div>

            {/* Línea 4: Lugar de Trabajo */}
            <div className="linea-campo-frente" style={getFieldStyle('trabajo', 39.0)}>
              <span className="etiqueta-form etiqueta-fija-oficial">Lugar de Trabajo:</span>
              <div className="puntos-guia-form">
                <span className="valor-impreso-campo" style={getDynamicStyle(lugarTrabajo, getFieldValueWidthMm('Lugar de Trabajo:'), valueBasePt)}>
                  {lugarTrabajo}
                </span>
              </div>
            </div>

            {/* Línea 5: Grupo Sanguíneo y Factor Rh */}
            <div className="linea-campo-frente" style={getFieldStyle('sangre', 45.5)}>
              <span className="etiqueta-form etiqueta-fija-oficial">Grupo Sanguíneo:</span>
              <div className="puntos-guia-form" style={{ maxWidth: `${5.5 * s}mm` }}>
                <span className="valor-impreso-campo">{sangre.grupo}</span>
              </div>
              <span className="etiqueta-form etiqueta-fija-oficial" style={{ marginLeft: `${1.0 * s}mm` }}>
                Factor Rh:
              </span>
              <div className="puntos-guia-form" style={{ maxWidth: `${5.5 * s}mm` }}>
                <span className="valor-impreso-campo">{sangre.rh}</span>
              </div>
            </div>

            {/* Línea 6: Fecha de validez */}
            <div className="linea-campo-frente" style={getFieldStyle('fecha', 52.0)}>
              <span className="etiqueta-form etiqueta-fija-oficial">Fecha de validez:</span>
              <div className="puntos-guia-form">
                <span className="valor-impreso-campo" style={getDynamicStyle(fechaValidez, getFieldValueWidthMm('Fecha de validez:'), valueBasePt)}>
                  {fechaValidez}
                </span>
              </div>
            </div>

            {/* Pie: RESP. DE UNIDAD */}
            <div className="bloque-resp-unidad elemento-fijo-oficial">
              <div className="linea-puntos-unidad"></div>
              <div className="texto-resp-unidad">RESP. DE UNIDAD</div>
            </div>
          </div>
        )}

        {/* ==================== PARTE TRASERA (SOLO VISIBLE EN MODO 2: CARNET COMPLETO) ==================== */}
        {printMode === 'official' && (activeSide === 'back' || activeSide === 'both') && (
          <div className={`tarjeta-carnet-real dorso carnet-oficial ${sizeClass} modo-oficial`}>
            <div>
              <div className="dorso-titulo-importante">IMPORTANTE</div>
              <div className="dorso-parrafo-legal">
                Toda persona que fabrique, manipule, expenda alimentos, bebidas o que tenga contacto con el público esta obligado a recabar este documento de acuerdo al CODIGO DE SALUD.
              </div>
            </div>

            <div className="dorso-bloque-firma">
              <div className="dorso-linea-firma"></div>
              <div className="dorso-texto-firma">FIRMA MÉDICO</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
