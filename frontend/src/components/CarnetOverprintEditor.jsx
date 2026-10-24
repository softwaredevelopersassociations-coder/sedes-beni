import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Upload, Trash2, Eye, Move, X, Plus, RotateCcw, Check, Printer } from 'lucide-react';
import carnetTemplateImg from '../assets/cardex/carnet_modelo.png';

const STORAGE_KEY = 'carnet-overprint-template-v2';

// Dimensiones de la tarjeta física del carnet/kardex (100mm de ancho x 67mm de alto aprox)
export const CARD_WIDTH_MM = 100;
export const CARD_HEIGHT_MM = 67;

// Centrado en hoja carta (215.9 x 279.4 mm):
// Card Left: (215.9 - 100) / 2 = 57.95 mm
// Card Top: (279.4 - 67) / 2 = 106.2 mm
export const CARD_ORIGIN_X_MM = 57.95;
export const CARD_ORIGIN_Y_MM = 106.2;

// Campos calibrados según el diseño físico del carnet de SEDES Beni guardado en assets:
// No: esquina superior derecha
// Nombre y Apellidos: fila 1
// Actividad: fila 2
// Lugar de Trabajo: fila 3
// Grupo Sanguíneo y Factor Rh: fila 4
// Fecha de Validez: fila 5
// Foto paciente: recuadro izquierdo
export const DEFAULT_FIELDS = [
  { id: 'codigo', label: 'Nº Carnet', x: 57.95 + 66, y: 106.2 + 8.5, fontSize: 11, bold: true, color: '#dc2626' },
  { id: 'nombre', label: 'Nombre y Apellidos', x: 57.95 + 43, y: 106.2 + 22.5, fontSize: 8.5, bold: true, color: '#000000' },
  { id: 'actividad', label: 'Actividad (Rubro)', x: 57.95 + 43, y: 106.2 + 37, fontSize: 8, bold: true, color: '#000000' },
  { id: 'trabajo', label: 'Lugar de Trabajo', x: 57.95 + 43, y: 106.2 + 45.5, fontSize: 7.5, bold: true, color: '#000000' },
  { id: 'grupo', label: 'Grupo Sanguíneo', x: 57.95 + 44, y: 106.2 + 53.5, fontSize: 8, bold: true, color: '#000000' },
  { id: 'rh', label: 'Factor Rh', x: 57.95 + 78, y: 106.2 + 53.5, fontSize: 8, bold: true, color: '#000000' },
  { id: 'vencimiento', label: 'Fecha de Validez', x: 57.95 + 43, y: 106.2 + 62, fontSize: 8, bold: true, color: '#000000' },
  { id: 'foto', label: 'Foto Paciente', x: 57.95 + 7.5, y: 106.2 + 22.5, width: 33, height: 41, isFoto: true }
];

export const FIELD_OPTIONS = [
  { id: 'codigo', label: 'Nº Carnet', getValue: (d) => d.codigo_carnet || '' },
  { id: 'nombre', label: 'Nombre y Apellidos', getValue: (d) => `${d.nombres || ''} ${d.apellidos || ''}`.trim().toUpperCase() },
  { id: 'ci', label: 'Cédula de Identidad', getValue: (d) => `${d.ci || ''} ${d.ci_exp || ''}`.trim() },
  { id: 'actividad', label: 'Actividad (Rubro)', getValue: (d) => d.ocupacion || '' },
  { id: 'trabajo', label: 'Lugar de Trabajo', getValue: (d) => `${d.empresa_trabajo || ''} ${d.mercado ? `(${d.mercado})` : ''}`.trim() || 'Particular' },
  { id: 'grupo', label: 'Grupo Sanguíneo', getValue: (d) => {
    try { 
      const q = typeof d.quimica_sanguinea === 'string' ? JSON.parse(d.quimica_sanguinea) : d.quimica_sanguinea; 
      return q?.grupo_sanguineo || '—'; 
    } catch { return '—'; }
  }},
  { id: 'rh', label: 'Factor Rh', getValue: (d) => {
    try { 
      const q = typeof d.quimica_sanguinea === 'string' ? JSON.parse(d.quimica_sanguinea) : d.quimica_sanguinea; 
      return q?.factor_rh || '—'; 
    } catch { return '—'; }
  }},
  { id: 'emision', label: 'Fecha Emisión', getValue: (d) => d.fecha_emision ? new Date(d.fecha_emision).toLocaleDateString('es-ES') : '—' },
  { id: 'vencimiento', label: 'Fecha de Validez', getValue: (d) => d.fecha_vencimiento ? new Date(d.fecha_vencimiento).toLocaleDateString('es-ES') : '—' },
  { id: 'foto', label: 'Foto Paciente', isFoto: true, getValue: (d) => d.foto_url || null },
];

