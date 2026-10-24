import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.jpeg';
import { Key, User, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial from-green-950 via-green-950 to-black p-4">
      {/* Background Decorator */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-green-950/70 backdrop-blur-xl border border-green-900/60 p-6 sm:p-8 rounded-2xl shadow-2xl relative">
        
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-28 h-28 rounded-full overflow-hidden border-2 border-green-500/40 shadow-lg shadow-green-500/10 mb-4 mx-auto">
            <img src={logo} alt="SEDES Beni" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SEDES BENI</h1>
          <p className="text-sm text-green-400 mt-1">Gestión Digital del Carnet Sanitario</p>
          <span className="text-[10px] bg-green-900/60 text-green-300 font-medium px-2.5 py-0.5 rounded-full mt-2 inline-block">
            Unidad de Salud Ambiental e Inocuidad Alimentaria
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Usuario
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <User size={16} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-green-950/50 border border-green-800 focus:border-green-500 rounded-xl text-sm text-white placeholder-green-700 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Key size={16} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-green-950/50 border border-green-800 focus:border-green-500 rounded-xl text-sm text-white placeholder-green-700 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-green-700/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer mt-2"
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center text-green-600/60 text-[10px] mt-8">
          Trinidad, Beni - Bolivia &bull; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
