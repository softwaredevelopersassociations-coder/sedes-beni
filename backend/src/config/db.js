const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'cristhiane',
  database: process.env.DB_NAME || 'sedes_beni',
});

// Función para inicializar la base de datos
async function initDb() {
  try {
    console.log('Intentando conectar con PostgreSQL...');
    // Verificar conexión básica
    await pool.query('SELECT NOW()');
    console.log('Conexión con PostgreSQL establecida con éxito.');

    // Leer y ejecutar schema.sql
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Ejecutando script de esquema (schema.sql)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Esquema de base de datos verificado/creado.');
    } else {
      console.warn('Advertencia: No se encontró el archivo schema.sql en:', schemaPath);
    }

    // Verificar si hay usuarios creados. Si no, agregar usuarios semilla.
    const res = await pool.query('SELECT COUNT(*) FROM usuarios');
    const userCount = parseInt(res.rows[0].count);

    if (userCount === 0) {
      console.log('No se encontraron usuarios. Insertando usuarios semilla...');
      const salt = await bcrypt.genSalt(10);
      
      const adminPass = await bcrypt.hash('admin123', salt);
      const labPass = await bcrypt.hash('lab123', salt);
      const medicoPass = await bcrypt.hash('medico123', salt);

      await pool.query(`
        INSERT INTO usuarios (username, password, nombre_completo, rol, activo)
        VALUES 
        ($1, $2, 'Administrador Central', 'admin', true),
        ($3, $4, 'Bioquímica Laboratorio', 'laboratorio', true),
        ($5, $6, 'Médico Evaluador', 'medico', true)
      `, ['admin', adminPass, 'lab', labPass, 'medico', medicoPass]);

      console.log('Usuarios semilla creados exitosamente:');
      console.log(' - Admin: admin / admin123');
      console.log(' - Laboratorio: lab / lab123');
      console.log(' - Médico: medico / medico123');
    }

  } catch (error) {
    console.error('Error al inicializar la base de datos:', error.message);
    console.error('Por favor, asegúrate de que PostgreSQL está ejecutándose y de que las credenciales en .env son correctas.');
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb
};