export function PrintOverprintFields({ carnetData, includeBackground = false, templateState = null }) {
  const [template, setTemplate] = useState(() => {
    if (templateState) return templateState;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          fields: parsed.fields || DEFAULT_FIELDS,
          offsetX: parsed.offsetX || 0,
          offsetY: parsed.offsetY || 0,
          includeBackground: parsed.includeBackground !== undefined ? parsed.includeBackground : includeBackground
        };
      }
    } catch {
      // fallback
    }
    return { fields: DEFAULT_FIELDS, offsetX: 0, offsetY: 0, includeBackground };
  });

  useEffect(() => {
    if (templateState) {
      setTemplate(templateState);
      return;
    }
    const sync = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setTemplate({
            fields: parsed.fields || DEFAULT_FIELDS,
            offsetX: parsed.offsetX || 0,
            offsetY: parsed.offsetY || 0,
            includeBackground: parsed.includeBackground !== undefined ? parsed.includeBackground : includeBackground
          });
        }
      } catch {
        // ignore
      }
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [templateState, includeBackground]);

  const { fields, offsetX = 0, offsetY = 0, includeBackground: printBg } = template;

  return (
    <div className="print-fields-layer">
      {/* Fondo completo del modelo de carnet (si el usuario eligió imprimir carnet completo o en hoja limpia) */}
      {(printBg || includeBackground) && (
        <div 
          className="print-card-kardex"
          style={{
            left: `${CARD_ORIGIN_X_MM + offsetX}mm`,
            top: `${CARD_ORIGIN_Y_MM + offsetY}mm`,
            width: `${CARD_WIDTH_MM}mm`,
            height: `${CARD_HEIGHT_MM}mm`,
          }}
        >
          <img 
            src={carnetTemplateImg} 
            alt="Carnet Sanitario SEDES Beni" 
            className="w-full h-full object-fill block"
          />
        </div>
      )}

      {/* Capa de campos de texto y foto sobreimpresos */}
      {fields.map(f => {
        const option = FIELD_OPTIONS.find(o => o.id === f.id);
        if (!option) return null;
        const value = option.getValue(carnetData);

        if (f.isFoto || f.id === 'foto') {
          if (!value) return null;
          return (
            <div
              key={f.id}
              className="print-field absolute overflow-hidden bg-slate-100"
              style={{
                left: `${f.x + offsetX}mm`,
                top: `${f.y + offsetY}mm`,
                width: `${f.width || 33}mm`,
                height: `${f.height || 41}mm`,
                border: '0.5px solid #666',
              }}
            >
              <img src={value} alt="Foto carnet" className="w-full h-full object-cover" />
            </div>
          );
        }

        if (!value) return null;
        return (
          <div
            key={f.id}
            className="print-field absolute select-none leading-none"
            style={{
              left: `${f.x + offsetX}mm`,
              top: `${f.y + offsetY}mm`,
              fontSize: `${Math.max(5, f.fontSize || 8)}pt`,
              fontWeight: f.bold ? 'bold' : 'normal',
              fontFamily: "'Segoe UI', Arial, sans-serif",
              color: f.color || '#000',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </div>
        );
      })}
    </div>
  );
}

export default function CarnetOverprintEditor({ carnetData, onPrint, onClose }) {
  const [fields, setFields] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        return parsed.fields || parsed; 
      } catch { 
        return DEFAULT_FIELDS; 
      }
    }
    return DEFAULT_FIELDS;
  });

  const [backgroundImage, setBackgroundImage] = useState(carnetTemplateImg);
  const [showBackground, setShowBackground] = useState(true);
  const [includeBackgroundInPrint, setIncludeBackgroundInPrint] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [paperSize, setPaperSize] = useState('letter');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const editorRef = useRef(null);

  useEffect(() => {
    const dataToSave = {
      fields,
      paperSize,
      offsetX,
      offsetY,
      includeBackground: includeBackgroundInPrint
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [fields, paperSize, offsetX, offsetY, includeBackgroundInPrint]);

  const paperDimensions = {
    letter: { w: 215.9, h: 279.4 },
    a4: { w: 210, h: 297 },
  };

  const { w: paperW, h: paperH } = paperDimensions[paperSize] || paperDimensions.letter;
  const scale = Math.min(840 / paperW, 620 / paperH);
  const canvasW = paperW * scale;
  const canvasH = paperH * scale;

  const cardOriginX = (paperW - CARD_WIDTH_MM) / 2;
  const cardOriginY = (paperH - CARD_HEIGHT_MM) / 2;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBackgroundImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const updateField = (id, updates) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addField = () => {
    const newField = {
      id: `custom_${Date.now()}`,
      label: 'Nuevo Campo',
      x: cardOriginX + 10,
      y: cardOriginY + 10,
      fontSize: 8,
      bold: false,
      color: '#000000',
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const removeField = (id) => {
    if (window.confirm('¿Eliminar este campo?')) {
      setFields(prev => prev.filter(f => f.id !== id));
      setSelectedFieldId(null);
    }
  };

  const resetTemplate = () => {
    if (window.confirm('¿Restaurar plantilla oficial del carnet?')) {
      setFields(DEFAULT_FIELDS);
      setBackgroundImage(carnetTemplateImg);
      setIncludeBackgroundInPrint(false);
      setOffsetX(0);
      setOffsetY(0);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const exportTemplate = () => {
    const data = { fields, paperSize, offsetX, offsetY, includeBackground: includeBackgroundInPrint };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carnet-kardex-plantilla-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.fields) setFields(data.fields);
        if (data.paperSize) setPaperSize(data.paperSize);
        if (data.offsetX !== undefined) setOffsetX(data.offsetX);
        if (data.offsetY !== undefined) setOffsetY(data.offsetY);
        if (data.includeBackground !== undefined) setIncludeBackgroundInPrint(data.includeBackground);
      } catch {
        alert('Archivo de plantilla inválido');
      }
    };
    reader.readAsText(file);
  };

  const handleKeyDown = useCallback((e) => {
    if (!selectedFieldId) return;
    const step = e.shiftKey ? 1 : 0.2;
    let moved = false;
    setFields(prev => prev.map(f => {
      if (f.id !== selectedFieldId) return f;
      moved = true;
      switch (e.key) {
        case 'ArrowLeft': return { ...f, x: Math.max(0, f.x - step) };
        case 'ArrowRight': return { ...f, x: Math.min(paperW, f.x + step) };
        case 'ArrowUp': return { ...f, y: Math.max(0, f.y - step) };
        case 'ArrowDown': return { ...f, y: Math.min(paperH, f.y + step) };
        default: return f;
      }
    }));
    if (moved) e.preventDefault();
  }, [selectedFieldId, paperW, paperH]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const PreviewField = ({ field }) => {
    const isSelected = selectedFieldId === field.id;
    const option = FIELD_OPTIONS.find(o => o.id === field.id);
    const rawVal = option?.getValue?.(carnetData);
    const value = rawVal || field.label;
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
    const elementRef = useRef(null);
    const dragPosRef = useRef({ x: field.x, y: field.y });

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedFieldId(field.id);
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        fieldX: field.x,
        fieldY: field.y,
      };
      dragPosRef.current = { x: field.x, y: field.y };
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e) => {
        e.preventDefault();
        const dx = (e.clientX - dragStartRef.current.x) / scale;
        const dy = (e.clientY - dragStartRef.current.y) / scale;
        const newX = Math.max(0, Math.min(paperW, dragStartRef.current.fieldX + dx));
        const newY = Math.max(0, Math.min(paperH, dragStartRef.current.fieldY + dy));
        dragPosRef.current = { x: newX, y: newY };
        if (elementRef.current) {
          elementRef.current.style.transform = `translate(${(newX - field.x) * scale}px, ${(newY - field.y) * scale}px)`;
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        updateField(field.id, { x: dragPosRef.current.x, y: dragPosRef.current.y });
        if (elementRef.current) {
          elementRef.current.style.transform = 'none';
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging, field.id]);

    const isFotoField = field.isFoto || field.id === 'foto';

    return (
      <div
        ref={elementRef}
        className={`absolute select-none ${isSelected ? 'ring-2 ring-blue-500 z-20' : ''} ${isDragging ? 'opacity-85 shadow-lg z-30' : ''}`}
        style={{
          left: `${(field.x + offsetX) * scale}px`,
          top: `${(field.y + offsetY) * scale}px`,
          ...(isFotoField ? {
            width: `${(field.width || 33) * scale}px`,
            height: `${(field.height || 41) * scale}px`,
          } : {
            fontSize: `${Math.max(5, (field.fontSize || 8) * scale * 0.3527 * 3.78)}px`,
            fontWeight: field.bold ? 'bold' : 'normal',
            fontFamily: "'Segoe UI', Arial, sans-serif",
            color: field.color || '#000',
            whiteSpace: 'nowrap',
          }),
          cursor: isDragging ? 'grabbing' : 'move',
          userSelect: 'none',
          pointerEvents: 'auto',
          willChange: 'transform',
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => { e.stopPropagation(); setSelectedFieldId(field.id); }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {isFotoField ? (
          <div className="w-full h-full bg-slate-200/80 border border-slate-400 overflow-hidden flex items-center justify-center text-[10px] text-slate-600 font-bold">
            {rawVal ? (
              <img src={rawVal} alt="Foto carnet" className="w-full h-full object-cover" />
            ) : (
              <span>Foto (33×41mm)</span>
            )}
          </div>
        ) : (
          value
        )}

        {(isHovering || isSelected) && (
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-30"
            style={{
              fontSize: '9px',
              color: '#1e293b',
              background: '#f8fafc',
              padding: '1px 5px',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
            }}
          >
            {field.label}: X: {(isDragging ? dragPosRef.current.x : field.x).toFixed(1)}mm | Y: {(isDragging ? dragPosRef.current.y : field.y).toFixed(1)}mm
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex flex-col" onKeyDown={handleKeyDown}>
      {/* Toolbar Superior */}
      <div className="print:hidden bg-white p-3 border-b border-slate-200 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <Printer size={16} className="text-blue-600" />
            Impresión y Calibración de Carnet
          </h3>
          <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200">
            Formato: 100×67 mm (Hoja {paperSize.toUpperCase()})
          </span>
        </div>

        {/* Modalidad de impresión */}
        <div className="flex items-center gap-2 border-r border-slate-200 px-3 bg-slate-50 py-1 rounded-lg border">
          <span className="text-xs font-bold text-slate-700">Modo:</span>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
            <input 
              type="radio" 
              name="printMode" 
              checked={!includeBackgroundInPrint} 
              onChange={() => setIncludeBackgroundInPrint(false)}
              className="text-blue-600"
            />
            Sobreimpresión (Carnet preimpreso)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium ml-2">
            <input 
              type="radio" 
              name="printMode" 
              checked={includeBackgroundInPrint} 
              onChange={() => setIncludeBackgroundInPrint(true)}
              className="text-blue-600"
            />
            Carnet Completo (Con fondo oficial)
          </label>
        </div>

        {/* Vistas de guía */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 px-3">
          <label className={`cursor-pointer px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${showBackground ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'hover:bg-slate-100 border-slate-200 text-slate-600'}`}>
            <input type="checkbox" checked={showBackground} onChange={(e) => setShowBackground(e.target.checked)} className="hidden" />
            <Eye className="w-3.5 h-3.5" /> Fondo Guía
          </label>
          <label className={`cursor-pointer px-2 py-1 text-xs rounded border transition-colors flex items-center gap-1 ${showGrid ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold' : 'hover:bg-slate-100 border-slate-200 text-slate-600'}`}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="hidden" />
            <Eye className="w-3.5 h-3.5" /> Cuadrícula mm
          </label>
        </div>

        {/* Plantilla y configuración */}
        <div className="flex items-center gap-1 border-r border-slate-200 px-3">
          <button onClick={addField} className="px-2 py-1 text-xs hover:bg-slate-100 rounded flex items-center gap-1 text-slate-700" title="Agregar nuevo campo">
            <Plus className="w-3.5 h-3.5" /> Campo
          </button>
          <button onClick={exportTemplate} className="px-2 py-1 text-xs hover:bg-slate-100 rounded flex items-center gap-1 text-slate-700" title="Exportar configuración a JSON">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
          <input
            type="file"
            accept=".json"
            onChange={importTemplate}
            className="hidden"
            id="import-template"
          />
          <label htmlFor="import-template" className="cursor-pointer px-2 py-1 text-xs hover:bg-slate-100 rounded flex items-center gap-1 text-slate-700" title="Importar plantilla guardada">
            <Upload className="w-3.5 h-3.5" /> Cargar
          </label>
          <button onClick={resetTemplate} className="px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded flex items-center gap-1" title="Restablecer plantilla oficial predeterminada">
            <RotateCcw className="w-3.5 h-3.5" /> Calibración Oficial
          </button>
        </div>

        {/* Offset global fino */}
        <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
          <span className="text-xs text-slate-600 font-medium">Calibración rápida:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold">X:</span>
            <input 
              type="number" 
              step="0.5" 
              value={offsetX} 
              onChange={(e) => setOffsetX(parseFloat(e.target.value) || 0)} 
              className="w-14 px-1.5 py-0.5 text-xs border border-slate-300 rounded text-center" 
              title="Ajuste horizontal en mm"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold">Y:</span>
            <input 
              type="number" 
              step="0.5" 
              value={offsetY} 
              onChange={(e) => setOffsetY(parseFloat(e.target.value) || 0)} 
              className="w-14 px-1.5 py-0.5 text-xs border border-slate-300 rounded text-center" 
              title="Ajuste vertical en mm"
            />
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 ml-auto">
          <button 
            onClick={onClose} 
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            Cerrar
          </button>
          <button 
            onClick={onPrint} 
            className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Printer className="w-3.5 h-3.5" /> Mandar a Imprimir
          </button>
        </div>
      </div>

      {/* Contenedor Central */}
      <div className="print:hidden flex-1 overflow-hidden flex">
        {/* Panel Izquierdo: Lista de Campos */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 overflow-y-auto p-3">
          <h4 className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between">
            <span>Campos del Carnet</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">{fields.length}</span>
          </h4>
          <div className="space-y-1">
            {fields.map(f => (
              <div
                key={f.id}
                className={`px-2.5 py-2 text-xs rounded-lg cursor-pointer transition-colors flex items-center gap-2 border ${
                  selectedFieldId === f.id ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-xs' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                onClick={() => setSelectedFieldId(f.id)}
              >
                <Move className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="flex-1 truncate">{f.label}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeField(f.id); }} 
                  className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors" 
                  title="Eliminar campo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
            <p className="font-bold">Instrucciones de uso:</p>
            <p>1. Arrastre los textos directamente con el ratón o seleccione un campo y use las teclas de flechas (Shift + Flecha para 1mm).</p>
            <p>2. Si su hoja física ya tiene el carnet preimpreso, elija "Sobreimpresión" para imprimir solo los datos.</p>
            <p>3. Si desea imprimir el carnet entero en cartulina/hoja blanca, elija "Carnet Completo".</p>
          </div>
        </div>

        {/* Canvas de Previsualización a Escala Real */}
        <div className="flex-1 flex items-center justify-center p-4 relative overflow-auto" ref={editorRef}>
          <div 
            className="relative bg-white shadow-2xl print-preview-sheet transition-all" 
            style={{ width: canvasW, height: canvasH }}
          >
            {/* Cuadrícula milimétrica */}
            {showGrid && (
              <>
                {[...Array(Math.ceil(paperW))].map((_, i) => (
                  <div 
                    key={`gx-${i}`} 
                    className={`absolute top-0 bottom-0 ${i % 10 === 0 ? 'border-l border-slate-300' : 'border-l-[0.5px] border-slate-100'}`} 
                    style={{ left: `${i * scale}px` }} 
                  />
                ))}
                {[...Array(Math.ceil(paperH))].map((_, i) => (
                  <div 
                    key={`gy-${i}`} 
                    className={`absolute left-0 right-0 ${i % 10 === 0 ? 'border-t border-slate-300' : 'border-t-[0.5px] border-slate-100'}`} 
                    style={{ top: `${i * scale}px` }} 
                  />
                ))}
              </>
            )}

            {/* Contenedor Físico del Carnet (100mm x 67mm) */}
            <div 
              className="absolute border-2 border-dashed border-blue-500 rounded-xs overflow-visible shadow-md"
              style={{
                width: `${CARD_WIDTH_MM * scale}px`,
                height: `${CARD_HEIGHT_MM * scale}px`,
                left: `${(cardOriginX + offsetX) * scale}px`,
                top: `${(cardOriginY + offsetY) * scale}px`,
              }}
            >
              {/* Modelo oficial del carnet de fondo */}
              {showBackground && (
                <img
                  src={backgroundImage}
                  alt="Modelo Carnet Sanitario SEDES Beni"
                  className={`absolute inset-0 w-full h-full object-fill pointer-events-none ${
                    includeBackgroundInPrint ? 'opacity-100' : 'opacity-40'
                  }`}
                />
              )}

              {/* Indicador de posición y tamaño físico */}
              <div className="absolute -top-5 left-0 text-[10px] font-bold text-blue-600 bg-white/90 px-1.5 py-0.5 rounded shadow-xs border border-blue-200 pointer-events-none">
                Carnet Sanitario SEDES Beni (100×67 mm)
              </div>
            </div>

            {/* Render de todos los campos interactivos en la hoja */}
            <div className="absolute inset-0 pointer-events-none">
              {fields.map(f => (
                <PreviewField key={f.id} field={f} />
              ))}
            </div>

            {/* Marcas de corte en la hoja */}
            <div className="absolute -top-2 -left-2 w-3 h-3 border-t-2 border-l-2 border-slate-600" />
            <div className="absolute -top-2 -right-2 w-3 h-3 border-t-2 border-r-2 border-slate-600" />
            <div className="absolute -bottom-2 -left-2 w-3 h-3 border-b-2 border-l-2 border-slate-600" />
            <div className="absolute -bottom-2 -right-2 w-3 h-3 border-b-2 border-r-2 border-slate-600" />

            {/* Información en pie de hoja */}
            <div className="absolute bottom-2 right-3 text-[9px] text-slate-400 bg-white/90 px-2 py-0.5 rounded border border-slate-200 pointer-events-none">
              Hoja {paperSize.toUpperCase()}: {paperW} × {paperH} mm | Escala: {(scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Panel Derecho: Propiedades del Campo Seleccionado */}
        {selectedFieldId && (
          <div className="print:hidden w-72 bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
              <h4 className="font-bold text-xs text-slate-800">Propiedades del Campo</h4>
              <button onClick={() => setSelectedFieldId(null)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            {(() => {
              const f = fields.find(x => x.id === selectedFieldId);
              if (!f) return null;
              const isFoto = f.isFoto || f.id === 'foto';
              return (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Etiqueta</label>
                    <input
                      value={f.label}
                      onChange={(e) => updateField(f.id, { label: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">X (mm)</label>
                      <input
                        type="number" step="0.2" min="0" max={paperW}
                        value={Number(f.x.toFixed(2))}
                        onChange={(e) => updateField(f.id, { x: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Y (mm)</label>
                      <input
                        type="number" step="0.2" min="0" max={paperH}
                        value={Number(f.y.toFixed(2))}
                        onChange={(e) => updateField(f.id, { y: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                      />
                    </div>
                  </div>

                  {isFoto ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 font-medium mb-1">Ancho (mm)</label>
                        <input
                          type="number" step="1" min="10" max="60"
                          value={f.width || 33}
                          onChange={(e) => updateField(f.id, { width: parseFloat(e.target.value) || 33 })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-medium mb-1">Alto (mm)</label>
                        <input
                          type="number" step="1" min="10" max="60"
                          value={f.height || 41}
                          onChange={(e) => updateField(f.id, { height: parseFloat(e.target.value) || 41 })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Tamaño (pt)</label>
                          <input
                            type="number" step="0.5" min="4" max="24"
                            value={f.fontSize || 8}
                            onChange={(e) => updateField(f.id, { fontSize: parseFloat(e.target.value) || 8 })}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Peso</label>
                          <select
                            value={f.bold ? 'bold' : 'normal'}
                            onChange={(e) => updateField(f.id, { bold: e.target.value === 'bold' })}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                          >
                            <option value="normal">Normal</option>
                            <option value="bold">Negrita</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-500 font-medium mb-1">Color de Texto</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={f.color || '#000000'}
                            onChange={(e) => updateField(f.id, { color: e.target.value })}
                            className="w-8 h-8 p-0 border border-slate-300 rounded cursor-pointer"
                          />
                          <span className="font-mono text-xs">{f.color || '#000000'}</span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="pt-3 border-t border-slate-200">
                    <label className="block text-slate-500 font-medium mb-1">Valor en este carnet:</label>
                    <div className="p-2 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800 break-words">
                      {FIELD_OPTIONS.find(o => o.id === f.id)?.getValue?.(carnetData) || '(Sin dato asignado)'}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 bg-slate-100 p-2 rounded">
                    Tip: Use las teclas de dirección ← ↑ → ↓ para mover el elemento con precisión de milímetros.
                  </p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}