import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import DashboardLayout from './components/DashboardLayout';

// Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RegistroPaciente from './pages/RegistroPaciente';
import PacientesLista from './pages/PacientesLista';
import Laboratorio from './pages/Laboratorio';
import ConsultaMedica from './pages/ConsultaMedica';
import Reportes from './pages/Reportes';
import UsuariosGestion from './pages/UsuariosGestion';
import EmisionCarnets from './pages/EmisionCarnets';

function NavigationRouter() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sharedData, setSharedData] = useState(null); // Para pasar datos entre páginas (ej. paciente a evaluar)

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-3">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-400 animate-pulse">Iniciando sistema de SEDES Beni...</p>
      </div>
    );
  }

  // Si no está autenticado, renderizar Login
  if (!user) {
    return <Login />;
  }

  // Renderizado dinámico de páginas (Enrutador de Estado)
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={setActivePage} 
            setSharedData={setSharedData} 
          />
        );
      case 'pacientes-registro':
        return <RegistroPaciente onNavigate={setActivePage} />;
      case 'pacientes-lista':
        return (
          <PacientesLista 
            onNavigate={setActivePage} 
            setSharedData={setSharedData} 
          />
        );
      case 'laboratorio':
      case 'laboratorio-formulario':
        return (
          <Laboratorio 
            sharedData={sharedData} 
            setSharedData={setSharedData} 
            onNavigate={setActivePage} 
          />
        );
      case 'medicina':
      case 'medicina-formulario':
        return (
          <ConsultaMedica 
            sharedData={sharedData} 
            setSharedData={setSharedData} 
            onNavigate={setActivePage} 
          />
        );
      case 'reportes':
        return <Reportes />;
      case 'usuarios-gestion':
        return <UsuariosGestion />;
      case 'emision-carnets':
        return <EmisionCarnets />;
      default:
        return (
          <div className="p-6 text-center text-slate-500 bg-white border rounded-xl">
            Página en desarrollo o no encontrada.
          </div>
        );
    }
  };

  return (
    <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationRouter />
    </AuthProvider>
  );
}
