const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

// Rutas
const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const laboratoriosRoutes = require('./routes/laboratorios');
const consultasRoutes = require('./routes/consultas');
const estadisticasRoutes = require('./routes/estadisticas');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));

// Configurar límites altos de carga útil para admitir fotos y firmas en Base64
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/laboratorios', laboratoriosRoutes);
app.use('/api/consultas', consultasRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Ruta de estado general
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Iniciar base de datos y arrancar el servidor
async function startServer() {
  // Inicializar base de datos PostgreSQL (Tablas y semilla)
  await db.initDb();

  // Exponer el backend a la red local (0.0.0.0)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor API del Carnet Sanitario ejecutándose en el puerto ${PORT}`);
  });

  // Prevenir que conexiones inactivas de móviles bloqueen los sockets
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer();