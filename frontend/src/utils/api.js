const API_URL = '/api';

// Helper para realizar peticiones HTTP
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Ocurrió un error en el servidor.');
  }

  return data;
}

const api = {
  // Autenticación y Usuarios
  auth: {
    login: (username, password) => 
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    me: () => request('/auth/me'),
    getUsers: () => request('/auth/users'),
    createUser: (userData) => 
      request('/auth/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    updateUser: (id, userData) => 
      request(`/auth/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }),
    toggleUser: (id) => 
      request(`/auth/users/${id}/toggle`, {
        method: 'PUT',
      }),
  },

  // Pacientes y Trámites
  pacientes: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.mercado) params.append('mercado', filters.mercado);
      if (filters.ocupacion) params.append('ocupacion', filters.ocupacion);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return request(`/pacientes${queryStr}`);
    },
    getAprobados: () => request('/pacientes/aprobados'),
    get: (id) => request(`/pacientes/${id}`),
    register: (patientData) => 
      request('/pacientes', {
        method: 'POST',
        body: JSON.stringify(patientData),
      }),
    openTramite: (id, tramiteData) => 
      request(`/pacientes/${id}/tramite`, {
        method: 'POST',
        body: JSON.stringify(tramiteData),
      }),
  },

  // Laboratorio
  laboratorios: {
    getPendientes: () => request('/laboratorios/pendientes'),
    saveResults: (tramiteId, labData) => 
      request(`/laboratorios/${tramiteId}`, {
        method: 'POST',
        body: JSON.stringify(labData),
      }),
  },

  // Medicina / Consulta
  consultas: {
    getPendientes: () => request('/consultas/pendientes'),
    saveConsult: (tramiteId, consultData) => 
      request(`/consultas/${tramiteId}`, {
        method: 'POST',
        body: JSON.stringify(consultData),
      }),
  },

  // Estadísticas e Informes
  estadisticas: {
    getResumen: () => request('/estadisticas/resumen'),
    getMensuales: () => request('/estadisticas/mensuales'),
    getLabResumen: () => request('/estadisticas/laboratorio-resumen'),
    getRubros: () => request('/estadisticas/rubros-mercados'),
    getForm303: (mes) => {
      const query = mes ? `?mes=${mes}` : '';
      return request(`/estadisticas/formulario303${query}`);
    },
    getAuditoria: () => request('/estadisticas/auditoria'),
  },
};

export default api;