const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

// GET /api/pacientes (Búsqueda avanzada y listado)
router.get('/', verifyToken, async (req, res) => {
  const { query, mercado, ocupacion } = req.query;
  let sql = `
    SELECT p.*, 
           t.id as tramite_id, t.tipo_tramite, t.estado, t.codigo_carnet, t.fecha_vencimiento, t.numero_carnet_fisico
    FROM pacientes p
    LEFT JOIN LATERAL (
      SELECT id, tipo_tramite, estado, codigo_carnet, fecha_vencimiento, numero_carnet_fisico
      FROM tramites 
      WHERE paciente_id = p.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) t ON true
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (query && query.trim() !== '') {
    const searchVal = `%${query.trim()}%`;
    sql += ` AND (p.ci LIKE $${paramIndex} OR p.nombres ILIKE $${paramIndex} OR p.apellidos ILIKE $${paramIndex} OR p.empresa_trabajo ILIKE $${paramIndex})`;
    params.push(searchVal);
    paramIndex++;
  }

  if (mercado && mercado.trim() !== '') {
    sql += ` AND p.mercado ILIKE $${paramIndex}`;
    params.push(`%${mercado.trim()}%`);
    paramIndex++;
  }

  if (ocupacion && ocupacion.trim() !== '') {
    sql += ` AND p.ocupacion ILIKE $${paramIndex}`;
    params.push(`%${ocupacion.trim()}%`);
    paramIndex++;
  }

  sql += ` ORDER BY p.created_at DESC LIMIT 100`;

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    res.status(500).json({ error: 'Error al realizar la búsqueda de pacientes.' });
  }
});

// GET /api/pacientes/aprobados (Listado de carnets aprobados para emisión)
// IMPORTANTE: Esta ruta DEBE estar ANTES de /:id para que Express no interprete "aprobados" como un ID
router.get('/aprobados', verifyToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id as tramite_id, t.tipo_tramite, t.codigo_carnet, t.fecha_emision, t.fecha_vencimiento,
             p.id as paciente_id, p.ci, p.ci_exp, p.nombres, p.apellidos, p.foto_url, p.ocupacion, p.empresa_trabajo, p.mercado,
             l.quimica_sanguinea,
             c.firma_medico
      FROM tramites t
      JOIN pacientes p ON t.paciente_id = p.id
      LEFT JOIN laboratorios l ON l.tramite_id = t.id
      LEFT JOIN consultas_medicas c ON c.tramite_id = t.id
      WHERE t.estado = 'Aprobado'
      ORDER BY t.fecha_emision DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener trámites aprobados:', error);
    res.status(500).json({ error: 'Error al obtener la lista de carnets.' });
  }
});

// GET /api/pacientes/:id (Detalle completo del paciente e historial de trámites)
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener datos del paciente
    const patientRes = await db.query('SELECT * FROM pacientes WHERE id = $1', [id]);
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }
    const paciente = patientRes.rows[0];

    // 2. Obtener historial de trámites con sus resultados asociados
    const tramitesRes = await db.query(`
      SELECT t.id, t.tipo_tramite, t.codigo_carnet, t.estado, t.costo_bs, t.fecha_inicio, t.fecha_emision, t.fecha_vencimiento,
             l.id as lab_id, l.quimica_sanguinea, l.coproparasitologico, l.vih, l.fecha_registro as lab_fecha,
             COALESCE(
               json_agg(
                 json_build_object(
                   'analisis', loa.analisis,
                   'resultado', loa.resultado
                 )
               ) FILTER (WHERE loa.analisis IS NOT NULL),
               '[]'::json
             ) as otros_analisis,
             c.id as consulta_id, c.examen_fisico, c.antecedentes_patologicos, c.diagnostico, c.aprobado, c.firma_medico, c.fecha_consulta
      FROM tramites t
      LEFT JOIN laboratorios l ON l.tramite_id = t.id
      LEFT JOIN laboratorio_otros_analisis loa ON loa.laboratorio_id = l.id
      LEFT JOIN consultas_medicas c ON c.tramite_id = t.id
      WHERE t.paciente_id = $1
      GROUP BY t.id, l.id, c.id
      ORDER BY t.created_at DESC
    `, [id]);

    res.json({
      paciente,
      historial: tramitesRes.rows
    });

  } catch (error) {
    console.error('Error al obtener detalle del paciente:', error);
    res.status(500).json({ error: 'Error al obtener el historial médico.' });
  }
});

// POST /api/pacientes (Registrar nuevo paciente e iniciar trámite)
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  const {
    ci, ci_exp, nombres, apellidos, fecha_nacimiento, genero, telefono,
    ocupacion, empresa_trabajo, mercado, foto_url, tipo_tramite, costo_bs,
    numero_carnet_fisico
  } = req.body;

  if (!ci || !ci_exp || !nombres || !apellidos || !fecha_nacimiento || !genero || !ocupacion || !tipo_tramite) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
  }

  // Validar que número de carnet físico no sea negativo (permite letras/complemento como 5791-1A)
  if (numero_carnet_fisico !== undefined && numero_carnet_fisico !== null && String(numero_carnet_fisico).trim() !== '') {
    const trimmedCarnet = String(numero_carnet_fisico).trim();
    if (trimmedCarnet.startsWith('-') || /^-\d+$/.test(trimmedCarnet)) {
      return res.status(400).json({ error: 'El número de carnet físico no puede ser un número negativo.' });
    }
  }

  // Validar costo_bs no negativo
  if (costo_bs !== undefined && costo_bs !== null && parseFloat(costo_bs) < 0) {
    return res.status(400).json({ error: 'El costo del trámite no puede ser un número negativo.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar si el paciente ya existe por CI
    let pacienteId;
    const existingPatient = await client.query('SELECT id FROM pacientes WHERE ci = $1', [ci.trim()]);

    if (existingPatient.rows.length > 0) {
      pacienteId = existingPatient.rows[0].id;
      // Actualizar datos demográficos del paciente existente
      await client.query(`
        UPDATE pacientes 
        SET ci_exp = $1, nombres = $2, apellidos = $3, fecha_nacimiento = $4, genero = $5, 
            telefono = $6, ocupacion = $7, empresa_trabajo = $8, mercado = $9, foto_url = COALESCE($10, foto_url)
        WHERE id = $11
      `, [ci_exp, nombres, apellidos, fecha_nacimiento, genero, telefono, ocupacion, empresa_trabajo, mercado, foto_url, pacienteId]);
    } else {
      // Crear nuevo paciente
      const newPatient = await client.query(`
        INSERT INTO pacientes (ci, ci_exp, nombres, apellidos, fecha_nacimiento, genero, telefono, ocupacion, empresa_trabajo, mercado, foto_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [ci.trim(), ci_exp, nombres, apellidos, fecha_nacimiento, genero, telefono, ocupacion, empresa_trabajo, mercado, foto_url]);
      pacienteId = newPatient.rows[0].id;
    }

    // 2. Verificar si ya existe un trámite activo o pendiente para este paciente
    const activeTramite = await client.query(`
      SELECT id, estado FROM tramites 
      WHERE paciente_id = $1 AND estado IN ('Pendiente Laboratorio', 'Pendiente Medicina')
    `, [pacienteId]);

    if (activeTramite.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `El paciente ya tiene un trámite activo en estado: ${activeTramite.rows[0].estado}` });
    }

    // 3. Crear el trámite (estado inicial: 'Pendiente Laboratorio')
    const cost = costo_bs || 30.00;
    const tramiteRes = await client.query(`
      INSERT INTO tramites (paciente_id, tipo_tramite, estado, costo_bs, numero_carnet_fisico)
      VALUES ($1, $2, 'Pendiente Laboratorio', $3, $4)
      RETURNING id, tipo_tramite, estado, numero_carnet_fisico
    `, [pacienteId, tipo_tramite, cost, numero_carnet_fisico || null]);

    const newTramite = tramiteRes.rows[0];

    await client.query('COMMIT');

    await logAuditoria(
      req.user.id, 
      'REGISTRO_PACIENTE', 
      `Registró paciente CI: ${ci} e inició trámite de ${tipo_tramite} (ID Trámite: ${newTramite.id})`, 
      req
    );

    res.status(201).json({
      message: 'Paciente registrado e inicio de trámite exitoso.',
      pacienteId,
      tramite: newTramite
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ error: 'Error al registrar el paciente en el sistema.' });
  } finally {
    client.release();
  }
});

