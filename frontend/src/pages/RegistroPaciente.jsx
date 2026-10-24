import React, { useState } from 'react';
import api from '../utils/api';
import WebcamCapture from '../components/WebcamCapture';
import { UserCheck, AlertCircle, PlusCircle, CheckCircle } from 'lucide-react';

const DEPARTAMENTOS = [
  { value: 'BE', label: 'Beni' },
  { value: 'LP', label: 'La Paz' },
  { value: 'SC', label: 'Santa Cruz' },
  { value: 'CB', label: 'Cochabamba' },
  { value: 'OR', label: 'Oruro' },
  { value: 'PT', label: 'Potosí' },
  { value: 'CH', label: 'Chuquisaca' },
  { value: 'TJ', label: 'Tarija' },
  { value: 'PD', label: 'Pando' }
];

const OCUPACIONES = [
  'Manipulador de Alimentos',
  'Cocinero / Chef',
  'Mesero / Garzón',
  'Vendedor de Mercado',
  'Panadero / Pastelero',
  'Carnicero / Expendedor',
  'Distribuidor de Alimentos',
  'Personal de Limpieza',
  'Estilista / Peluquero',
  'Trabajo Sexual',
  'Otro'
];

export default function RegistroPaciente({ onNavigate }) {
  const [formData, setFormData] = useState({
    ci: '',
    ci_exp: 'BE',
    nombres: '',
    apellidos: '',
    fecha_nacimiento: '',
    genero: 'Masculino',
    telefono: '',
    ocupacion: 'Manipulador de Alimentos',
    empresa_trabajo: '',
    mercado: '',
    foto_url: '',
    tipo_tramite: 'Apertura',
    costo_bs: 30.00,
    numero_carnet_fisico: ''
  });

  const [ocupacionOtro, setOcupacionOtro] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Número de carnet físico: permite letras (complemento), números y guión, pero no número negativo al inicio
    if (name === 'numero_carnet_fisico') {
      let sanitized = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (sanitized.startsWith('-')) {
        sanitized = sanitized.replace(/^-+/, '');
      }
      setFormData(prev => ({
        ...prev,
        [name]: sanitized
      }));
      return;
    }

    // CI: permite números, letras y guión para complemento (ej. 1234567-1A)
    if (name === 'ci') {
      let sanitized = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (sanitized.startsWith('-')) {
        sanitized = sanitized.replace(/^-+/, '');
      }
      setFormData(prev => ({
        ...prev,
        [name]: sanitized
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'costo_bs' ? Math.max(0, parseFloat(value) || 0) : value
    }));
  };

  const handleCapturePhoto = (base64Photo) => {
    setFormData(prev => ({
      ...prev,
      foto_url: base64Photo
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const finalOcupacion = formData.ocupacion === 'Otro' ? ocupacionOtro.trim() : formData.ocupacion;

    // Validaciones básicas
    if (!formData.ci.trim() || !formData.nombres.trim() || !formData.apellidos.trim() || !formData.fecha_nacimiento || !finalOcupacion) {
      setError(formData.ocupacion === 'Otro' && !ocupacionOtro.trim()
        ? 'Por favor, especifica el detalle de la ocupación en el campo "Especificar Otro".'
        : 'Por favor, rellena todos los campos obligatorios marcados con (*).'
      );
      return;
    }

    // Validar que el número de carnet físico no sea un número negativo
    if (formData.numero_carnet_fisico) {
      const trimmed = formData.numero_carnet_fisico.trim();
      if (trimmed.startsWith('-') || /^-\d+$/.test(trimmed)) {
        setError('El número de carnet físico no puede ser un número negativo.');
        return;
      }
    }

    if (!formData.foto_url) {
      setError('Es obligatorio capturar o subir la fotografía del paciente para el carnet.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        ocupacion: finalOcupacion
      };

      const response = await api.pacientes.register(payload);
      setSuccess(response.message);
      
      // Limpiar formulario excepto por campos por defecto
      setFormData({
        ci: '',
        ci_exp: 'BE',
        nombres: '',
        apellidos: '',
        fecha_nacimiento: '',
        genero: 'Masculino',
        telefono: '',
        ocupacion: 'Manipulador de Alimentos',
        empresa_trabajo: '',
        mercado: '',
        foto_url: '',
        tipo_tramite: 'Apertura',
        costo_bs: 30.00,
        numero_carnet_fisico: ''
      });
      setOcupacionOtro('');

      // Hacer scroll al principio para ver el banner de éxito
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error al registrar al paciente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Apertura y Registro de Trámite</h2>
        <p className="text-xs text-slate-500 mt-1">Registra los datos demográficos del solicitante y crea un nuevo carnet sanitario.</p>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-xl flex items-start gap-2.5 shadow-xs">
          <CheckCircle className="shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-bold">{success}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">El paciente ha sido derivado a la cola de Laboratorio.</p>
            <button 
              onClick={() => onNavigate('dashboard')} 
              className="mt-2 text-[10px] font-bold text-emerald-800 underline hover:text-emerald-950 cursor-pointer block"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Captura de Foto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center">
          <WebcamCapture onCapture={handleCapturePhoto} initialImage={formData.foto_url} />
          <div className="text-[10px] text-slate-400 mt-4 text-center leading-relaxed">
            Asegúrese de que el rostro del paciente esté bien iluminado y centrado para la impresión del carnet físico.
          </div>
        </div>

        {/* Columna Derecha: Datos del Formulario */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs md:col-span-2 space-y-6">
          
          {/* Sección Demográficos */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 pb-1 border-b border-slate-100">Datos Personales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombres *</label>
                <input
                  type="text"
                  name="nombres"
                  value={formData.nombres}
                  onChange={handleChange}
                  placeholder="Juan"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Apellidos *</label>
                <input
                  type="text"
                  name="apellidos"
                  value={formData.apellidos}
                  onChange={handleChange}
                  placeholder="Pérez Mamani"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Cédula de Identidad *</label>
                  <input
                    type="text"
                    name="ci"
                    value={formData.ci}
                    onChange={handleChange}
                    placeholder="9876543"
                    disabled={loading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Expedido *</label>
                  <select
                    name="ci_exp"
                    value={formData.ci_exp}
                    onChange={handleChange}
                    disabled={loading}
                    className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    {DEPARTAMENTOS.map(d => (
                      <option key={d.value} value={d.value}>{d.value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Fecha de Nacimiento *</label>
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Género *</label>
                <select
                  name="genero"
                  value={formData.genero}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Teléfono / Celular</label>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="76543210"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Sección Laborales */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 pb-1 border-b border-slate-100">Datos Ocupacionales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ocupación / Rubro *</label>
                <select
                  name="ocupacion"
                  value={formData.ocupacion}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  {OCUPACIONES.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {formData.ocupacion === 'Otro' && (
                <div>
                  <label className="block text-xs font-semibold text-blue-600 mb-1.5">Especificar Ocupación / Rubro *</label>
                  <input
                    type="text"
                    value={ocupacionOtro}
                    onChange={(e) => setOcupacionOtro(e.target.value)}
                    placeholder="Escribe el rubro o trabajo específico"
                    disabled={loading}
                    required
                    className="w-full px-3 py-2 border border-blue-300 ring-2 ring-blue-100 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors bg-blue-50/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Empresa / Negocio</label>
                <input
                  type="text"
                  name="empresa_trabajo"
                  value={formData.empresa_trabajo}
                  onChange={handleChange}
                  placeholder="Restaurante El Beni"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mercado (Si aplica)</label>
                <input
                  type="text"
                  name="mercado"
                  value={formData.mercado}
                  onChange={handleChange}
                  placeholder="Mercado Pompeya / Puesto N° 12"
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Sección Trámite */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 pb-1 border-b border-slate-100">Configuración del Trámite</h3>

            {/* N° de Carnet Físico — campo principal */}
            <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-xl">
              <label className="block text-sm font-bold text-blue-700 mb-2">
                🪪 N° de Carnet Físico
                <span className="ml-2 text-[11px] font-normal text-blue-500">(Número pre-impreso en el carnet / factura de caja)</span>
              </label>
              <input
                type="text"
                name="numero_carnet_fisico"
                value={formData.numero_carnet_fisico}
                onChange={handleChange}
                placeholder="Ej. 5791 o 5791-1A"
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl text-2xl font-bold font-mono text-blue-800 outline-none focus:border-blue-600 bg-white tracking-widest placeholder:text-blue-200 placeholder:text-lg uppercase"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo de Trámite *</label>
                <select
                  name="tipo_tramite"
                  value={formData.tipo_tramite}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Apertura">Apertura (Primera vez)</option>
                  <option value="Renovación">Renovación (Anual)</option>
                </select>
              </div>


            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-1.5"
            >
              <PlusCircle size={15} />
              {loading ? 'Registrando...' : 'Registrar Paciente e Iniciar'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
