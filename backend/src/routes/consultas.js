const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

const nullableNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
};

const makeRevision = (body) => {
  if (body.revision_general && typeof body.revision_general === 'object') return body.revision_general;
  // Compatibilidad temporal con clientes antiguos; la interfaz médica usa revisión general.
  const old = body.examen_fisico || {};
  if (body.examen_fisico) return {
    evaluacion_dermica: old.piel || null,
    evaluacion_respiratoria: old.respiratorio || null,
    evaluacion_cardiovascular: old.cardiovascular || null,
    evaluacion_gastrointestinal: old.otros || null,
    peso: null, altura: null, presion: null, temperatura: null, pulso: null,
  };
  return null;
};

// GET /api/consultas/pendientes
router.get('/pendientes', verifyToken, checkRole(['admin', 'medico']), async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id AS tramite_id, t.tipo_tramite, t.costo_bs, t.fecha_inicio,
             t.numero_carnet_sanitario AS numero_carnet_fisico, t.codigo_carnet,
             p.id AS paciente_id,
             CASE WHEN p.cedula_complemento IS NULL THEN p.cedula_identidad
                  ELSE p.cedula_identidad || '-' || p.cedula_complemento END AS ci,
             p.ci_expedido AS ci_exp, p.nombres, p.apellidos, p.telefono,
             p.ocupacion, p.empresa_trabajo, p.mercado, p.foto_url, p.fecha_nacimiento, p.genero,
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
             COALESCE(oa.otros_analisis, '[]'::jsonb) AS otros_analisis
      FROM tramites t
      JOIN pacientes p ON p.id = t.paciente_id
      JOIN LATERAL (
        SELECT * FROM laboratorios WHERE tramite_id = t.numero_carnet_sanitario
        ORDER BY fecha_registro DESC, id DESC LIMIT 1
      ) l ON true
      LEFT JOIN quimica_sanguinea q ON q.id_sanguinea = l.quimica_sanguinea_id
      LEFT JOIN coproparasitologico cp ON cp.id_coproparasitologico = l.coproparasitologico_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('analisis', analisis, 'resultado', resultado) ORDER BY id) AS otros_analisis
        FROM laboratorio_otros_analisis WHERE laboratorio_id = l.id
      ) oa ON true
      WHERE t.estado = 'Pendiente Medicina'
      ORDER BY t.fecha_inicio ASC, t.id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pendientes de medicina:', error);
    res.status(500).json({ error: 'Error al obtener los trámites pendientes de medicina.' });
  }
});

