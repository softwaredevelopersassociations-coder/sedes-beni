import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.jpeg';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Beaker, 
  Stethoscope, 
  BarChart3, 
  Settings, 
  LogOut, 
  UserCheck,
  Menu,
  X,
  Printer
} from 'lucide-react';

export default function DashboardLayout({ activePage, onNavigate, children }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'laboratorio', 'medico'],
    },
    {
      id: 'pacientes-registro',
      label: 'Registrar Paciente',
      icon: UserPlus,
      roles: ['admin'],
    },
    {
      id: 'pacientes-lista',
      label: 'Búsqueda Pacientes',
      icon: Users,
      roles: ['admin', 'laboratorio', 'medico'],
    },
    {
      id: 'laboratorio',
      label: 'Área Laboratorio',
      icon: Beaker,
      roles: ['admin', 'laboratorio'],
    },
    {
      id: 'medicina',
      label: 'Área Médica',
      icon: Stethoscope,
      roles: ['admin', 'medico'],
    },
    {
      id: 'reportes',
      label: 'Reportes y Estadísticas',
      icon: BarChart3,
      roles: ['admin', 'medico'],
    },
    {
      id: 'emision-carnets',
      label: 'Emisión de Carnets',
      icon: Printer,
      roles: ['admin', 'medico'],
    },
    {
      id: 'usuarios-gestion',
      label: 'Gestión de Usuarios',
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.rol));

  const getRoleBadge = (rol) => {
    switch (rol) {
      case 'admin':
        return <span className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full">ADMINISTRADOR</span>;
      case 'laboratorio':
        return <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">LABORATORIO</span>;
      case 'medico':
        return <span className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">MÉDICO</span>;
      default:
        return null;
    }
  };

  const handleNavigate = (id) => {
    onNavigate(id);
    setSidebarOpen(false); // Cierra el sidebar al navegar en móvil
  };

  // Contenido del Sidebar (reutilizado en desktop y drawer móvil)
  const SidebarContent = () => (
    <>
      {/* Brand Logo */}
      <div className="p-4 border-b border-green-900 flex flex-col items-center gap-2">
        <img src={logo} alt="SEDES Beni Logo" className="w-20 h-20 rounded-full object-cover border-2 border-green-500/40 shadow-lg" />
        <div className="text-center">
          <h1 className="font-bold text-xs text-white leading-tight">SALUD AMBIENTAL</h1>
          <span className="text-[9px] text-green-400 leading-none">E Inocuidad Alimentaria · SEDES Beni</span>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id ||
                           (item.id === 'laboratorio' && activePage === 'laboratorio-formulario') ||
                           (item.id === 'medicina' && activePage === 'medicina-formulario') ||
                           (item.id === 'pacientes-lista' && activePage === 'pacientes-historial');
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-green-600 text-white shadow-md shadow-green-500/20'
                  : 'hover:bg-green-900 hover:text-white text-green-200'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer / User Info */}
      <div className="p-4 border-t border-green-900 bg-black/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-green-800 rounded-full flex items-center justify-center text-green-200 shrink-0">
            <UserCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-none mb-1">
              {user?.nombre_completo}
            </p>
            <div className="mt-0.5">{getRoleBadge(user?.rol)}</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-green-400 hover:text-red-400 bg-green-950 border border-green-900 hover:border-red-500/20 hover:bg-red-500/5 rounded-lg transition-all cursor-pointer"
        >
          <LogOut size={14} />
          Cerrar Sesión
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ── OVERLAY (móvil/tablet) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR DRAWER (móvil/tablet) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-green-950 text-green-100 flex flex-col shrink-0 border-r border-green-900 print:hidden
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:hidden`}
      >
        {/* Botón cerrar en drawer */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-green-400 hover:text-white hover:bg-green-800 transition-colors"
        >
          <X size={18} />
        </button>
        <SidebarContent />
      </aside>

      {/* ── SIDEBAR FIJO (desktop lg+) ── */}
      <aside className="hidden lg:flex w-64 bg-green-950 text-green-100 flex-col shrink-0 border-r border-green-900 print:hidden">
        <SidebarContent />
      </aside>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block">

        {/* Topbar móvil/tablet */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-green-950 border-b border-green-900 shrink-0 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-green-300 hover:text-white hover:bg-green-800 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <img src={logo} alt="SEDES Beni" className="w-8 h-8 rounded-full object-cover border border-green-600/40" />
          <div>
            <p className="text-xs font-bold text-white leading-none">SALUD AMBIENTAL</p>
            <p className="text-[9px] text-green-400 leading-none">SEDES Beni</p>
          </div>
          {/* Badge usuario a la derecha */}
          <div className="ml-auto">{getRoleBadge(user?.rol)}</div>
        </header>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto flex flex-col print:overflow-visible print:block">
          <main className="p-4 sm:p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none">
            {children}
          </main>

          {/* Footer */}
          <footer className="py-3 px-4 sm:px-8 border-t border-green-100 text-center text-xs text-green-700 bg-green-50 print:hidden">
            Sistema Digital de Gestión del Carnet Sanitario &bull; Unidad de Salud Ambiental e Inocuidad Alimentaria &bull; SEDES Beni
          </footer>
        </div>
      </div>
    </div>
  );
}
