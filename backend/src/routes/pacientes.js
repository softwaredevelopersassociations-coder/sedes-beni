const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

const ciCompletoSql = (alias = 'p') => `CASE WHEN ${alias}.cedula_complemento IS NULL THEN ${alias}.cedula_identidad ELSE ${alias}.cedula_identidad || '-' || ${alias}.cedula_complemento END`;

function parseCedula(cedula, complemento) {
  let identidad = String(cedula || '').trim().toUpperCase();
  let ciComplemento = String(complemento || '').trim().toUpperCase() || null;
  if (!ciComplemento) {
    const match = identidad.match(/^([0-9]+)-([A-Z0-9]{1,5})$/);
    if (match) {
      identidad = match[1];
      ciComplemento = match[2];
    }
  }
  return { identidad, complemento: ciComplemento };
}

function normalizeCardNumber(value) {
  return String(value || '').trim().toUpperCase();
}

function validateCardNumber(value) {
  if (!value) return 'El número de carnet sanitario es obligatorio.';
  if (value.length > 20) return 'El número de carnet sanitario admite hasta 20 caracteres.';
  if (value.startsWith('-') || /^-\d+$/.test(value)) return 'El número de carnet sanitario no puede ser negativo.';
  return null;
}

// GET /api/pacientes
router.get('/', verifyToken, async (req, res) => {
  const { query, mercado, ocupacion, filtro_estado } = req.query;
  let sql = `
    SELECT p.*, ${ciCompletoSql('p')} AS ci, p.ci_expedido AS ci_exp,
           p.fecha_registro AS created_at,
           t.id AS tramite_id, t.tipo_tramite, t.estado, t.codigo_carnet,
           t.fecha_vencimiento, t.numero_carnet_sanitario AS numero_carnet_fisico,
           t_prev.codigo_carnet AS ultimo_codigo_carnet,
           t_prev.fecha_vencimiento AS ultima_fecha_vencimiento,
           t_prev.numero_carnet_sanitario AS ultimo_numero_carnet_fisico
    FROM pacientes p
    LEFT JOIN LATERAL (
      SELECT id, tipo_tramite, estado, codigo_carnet, fecha_vencimiento,
             numero_carnet_sanitario, fecha_registro
      FROM tramites WHERE paciente_id = p.id
      ORDER BY fecha_registro DESC, id DESC LIMIT 1
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT codigo_carnet, fecha_vencimiento, numero_carnet_sanitario, fecha_registro
      FROM tramites WHERE paciente_id = p.id AND estado = 'Aprobado'
      ORDER BY fecha_vencimiento DESC NULLS LAST, fecha_registro DESC LIMIT 1
    ) t_prev ON true
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (query && query.trim()) {
    const searchVal = `%${query.trim()}%`;
    sql += ` AND (
      ${ciCompletoSql('p')} ILIKE $${paramIndex}
      OR p.nombres ILIKE $${paramIndex}
      OR p.apellidos ILIKE $${paramIndex}
      OR p.empresa_trabajo ILIKE $${paramIndex}
      OR t.numero_carnet_sanitario ILIKE $${paramIndex}
      OR t.codigo_carnet ILIKE $${paramIndex}
      OR EXISTS (SELECT 1 FROM tramites tr WHERE tr.paciente_id = p.id
                 AND (tr.numero_carnet_sanitario ILIKE $${paramIndex} OR tr.codigo_carnet ILIKE $${paramIndex}))
    )`;
    params.push(searchVal);
    paramIndex += 1;
  }
  if (mercado && mercado.trim()) {
    sql += ` AND p.mercado ILIKE $${paramIndex}`;
    params.push(`%${mercado.trim()}%`);
    paramIndex += 1;
  }
  if (ocupacion && ocupacion.trim()) {
    sql += ` AND p.ocupacion ILIKE $${paramIndex}`;
    params.push(`%${ocupacion.trim()}%`);
    paramIndex += 1;
  }
  if (filtro_estado === 'vencidos') {
    sql += ` AND ((t.estado = 'Aprobado' AND t.fecha_vencimiento < CURRENT_DATE)
      OR (t_prev.fecha_vencimiento IS NOT NULL AND t_prev.fecha_vencimiento < CURRENT_DATE
      AND (t.estado IS NULL OR t.estado NOT IN ('Aprobado', 'Pendiente Laboratorio', 'Pendiente Medicina'))))`;
  } else if (filtro_estado === 'vigentes') {
    sql += ` AND t.estado = 'Aprobado' AND t.fecha_vencimiento >= CURRENT_DATE`;
  } else if (filtro_estado === 'en_tramite') {
    sql += ` AND t.estado IN ('Pendiente Laboratorio', 'Pendiente Medicina')`;
  }
  sql += ' ORDER BY p.fecha_registro DESC LIMIT 150';

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    res.status(500).json({ error: 'Error al realizar la búsqueda de pacientes.' });
  }
});

// GET /api/pacientes/aprobados
router.get('/aprobados', verifyToken, async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id AS tramite_id, t.tipo_tramite, t.codigo_carnet, t.estado,
             t.numero_carnet_sanitario AS numero_carnet_fisico,
             t.fecha_emision, t.fecha_vencimiento, p.id AS paciente_id,
             ${ciCompletoSql('p')} AS ci, p.ci_expedido AS ci_exp,
             p.nombres, p.apellidos, p.foto_url, p.ocupacion, p.empresa_trabajo, p.mercado,
             COALESCE(l.datos_compatibilidad->'quimica_sanguinea', jsonb_build_object(
               'glucosa', q.glucosa, 'urea', q.urea, 'creatinina', q.creatinina,
               'grupo_sanguineo', q.grupo_sanguineo, 'factor_rh', q.factor_rh
             )) AS quimica_sanguinea,
             c.firma_medico
      FROM tramites t
      JOIN pacientes p ON p.id = t.paciente_id
      LEFT JOIN LATERAL (
        SELECT * FROM laboratorios WHERE tramite_id = t.numero_carnet_sanitario
        ORDER BY fecha_registro DESC, id DESC LIMIT 1
      ) l ON true
      LEFT JOIN quimica_sanguinea q ON q.id_sanguinea = l.quimica_sanguinea_id
      LEFT JOIN LATERAL (
        SELECT firma_medico FROM consultas_medicas
        WHERE tramite_id = t.numero_carnet_sanitario
        ORDER BY fecha_consulta DESC, id DESC LIMIT 1
      ) c ON true
      WHERE t.estado = 'Aprobado'
         OR (t.estado = 'Pendiente Medicina' AND EXISTS (
           SELECT 1 FROM laboratorios lab_registrado
           WHERE lab_registrado.tramite_id = t.numero_carnet_sanitario
         ))
      ORDER BY t.fecha_emision DESC NULLS LAST, t.id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener trámites aprobados:', error);
    res.status(500).json({ error: 'Error al obtener la lista de carnets.' });
  }
});

// GET /api/pacientes/:id
router.get('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const patientRes = await db.query(`
      SELECT p.*, ${ciCompletoSql('p')} AS ci, p.ci_expedido AS ci_exp,
             p.fecha_registro AS created_at
      FROM pacientes p WHERE p.id = $1
    `, [id]);
    if (patientRes.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado.' });

    const tramitesRes = await db.query(`
      SELECT t.id, t.numero_carnet_sanitario AS numero_carnet_fisico,
             t.tipo_tramite, t.codigo_carnet, t.estado, t.costo_bs,
             t.fecha_inicio, t.fecha_emision, t.fecha_vencimiento,
             l.id AS lab_id,
             COALESCE(l.datos_compatibilidad->'quimica_sanguinea', jsonb_build_object(
               'glucosa', q.glucosa, 'urea', q.urea, 'creatinina', q.creatinina,
               'grupo_sanguineo', q.grupo_sanguineo, 'factor_rh', q.factor_rh
             )) AS quimica_sanguinea,
             COALESCE(l.datos_compatibilidad->'coproparasitologico', jsonb_build_object(
               'aspecto', cp.aspecto, 'moco', cp.moco, 'sangre_macroscopica', cp.sangre_macroscopica,
               'examen_microscopico', cp.examen_microscopico_directo, 'parasito', cp.examen_microscopico_directo
             )) AS coproparasitologico,
             COALESCE(l.datos_compatibilidad->'vih', jsonb_build_object(
               'realizado', l.vih_realizado, 'resultado', l.vih_resultado,
               'consentimiento', l.vih_consentimiento,
               'mostrar_en_registro_medico', l.vih_mostrar_en_registro_medico
             )) AS vih,
             l.observaciones AS lab_observaciones, l.fecha_registro AS lab_fecha,
             COALESCE(oa.otros_analisis, '[]'::jsonb) AS otros_analisis,
             c.id AS consulta_id, c.antecedentes_patologicos, c.diagnostico,
             c.aprobado, c.firma_medico, c.fecha_consulta,
             CASE WHEN e.id_examen IS NULL THEN NULL ELSE jsonb_build_object(
               'evaluacion_dermica', e.evaluacion_dermica,
               'evaluacion_respiratoria', e.evaluacion_respiratoria,
               'evaluacion_cardiovascular', e.evaluacion_cardiovascular,
               'evaluacion_gastrointestinal', e.evaluacion_gastrointestinal,
               'peso', e.peso, 'altura', e.altura, 'presion', e.presion,
               'temperatura', e.temperatura, 'pulso', e.pulso
             ) END AS revision_general
      FROM tramites t
      LEFT JOIN LATERAL (
        SELECT * FROM laboratorios WHERE tramite_id = t.numero_carnet_sanitario
        ORDER BY fecha_registro DESC, id DESC LIMIT 1
      ) l ON true
      LEFT JOIN quimica_sanguinea q ON q.id_sanguinea = l.quimica_sanguinea_id
      LEFT JOIN coproparasitologico cp ON cp.id_coproparasitologico = l.coproparasitologico_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('analisis', analisis, 'resultado', resultado) ORDER BY id) AS otros_analisis
        FROM laboratorio_otros_analisis WHERE laboratorio_id = l.id
      ) oa ON true
      LEFT JOIN consultas_medicas c ON c.tramite_id = t.numero_carnet_sanitario
      LEFT JOIN examen_revision_general e ON e.id_examen = c.examen_revision_general_id
      WHERE t.paciente_id = $1
      ORDER BY t.fecha_registro DESC, c.fecha_consulta DESC NULLS LAST, t.id DESC
    `, [id]);
    res.json({ paciente: patientRes.rows[0], historial: tramitesRes.rows });
  } catch (error) {
    console.error('Error al obtener detalle del paciente:', error);
    res.status(500).json({ error: 'Error al obtener el historial médico.' });
  }
});

// POST /api/pacientes
router.post('/', verifyToken, checkRole(['admin']), async (req, res) => {
  const {
    ci, cedula_complemento, ci_exp, nombres, apellidos, fecha_nacimiento, genero, telefono,
    ocupacion, empresa_trabajo, mercado, foto_url, tipo_tramite, costo_bs,
  } = req.body;
  const { identidad, complemento } = parseCedula(ci, cedula_complemento);
  const numeroCarnet = normalizeCardNumber(req.body.numero_carnet_sanitario || req.body.numero_carnet_fisico);

  if (!identidad || !ci_exp || !nombres || !apellidos || !fecha_nacimiento || !genero || !ocupacion || !tipo_tramite) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
  }
  const cardError = validateCardNumber(numeroCarnet);
  if (cardError) return res.status(400).json({ error: cardError });
  if (complemento && complemento.length > 5) return res.status(400).json({ error: 'El complemento de la cédula admite hasta 5 caracteres.' });
  if (costo_bs !== undefined && costo_bs !== null && (!Number.isFinite(Number(costo_bs)) || Number(costo_bs) < 0)) {
    return res.status(400).json({ error: 'El costo del trámite debe ser un número válido no negativo.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const existingPatient = await client.query(`
      SELECT id, nombres, apellidos FROM pacientes
      WHERE cedula_identidad = $1 AND cedula_complemento IS NOT DISTINCT FROM $2
    `, [identidad, complemento]);
    if (existingPatient.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `El paciente con C.I. ${ci.trim()} ya se encuentra registrado. La renovación se realiza desde "Búsqueda de Pacientes".`,
        pacienteExistente: true,
        pacienteId: existingPatient.rows[0].id,
      });
    }

    const patient = await client.query(`
      INSERT INTO pacientes (
        cedula_identidad, cedula_complemento, ci_expedido, nombres, apellidos,
        fecha_nacimiento, genero, telefono, ocupacion, empresa_trabajo, mercado, foto_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `, [
      identidad, complemento, ci_exp.trim().toUpperCase(), nombres.trim(), apellidos.trim(),
      fecha_nacimiento, genero, telefono || null, ocupacion.trim(), empresa_trabajo || null,
      mercado || null, foto_url || null,
    ]);
    const pacienteId = patient.rows[0].id;

    const active = await client.query(`
      SELECT id, estado FROM tramites WHERE paciente_id = $1
      AND estado IN ('Pendiente Laboratorio', 'Pendiente Medicina')
    `, [pacienteId]);
    if (active.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `El paciente ya tiene un trámite activo en estado: ${active.rows[0].estado}` });
    }

    const cost = costo_bs === undefined || costo_bs === null || costo_bs === '' ? 30 : Number(costo_bs);
    const tramiteRes = await client.query(`
      INSERT INTO tramites (numero_carnet_sanitario, paciente_id, tipo_tramite, estado, costo_bs)
      VALUES ($1, $2, $3, 'Pendiente Laboratorio', $4)
      RETURNING id, numero_carnet_sanitario AS numero_carnet_fisico, tipo_tramite, estado
    `, [numeroCarnet, pacienteId, tipo_tramite, cost]);
    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      'REGISTRO_PACIENTE',
      `Registró paciente CI: ${identidad}${complemento ? `-${complemento}` : ''} e inició trámite de ${tipo_tramite} (N° ${numeroCarnet})`,
      req
    );
    res.status(201).json({ message: 'Paciente registrado e inicio de trámite exitoso.', pacienteId, tramite: tramiteRes.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error al registrar paciente:', error);
    if (error.code === '23505') return res.status(400).json({ error: 'Ya existe un registro con esos datos (cédula o número de carnet sanitario).' });
    if (error.code === '22001') return res.status(400).json({ error: 'Uno o más datos superan el límite de caracteres permitido.' });
    res.status(500).json({ error: error.message || 'Error al registrar el paciente en el sistema.' });
  } finally {
    client.release();
  }
});

// POST /api/pacientes/:id/tramite
router.post('/:id/tramite', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const tipoTramite = req.body.tipo_tramite || 'Renovación';
  const numeroCarnet = normalizeCardNumber(req.body.numero_carnet_sanitario || req.body.numero_carnet_fisico);
  const { costo_bs } = req.body;
  const cardError = validateCardNumber(numeroCarnet);
  if (cardError) return res.status(400).json({ error: cardError });
  if (costo_bs !== undefined && costo_bs !== null && costo_bs !== ''
      && (!Number.isFinite(Number(costo_bs)) || Number(costo_bs) < 0)) {
    return res.status(400).json({ error: 'El costo del trámite debe ser un número válido no negativo.' });
  }
  try {
    const patientRes = await db.query(`
      SELECT ${ciCompletoSql('p')} AS ci, p.nombres, p.apellidos FROM pacientes p WHERE p.id = $1
    `, [id]);
    if (patientRes.rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado.' });
    const patient = patientRes.rows[0];
    const active = await db.query(`
      SELECT id, estado FROM tramites WHERE paciente_id = $1
      AND estado IN ('Pendiente Laboratorio', 'Pendiente Medicina')
    `, [id]);
    if (active.rows.length > 0) {
      return res.status(400).json({ error: `El paciente ya tiene un trámite activo en estado: "${active.rows[0].estado}". Debe completarse antes de iniciar una nueva renovación.` });
    }
    const cost = costo_bs === undefined || costo_bs === null || costo_bs === '' ? 30 : Number(costo_bs);
    const result = await db.query(`
      INSERT INTO tramites (numero_carnet_sanitario, paciente_id, tipo_tramite, estado, costo_bs)
      VALUES ($1, $2, $3, 'Pendiente Laboratorio', $4)
      RETURNING id, numero_carnet_sanitario AS numero_carnet_fisico, tipo_tramite, estado, costo_bs
    `, [numeroCarnet, id, tipoTramite, cost]);
    await logAuditoria(
      req.user.id,
      'RENOVACION_CARNET',
      `Inició trámite de ${tipoTramite} para paciente ${patient.nombres} ${patient.apellidos} (CI: ${patient.ci}, ID: ${id}, N°: ${numeroCarnet})`,
      req
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al iniciar renovación de trámite:', error);
    if (error.code === '23505') return res.status(400).json({ error: 'El número de carnet sanitario ya está registrado.' });
    if (error.code === '22001') return res.status(400).json({ error: 'Uno o más datos superan el límite de caracteres permitido.' });
    res.status(500).json({ error: error.message || 'Error al iniciar el trámite de renovación.' });
  }
});

module.exports = router;