// POST /api/consultas/:tramiteId
router.post('/:tramiteId', verifyToken, checkRole(['admin', 'medico']), async (req, res) => {
  const { tramiteId } = req.params;
  const { antecedentes_patologicos, diagnostico, aprobado, firma_medico } = req.body;
  const revision = makeRevision(req.body);
  const firmaMedico = String(firma_medico || req.user.nombre_completo || '').trim();

  if (typeof aprobado !== 'boolean') return res.status(400).json({ error: 'Selecciona si el trámite está aprobado o rechazado.' });
  if (!revision || typeof revision !== 'object') return res.status(400).json({ error: 'No se recibió la Revisión General.' });
  if (!firmaMedico) return res.status(400).json({ error: 'No se pudo identificar al médico que registra la consulta.' });
  const numericFields = ['peso', 'altura', 'temperatura', 'pulso'];
  const parsed = Object.fromEntries(numericFields.map((field) => [field, nullableNumber(revision[field])]));
  if (Object.values(parsed).some(Number.isNaN)) {
    return res.status(400).json({ error: 'Peso, altura, temperatura y pulso deben ser valores numéricos válidos.' });
  }
  if ((parsed.peso !== null && (parsed.peso < 0 || parsed.peso > 999.99))
      || (parsed.altura !== null && (parsed.altura < 0 || parsed.altura > 99.99))
      || (parsed.temperatura !== null && (parsed.temperatura < 0 || parsed.temperatura > 999.9))
      || (parsed.pulso !== null && (!Number.isInteger(parsed.pulso) || parsed.pulso < 0))) {
    return res.status(400).json({ error: 'Uno de los valores de revisión general está fuera de rango.' });
  }
  const presion = String(revision.presion || '').trim() || null;
  if (presion && presion.length > 10) {
    return res.status(400).json({ error: 'La presión admite hasta 10 caracteres.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const tramiteRes = await client.query(`
      SELECT id, estado, paciente_id, numero_carnet_sanitario
      FROM tramites WHERE id = $1 FOR UPDATE
    `, [tramiteId]);
    if (tramiteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trámite no encontrado.' });
    }
    const tramite = tramiteRes.rows[0];
    if (tramite.estado !== 'Pendiente Medicina') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este trámite ya no se encuentra en cola médica.' });
    }

    const examenRes = await client.query(`
      INSERT INTO examen_revision_general (
        evaluacion_dermica, evaluacion_respiratoria, evaluacion_cardiovascular,
        evaluacion_gastrointestinal, peso, altura, presion, temperatura, pulso
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id_examen
    `, [
      revision.evaluacion_dermica || null,
      revision.evaluacion_respiratoria || null,
      revision.evaluacion_cardiovascular || null,
      revision.evaluacion_gastrointestinal || null,
      parsed.peso,
      parsed.altura,
      presion,
      parsed.temperatura,
      parsed.pulso,
    ]);

    await client.query(`
      INSERT INTO consultas_medicas (
        tramite_id, medico_id, examen_revision_general_id, antecedentes_patologicos,
        diagnostico, aprobado, firma_medico
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      tramite.numero_carnet_sanitario,
      req.user.id,
      examenRes.rows[0].id_examen,
      antecedentes_patologicos || null,
      diagnostico || null,
      aprobado,
      firmaMedico,
    ]);

    const estadoFinal = aprobado ? 'Aprobado' : 'Rechazado';
    let codigoCarnet = null;
    let fechaEmision = null;
    let fechaVencimiento = null;
    if (aprobado) {
      const datesRes = await client.query("SELECT CURRENT_DATE AS fecha_emision, CURRENT_DATE + INTERVAL '1 year' AS fecha_vencimiento, EXTRACT(YEAR FROM CURRENT_DATE)::int AS anio_emision");
      fechaEmision = datesRes.rows[0].fecha_emision;
      fechaVencimiento = datesRes.rows[0].fecha_vencimiento;
      const year = datesRes.rows[0].anio_emision;
      // Serializa la asignación para que dos aprobaciones simultáneas no generen el mismo código.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`carnet-code:${year}`]);
      const seqRes = await client.query(`
        SELECT COUNT(*)::int AS count FROM tramites
        WHERE estado = 'Aprobado' AND EXTRACT(YEAR FROM fecha_emision) = $1
      `, [year]);
      codigoCarnet = `CS-${year}-${String(seqRes.rows[0].count + 1).padStart(4, '0')}`;
      await client.query(`
        UPDATE tramites SET estado = $1, codigo_carnet = $2, fecha_emision = $3, fecha_vencimiento = $4
        WHERE id = $5
      `, [estadoFinal, codigoCarnet, fechaEmision, fechaVencimiento, tramite.id]);
    } else {
      await client.query('UPDATE tramites SET estado = $1 WHERE id = $2', [estadoFinal, tramite.id]);
    }

    const patientRes = await client.query(`
      SELECT CASE WHEN cedula_complemento IS NULL THEN cedula_identidad
                  ELSE cedula_identidad || '-' || cedula_complemento END AS ci,
             nombres, apellidos FROM pacientes WHERE id = $1
    `, [tramite.paciente_id]);
    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      aprobado ? 'APROBACION_CARNET' : 'RECHAZO_CARNET',
      `${aprobado ? 'Aprobó' : 'Rechazó'} trámite ${tramite.numero_carnet_sanitario} del paciente CI: ${patientRes.rows[0].ci}${aprobado ? `. Carnet generado: ${codigoCarnet}` : ''}`,
      req
    );
    res.json({
      message: aprobado ? `Trámite aprobado con éxito. Carnet emitido: ${codigoCarnet}` : 'Trámite rechazado.',
      estado: estadoFinal,
      codigo_carnet: codigoCarnet,
      numero_carnet_fisico: tramite.numero_carnet_sanitario,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error al guardar consulta médica:', error);
    res.status(500).json({ error: 'Error al registrar la evaluación médica.' });
  } finally {
    client.release();
  }
});

module.exports = router;
