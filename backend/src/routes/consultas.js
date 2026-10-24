const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

// GET /api/consultas/pendientes (Listar trámites pendientes de evaluación médica con sus datos de laboratorio)
router.get('/pendientes', verifyToken, checkRole(['admin', 'medico']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id as tramite_id, t.tipo_tramite, t.costo_bs, t.fecha_inicio,
             p.id as paciente_id, p.ci, p.ci_exp, p.nombres, p.apellidos, p.ocupacion, p.empresa_trabajo, p.mercado, p.foto_url,
             p.fecha_nacimiento, p.genero,
             l.id as lab_id, l.quimica_sanguinea, l.coproparasitologico, l.vih, l.observaciones as lab_observaciones, l.fecha_registro as lab_fecha,
             COALESCE(
               json_agg(
                 json_build_object(
                   'analisis', loa.analisis,
                   'resultado', loa.resultado
                 )
               ) FILTER (WHERE loa.analisis IS NOT NULL),
               '[]'::json
             ) as otros_analisis
      FROM tramites t
      JOIN pacientes p ON t.paciente_id = p.id
      JOIN laboratorios l ON l.tramite_id = t.id
      LEFT JOIN laboratorio_otros_analisis loa ON loa.laboratorio_id = l.id
      WHERE t.estado = 'Pendiente Medicina'
      GROUP BY t.id, p.id, l.id
      ORDER BY t.fecha_inicio ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pendientes de medicina:', error);
    res.status(500).json({ error: 'Error al obtener los trámites pendientes de medicina.' });
  }
});

// POST /api/consultas/:tramiteId (Registrar consulta, firma, y aprobar/rechazar trámite)
router.post('/:tramiteId', verifyToken, checkRole(['admin', 'medico']), async (req, res) => {
  const { tramiteId } = req.params;
  const { examen_fisico, antecedentes_patologicos, diagnostico, aprobado, firma_medico } = req.body;

  if (aprobado === undefined || !examen_fisico || !firma_medico) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la consulta médica.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar trámite en estado 'Pendiente Medicina'
    const tramiteRes = await client.query('SELECT estado, paciente_id FROM tramites WHERE id = $1', [tramiteId]);
    if (tramiteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trámite no encontrado.' });
    }

    const tramite = tramiteRes.rows[0];
    if (tramite.estado !== 'Pendiente Medicina') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este trámite ya no se encuentra en cola médica.' });
    }

    // 2. Guardar en la tabla consultas_medicas
    await client.query(`
      INSERT INTO consultas_medicas (tramite_id, medico_id, examen_fisico, antecedentes_patologicos, diagnostico, aprobado, firma_medico)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tramite_id)
      DO UPDATE SET
        medico_id = EXCLUDED.medico_id,
        examen_fisico = EXCLUDED.examen_fisico,
        antecedentes_patologicos = EXCLUDED.antecedentes_patologicos,
        diagnostico = EXCLUDED.diagnostico,
        aprobado = EXCLUDED.aprobado,
        firma_medico = EXCLUDED.firma_medico
    `, [
      tramiteId,
      req.user.id,
      JSON.stringify(examen_fisico),
      antecedentes_patologicos,
      diagnostico,
      aprobado,
      firma_medico
    ]);

    // 3. Modificar estado de trámite y generar carnet si es aprobado
    let estadoFinal = aprobado ? 'Aprobado' : 'Rechazado';
    let codigoCarnet = null;
    let fechaEmision = null;
    let fechaVencimiento = null;

    if (aprobado) {
      fechaEmision = new Date();
      fechaVencimiento = new Date();
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1); // 1 año de vigencia

      // Generar código de carnet secuencial para el año actual
      const anioActual = fechaEmision.getFullYear();
      
      const seqRes = await client.query(`
        SELECT COUNT(*) FROM tramites 
        WHERE estado = 'Aprobado' AND EXTRACT(YEAR FROM fecha_emision) = $1
      `, [anioActual]);
      
      const count = parseInt(seqRes.rows[0].count) + 1;
      const numSecuencial = String(count).padStart(4, '0');
      codigoCarnet = `CS-${anioActual}-${numSecuencial}`;

      await client.query(`
        UPDATE tramites 
        SET estado = $1, codigo_carnet = $2, fecha_emision = $3, fecha_vencimiento = $4
        WHERE id = $5
      `, [estadoFinal, codigoCarnet, fechaEmision, fechaVencimiento, tramiteId]);
    } else {
      await client.query(`
        UPDATE tramites 
        SET estado = $1
        WHERE id = $2
      `, [estadoFinal, tramiteId]);
    }

    // Obtener detalles del paciente para el log
    const patientRes = await client.query('SELECT ci, nombres, apellidos FROM pacientes WHERE id = $1', [tramite.paciente_id]);
    const paciente = patientRes.rows[0];

    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      aprobado ? 'APROBACION_CARNET' : 'RECHAZO_CARNET',
      `${aprobado ? 'Aprobó' : 'Rechazó'} trámite ID: ${tramiteId} del paciente CI: ${paciente.ci}.${aprobado ? ' Carnet generado: ' + codigoCarnet : ''}`,
      req
    );

    res.json({
      message: aprobado 
        ? `Trámite aprobado con éxito. Carnet emitido: ${codigoCarnet}` 
        : 'Trámite rechazado.',
      estado: estadoFinal,
      codigo_carnet: codigoCarnet,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar consulta médica:', error);
    res.status(500).json({ error: 'Error al registrar la evaluación médica.' });
  } finally {
    client.release();
  }
});

module.exports = router;
