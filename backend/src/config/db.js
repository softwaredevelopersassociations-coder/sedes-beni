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

// Tablas de la versión anterior. Esa versión usa columnas incompatibles con
// schema.sql. Solo se reconstruyen automáticamente cuando están vacías.
const legacyDataTables = [
  'pacientes',
  'tramites',
  'laboratorios',
  'laboratorio_otros_analisis',
  'consultas_medicas',
  'logs_auditoria',
  'quimica_sanguinea',
  'coproparasitologico',
  'examen_revision_general',
];

async function migrateEmptyLegacySchema() {
  const columnsResult = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios'
  `);
  const columns = new Set(columnsResult.rows.map((row) => row.column_name));

  if (columns.has('username') && columns.has('password')) return false;
  if (!columns.has('nombre_usuario') || !columns.has('password_hash')) return false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingTables = [];
    for (const table of legacyDataTables) {
      const result = await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${table}`]);
      if (result.rows[0].present) existingTables.push(table);
    }

    // Evita perder trámites o expedientes de una instalación antigua.
    for (const table of existingTables) {
      await client.query(`LOCK TABLE public."${table}" IN ACCESS EXCLUSIVE MODE`);
    }

    const populatedTables = [];
    for (const table of existingTables) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM public."${table}"`);
      if (result.rows[0].count > 0) populatedTables.push(table);
    }

    if (populatedTables.length > 0) {
      throw new Error(
        `La base usa el esquema anterior y contiene datos en ${populatedTables.join(', ')}. ` +
        'No se modificó ninguna tabla para proteger esos datos.'
      );
    }

    // Conserva las cuentas existentes y sus hashes bcrypt.
    await client.query('ALTER TABLE public.usuarios RENAME COLUMN nombre_usuario TO username');
    await client.query('ALTER TABLE public.usuarios RENAME COLUMN password_hash TO password');
    if (columns.has('fecha_registro')) {
      await client.query('ALTER TABLE public.usuarios RENAME COLUMN fecha_registro TO created_at');
    }

    // Las demás tablas se comprobaron vacías; se recrearán desde schema.sql.
    for (const table of existingTables) {
      await client.query(`DROP TABLE public."${table}" CASCADE`);
    }

    await client.query('COMMIT');
    console.log('Esquema anterior vacío actualizado; se conservaron los usuarios existentes.');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Función para inicializar la base de datos
async function initDb() {
  try {
    console.log('Intentando conectar con PostgreSQL...');
    // Verificar conexión básica
    await pool.query('SELECT NOW()');
    console.log('Conexión con PostgreSQL establecida con éxito.');

    await migrateEmptyLegacySchema();

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
    throw error;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb
};
