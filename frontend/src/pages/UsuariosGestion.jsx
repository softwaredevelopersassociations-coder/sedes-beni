import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { UserCheck, UserX, UserPlus, ShieldAlert, CheckCircle, AlertCircle, Edit3 } from 'lucide-react';

export default function UsuariosGestion() {
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Modal States
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nombre_completo: '',
    rol: 'laboratorio'
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.auth.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError('Error al obtener el listado de usuarios del servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleOpenCreate = () => {
    setFormData({
      username: '',
      password: '',
      nombre_completo: '',
      rol: 'laboratorio'
    });
    setIsEditing(false);
    setSelectedUserId(null);
    setShowModal(true);
    setError('');
  };

  const handleOpenEdit = (user) => {
    setFormData({
      username: user.username,
      password: '', // En blanco por seguridad, solo se rellena si se desea cambiar
      nombre_completo: user.nombre_completo,
      rol: user.rol
    });
    setIsEditing(true);
    setSelectedUserId(user.id);
    setShowModal(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.username.trim() || !formData.nombre_completo.trim() || !formData.rol) {
      setError('Por favor, rellene los campos obligatorios.');
      return;
    }

    if (!isEditing && !formData.password.trim()) {
      setError('La contraseña es obligatoria al registrar un nuevo usuario.');
      return;
    }

    try {
      if (isEditing) {
        await api.auth.updateUser(selectedUserId, formData);
        setSuccess('Usuario actualizado con éxito.');
      } else {
        await api.auth.createUser(formData);
        setSuccess('Usuario creado con éxito.');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al procesar la solicitud.');
    }
  };

  const handleToggleActive = async (userId) => {
    setError('');
    setSuccess('');
    
    if (userId === currentUser.id) {
      setError('No puedes desactivar tu propio usuario en esta sesión.');
      return;
    }

    try {
      const res = await api.auth.toggleUser(userId);
      setSuccess(res.message);
      fetchUsers();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al modificar el estado del usuario.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestión de Personal y Cuentas</h2>
          <p className="text-xs text-slate-500 mt-1">Cree cuentas y administre los accesos del personal bioquímico y médico.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="w-full sm:w-auto justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/10 cursor-pointer transition-colors flex items-center gap-1"
        >
          <UserPlus size={14} />
          Nuevo Usuario
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Usuarios */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-6">ID</th>
                <th className="py-3.5 px-6">Usuario (Login)</th>
                <th className="py-3.5 px-6">Nombre Completo</th>
                <th className="py-3.5 px-6">Rol del Sistema</th>
                <th className="py-3.5 px-6">Estado Cuenta</th>
                <th className="py-3.5 px-6 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-6 font-mono text-slate-400">{u.id}</td>
                  <td className="py-3 px-6 font-semibold text-slate-900">{u.username}</td>
                  <td className="py-3 px-6 font-medium text-slate-800">{u.nombre_completo}</td>
                  <td className="py-3 px-6">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                      u.rol === 'admin' ? 'bg-red-50 text-red-700 border border-red-150' :
                      u.rol === 'laboratorio' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                      'bg-blue-50 text-blue-700 border border-blue-150'
                    }`}>
                      {u.rol.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-6">
                    {u.activo ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                        <UserCheck size={14} /> Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-500 font-bold text-[10px]">
                        <UserX size={14} /> Inactivo
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                        title="Editar Usuario"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        disabled={u.id === currentUser.id}
                        className={`px-2 py-1 font-bold text-[9px] rounded-lg transition-colors cursor-pointer border ${
                          u.activo 
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                        } disabled:opacity-30 disabled:pointer-events-none`}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Formulario de Usuario */}
      {showModal && (
        <div className="bg-slate-900/50 backdrop-blur-xs fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {isEditing ? 'Editar Perfil de Usuario' : 'Registrar Operador en el Sistema'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1.5">Nombre Completo *</label>
                <input
                  type="text"
                  name="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={handleChange}
                  placeholder="Ej. Dr. Mario Ortiz"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1.5">Nombre de Usuario (Login) *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="ej. mortiz"
                  disabled={isEditing}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1.5">
                  {isEditing ? 'Cambiar Contraseña (Opcional)' : 'Contraseña *'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={isEditing ? 'Dejar en blanco para no cambiar' : '••••••••'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1.5">Rol de Operador *</label>
                <select
                  name="rol"
                  value={formData.rol}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500"
                >
                  <option value="laboratorio">Laboratorio (Bioquímica)</option>
                  <option value="medico">Médico (Evaluador)</option>
                  <option value="admin">Administrador (Control total)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  {isEditing ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
