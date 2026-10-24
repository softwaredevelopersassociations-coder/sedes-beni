import React from 'react';
import logo from '../assets/logo.jpeg';

/**
 * CarnetTemplate — Réplica exacta del carnet sanitario físico oficial del SEDES Beni.
 * 
 * Distribución visual oficial:
 * ┌────────────────────────────────────────────────────────┐
 * │  [Escudo]  GOBIERNO AUTÓNOMO...        Nº ............ │
 * │            SEDES BENI               CARNET SANITARIO   │
 * │            UNIDAD SALUD AMBIENTAL                      │
 * │                      Nombre y Apellidos: ..............│
 * │  ┌──────────┐        ..................................│
 * │  │          │        Actividad: .......................│
 * │  │  FOTO    │        Lugar de Trabajo: ................│
 * │  │          │        Grupo Sanguíneo: ...  Factor Rh: .│
 * │  │ [00001]  │        Fecha de Validez: ................│
 * │  └──────────┘                                          │
 * │  ..................         ..................         │
 * │   RESP. DE UNIDAD                 MEDICO               │
 * └────────────────────────────────────────────────────────┘
 */
export default function CarnetTemplate({ carnet, size = 'standard' }) {
  if (!carnet) return null;

  // Extraer grupo sanguíneo del JSON o del objeto de química sanguínea
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

  // Dimensiones según el soporte seleccionado
  const isCR80 = size === 'cr80';
  const cardW = isCR80 ? '86mm' : '100mm';
  const cardH = isCR80 ? '54mm' : '75mm';
  const s = isCR80 ? 0.72 : 1; // Factor de escala para textos y espacios

  // Formatear el número de carnet sin desbordar el casillero
  // Se prioriza el Número de Carnet Físico (Kardex) ingresado en el registro del cliente
  const numCarnet = (() => {
    const fisico = carnet.numero_carnet_fisico || carnet.carnet_fisico;
    if (fisico && String(fisico).trim()) {
      const limpio = String(fisico).trim();
      return /^\d+$/.test(limpio) && limpio.length < 5 ? limpio.padStart(5, '0') : limpio;
    }
    if (!carnet.codigo_carnet) return '000001';
    const match = String(carnet.codigo_carnet).match(/\d+$/);
    if (match) {
      return match[0].padStart(5, '0');
    }
    const clean = String(carnet.codigo_carnet).replace(/[^0-9]/g, '');
    return clean ? clean.slice(-6).padStart(5, '0') : '000001';
  })();

  // Formatear lugar de trabajo / mercado
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

  return (
    <div
      className="carnet-oficial"
      style={{
        width: cardW,
        height: cardH,
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        backgroundColor: '#F5EDCE',
        border: '1px solid #c5b88a',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: `${3 * s}mm`,
        color: '#1a1a1a',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* ── FILA SUPERIOR: Escudo + Institución | Nº + Título ── */}
      <div style={{ display: 'flex', width: '100%', marginBottom: `${2 * s}mm` }}>
        {/* Columna izquierda: Escudo + Textos Institucionales */}
        <div style={{ width: '38%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src={logo}
            alt="Escudo SEDES"
            style={{
              width: `${14 * s}mm`,
              height: `${14 * s}mm`,
              objectFit: 'contain',
              mixBlendMode: 'multiply',
            }}
          />
          <div
            style={{
              textAlign: 'center',
              fontSize: `${5 * s}pt`,
              lineHeight: 1.15,
              marginTop: `${1 * s}mm`,
              fontWeight: 600,
            }}
          >
            GOBIERNO AUTÓNOMO DPTO. BENI<br />
            SERVICIO DEPARTAMENTAL DE SALUD - SEDES BENI<br />
            UNIDAD SALUD AMBIENTAL
          </div>
        </div>

        {/* Columna derecha: Nº Talonario + Título Oficial */}
        <div
          style={{
            width: '62%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: `${1 * s}mm`,
          }}
        >
          <div
            style={{
              color: '#cc0000',
              fontWeight: 'bold',
              fontSize: `${13 * s}pt`,
              display: 'flex',
              alignItems: 'baseline',
              gap: '2px',
            }}
          >
            <span>Nº</span>
            <span
              style={{
                borderBottom: '2px dotted #cc0000',
                minWidth: `${24 * s}mm`,
                textAlign: 'center',
                letterSpacing: '1.5px',
                fontFamily: "'Courier New', monospace",
                fontWeight: 'bold',
              }}
            >
              {numCarnet}
            </span>
          </div>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: `${14 * s}pt`,
              marginTop: `${1.5 * s}mm`,
              letterSpacing: '0.5px',
              textAlign: 'center',
            }}
          >
            CARNET SANITARIO
          </div>
        </div>
      </div>

      {/* ── FILA CENTRAL: Foto a la izquierda | Datos a la derecha ── */}
      <div style={{ display: 'flex', width: '100%', gap: `${2 * s}mm` }}>
        {/* Marco de la Foto del Paciente */}
        <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              width: `${24 * s}mm`,
              height: `${30 * s}mm`,
              border: '1px solid #888',
              backgroundColor: '#fff',
              position: 'relative',
              padding: `${1.2 * s}mm`,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                border: '1px solid #ccc',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fafafa',
              }}
            >
              {carnet.foto_url ? (
                <img
                  src={carnet.foto_url}
                  alt="Foto"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: `${6 * s}pt`, color: '#aaa', fontWeight: 'bold' }}>SIN FOTO</span>
              )}
            </div>

            {/* Número en el pie de la foto */}
            <div
              style={{
                position: 'absolute',
                bottom: `${2 * s}mm`,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#fff',
                border: '1px solid #555',
                padding: '1px 3px',
                fontSize: `${5.5 * s}pt`,
                fontWeight: 'bold',
                letterSpacing: '1px',
                fontFamily: "'Courier New', monospace",
                textAlign: 'center',
                zIndex: 2,
                whiteSpace: 'nowrap',
              }}
            >
              {numCarnet}
            </div>
          </div>
        </div>

        {/* Datos demográficos y de validez */}
        <div
          style={{
            width: '70%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            fontSize: `${7.5 * s}pt`,
            lineHeight: 1.2,
          }}
        >
          {/* Nombre y Apellidos */}
          <CarnetField
            label="Nombre y Apellidos:"
            value={`${carnet.nombres || ''} ${carnet.apellidos || ''}`.trim().toUpperCase()}
            s={s}
          />
          <DottedLine s={s} />

          {/* Actividad / Ocupación */}
          <CarnetField
            label="Actividad:"
            value={(carnet.ocupacion || '').toUpperCase() || '—'}
            s={s}
          />

          {/* Lugar de Trabajo */}
          <CarnetField
            label="Lugar de Trabajo:"
            value={lugarTrabajo}
            s={s}
          />

          {/* Grupo Sanguíneo + Factor Rh */}
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: `${1.2 * s}mm` }}>
            <span style={{ whiteSpace: 'nowrap' }}>Grupo Sanguíneo:</span>
            <span
              style={{
                flex: 1,
                borderBottom: '1.5px dotted #333',
                textAlign: 'center',
                fontWeight: 'bold',
                marginLeft: '2px',
                marginRight: '4px',
                paddingBottom: '1px',
              }}
            >
              {sangre.grupo && sangre.grupo !== '—' ? `"${sangre.grupo}"` : '—'}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>Factor Rh:</span>
            <span
              style={{
                borderBottom: '1.5px dotted #333',
                textAlign: 'center',
                fontWeight: 'bold',
                marginLeft: '2px',
                minWidth: `${8 * s}mm`,
                paddingBottom: '1px',
              }}
            >
              {sangre.rh && sangre.rh !== '—' ? `(${sangre.rh})` : '—'}
            </span>
          </div>

          {/* Fecha de Validez */}
          <CarnetField
            label="Fecha de Validez:"
            value={fechaValidez}
            s={s}
          />
        </div>
      </div>

      {/* ── FILA INFERIOR: Firmas Oficiales ── */}
      <div
        style={{
          position: 'absolute',
          bottom: `${2 * s}mm`,
          left: `${3 * s}mm`,
          right: `${3 * s}mm`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: `${6 * s}pt`,
        }}
      >
        {/* Firma Resp. de Unidad */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ height: `${8 * s}mm`, width: '100%' }} />
          <div
            style={{
              borderTop: '1.5px dotted #333',
              width: '100%',
              textAlign: 'center',
              paddingTop: '2px',
              fontWeight: 600,
            }}
          >
            RESP. DE UNIDAD
          </div>
        </div>

        {/* Nombre Médico Evaluador */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              height: `${8 * s}mm`,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-end',
              paddingBottom: `${0.8 * s}mm`,
            }}
          >
            <span
              style={{
                fontSize: `${6.5 * s}pt`,
                fontWeight: 'bold',
                color: '#1a1a1a',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                lineHeight: 1.1,
              }}
            >
              {carnet.nombre_medico || (typeof carnet.firma_medico === 'string' && !carnet.firma_medico.startsWith('data:') ? carnet.firma_medico : '') || '—'}
            </span>
          </div>
          <div
            style={{
              borderTop: '1.5px dotted #333',
              width: '100%',
              textAlign: 'center',
              paddingTop: '2px',
              fontWeight: 600,
            }}
          >
            MEDICO
          </div>
        </div>
      </div>
    </div>
  );
}

/** Línea de campo con etiqueta y valor rellenado con puntos */
function CarnetField({ label, value, s = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', marginTop: `${1.2 * s}mm` }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <span
        style={{
          flex: 1,
          borderBottom: '1.5px dotted #333',
          textAlign: 'center',
          fontWeight: 'bold',
          marginLeft: '2px',
          paddingBottom: '1px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Línea punteada de continuidad (segunda línea de Nombre) */
function DottedLine({ s = 1 }) {
  return (
    <div
      style={{
        borderBottom: '1.5px dotted #333',
        width: '100%',
        height: `${2.5 * s}mm`,
        marginTop: `${0.5 * s}mm`,
      }}
    />
  );
}