// POST /api/pacientes/:id/tramite (Iniciar un nuevo trámite para paciente existente)
router.post('/:id/tramite', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { tipo_tramite, costo_bs } = req.body;

  if (!tipo_tramite) {
    return res.status(400).json({ error: 'El tipo de trámite es obligatorio.' });
  }

  try {
    // 1. Verificar si existe el paciente
    const patientExists = await db.query('SELECT ci FROM pacientes WHERE id = $1', [id]);
    if (patientExists.rows.length === 0) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }
    const ci = patientExists.rows[0].ci;

    // 2. Verificar trámites activos pendientes
    const activeTramite = await db.query(`
      SELECT id, estado FROM tramites 
      WHERE paciente_id = $1 AND estado IN ('Pendiente Laboratorio', 'Pendiente Medicina')
    `, [id]);

    if (activeTramite.rows.length > 0) {
      return res.status(400).json({ error: `El paciente ya tiene un trámite activo en estado: ${activeTramite.rows[0].estado}` });
    }

    // 3. Crear trámite
    const cost = costo_bs || 30.00;
    const result = await db.query(`
      INSERT INTO tramites (paciente_id, tipo_tramite, estado, costo_bs)
      VALUES ($1, $2, 'Pendiente Laboratorio', $3)
      RETURNING id, tipo_tramite, estado, costo_bs
    `, [id, tipo_tramite, cost]);

    await logAuditoria(
      req.user.id, 
      'NUEVO_TRAMITE', 
      `Inició trámite de ${tipo_tramite} para paciente ID: ${id} (CI: ${ci})`, 
      req
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error al iniciar nuevo trámite:', error);
    res.status(500).json({ error: 'Error al iniciar el trámite.' });
  }
});

module.exports = router;
