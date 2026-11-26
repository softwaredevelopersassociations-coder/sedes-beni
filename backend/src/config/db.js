const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'cristhiane',
  database: process.env.DB_NAME || 'sedes_beni',
});

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${tableName}`]);
  return result.rows[0].present;
}

async function tableColumns(client, tableName) {
  const result = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [tableName]);
  return new Set(result.rows.map((row) => row.column_name));
}

async function applyDatabaseSchema() {
  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  const migrationPath = path.join(__dirname, '../../database/migrations/001_align_target_schema.sql');
  const legacyExamMigrationPath = path.join(__dirname, '../../database/migrations/002_allow_null_legacy_exam.sql');
  const deliveryMigrationPath = path.join(__dirname, '../../database/migrations/003_entrega_carnets.sql');
  const deliveryUserMigrationPath = path.join(__dirname, '../../database/migrations/004_entrega_usuario_set_null.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const legacyExamMigrationSql = fs.readFileSync(legacyExamMigrationPath, 'utf8');
  const deliveryMigrationSql = fs.readFileSync(deliveryMigrationPath, 'utf8');
  const deliveryUserMigrationSql = fs.readFileSync(deliveryUserMigrationPath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (version VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await client.query('BEGIN');

    const hasUsers = await tableExists(client, 'usuarios');
    if (!hasUsers) {
      await client.query(schemaSql);
    } else {
      const userColumns = await tableColumns(client, 'usuarios');
      const tramiteColumns = await tableColumns(client, 'tramites');
      const hasTargetMedical = await tableExists(client, 'examen_revision_general');
      const isLegacy = userColumns.has('username') && userColumns.has('password')
        && tramiteColumns.has('numero_carnet_fisico') && !tramiteColumns.has('numero_carnet_sanitario');
      const isTarget = userColumns.has('nombre_usuario') && userColumns.has('password_hash')
        && tramiteColumns.has('numero_carnet_sanitario') && hasTargetMedical;

      if (isLegacy) {
        const applied = await client.query('SELECT 1 FROM public.schema_migrations WHERE version = $1', ['001_align_target_schema']);
        if (applied.rows.length === 0) {
          await client.query(migrationSql);
          await client.query(schemaSql);
          await client.query('INSERT INTO public.schema_migrations(version) VALUES ($1)', ['001_align_target_schema']);
          console.log('Migración 001 aplicada: esquema y datos anteriores alineados.');
        } else {
          throw new Error('La migración 001 figura aplicada, pero se detectó nuevamente el esquema antiguo. Se detuvo el arranque sin modificar datos.');
        }
      } else if (isTarget) {
        await client.query(schemaSql);
      } else {
        throw new Error('El esquema de la base no coincide con el legado conocido ni con el esquema objetivo; se detuvo el arranque para evitar una modificación insegura.');
      }
    }

    const legacyExamMigration = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE version = $1',
      ['002_allow_null_legacy_exam']
    );
    if (legacyExamMigration.rows.length === 0) {
      await client.query(legacyExamMigrationSql);
      await client.query('INSERT INTO public.schema_migrations(version) VALUES ($1)', ['002_allow_null_legacy_exam']);
      console.log('Migración 002 aplicada: el examen heredado acepta NULL en consultas nuevas.');
    }

    const deliveryMigration = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE version = $1',
      ['003_entrega_carnets']
    );
    if (deliveryMigration.rows.length === 0) {
      await client.query(deliveryMigrationSql);
      await client.query('INSERT INTO public.schema_migrations(version) VALUES ($1)', ['003_entrega_carnets']);
      console.log('Migración 003 aplicada: seguimiento de entrega física de carnets.');
    }

    const deliveryUserMigration = await client.query(
      'SELECT 1 FROM public.schema_migrations WHERE version = $1',
      ['004_entrega_usuario_set_null']
    );
    if (deliveryUserMigration.rows.length === 0) {
      await client.query(deliveryUserMigrationSql);
      await client.query('INSERT INTO public.schema_migrations(version) VALUES ($1)', ['004_entrega_usuario_set_null']);
      console.log('Migración 004 aplicada: las entregas conservan su historial al eliminar un usuario.');
    }

    const userCount = await client.query('SELECT COUNT(*)::int AS count FROM public.usuarios');
    if (userCount.rows[0].count === 0) {
      const passwords = await Promise.all(['admin123', 'lab123', 'medico123'].map((value) => bcrypt.hash(value, 10)));
      await client.query(`
        INSERT INTO usuarios (nombre_usuario, password_hash, nombre_completo, rol, activo)
        VALUES
          ('admin', $1, 'Administrador Central', 'admin', true),
          ('lab', $2, 'Bioquímica Laboratorio', 'laboratorio', true),
          ('medico', $3, 'Médico Evaluador', 'medico', true)
      `, passwords);
      console.log('Usuarios semilla creados.');
    }

    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function initDb() {
  try {
    console.log('Intentando conectar con PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('Conexión con PostgreSQL establecida con éxito.');
    await applyDatabaseSchema();
    console.log('Esquema de base de datos verificado.');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error.message);
    console.error('Por favor, asegúrate de que PostgreSQL está ejecutándose y de que las credenciales en .env son correctas.');
    throw error;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
};
