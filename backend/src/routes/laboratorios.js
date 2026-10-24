const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

// GET /api/laboratorios/pendientes (Listar trámites pendientes de laboratorio)
router.get('/pendientes', verifyToken, checkRole(['admin', 'laboratorio']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id as tramite_id, t.tipo_tramite, t.costo_bs, t.fecha_inicio, t.numero_carnet_fisico,
             p.id as paciente_id, p.ci, p.ci_exp, p.nombres, p.apellidos, p.ocupacion, p.empresa_trabajo, p.mercado, p.foto_url
      FROM tramites t
      JOIN pacientes p ON t.paciente_id = p.id
      WHERE t.estado = 'Pendiente Laboratorio'
      ORDER BY t.fecha_inicio ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pendientes de laboratorio:', error);
    res.status(500).json({ error: 'Error al obtener los trámites pendientes.' });
  }
});

// POST /api/laboratorios/:tramiteId (Guardar resultados de laboratorio y avanzar trámite)
router.post('/:tramiteId', verifyToken, checkRole(['admin', 'laboratorio']), async (req, res) => {
  const { tramiteId } = req.params;
  const { quimica_sanguinea, coproparasitologico, vih, observaciones, otros_analisis } = req.body;

  if (!quimica_sanguinea || !coproparasitologico || !vih) {
    return res.status(400).json({ error: 'Se deben proporcionar todos los resultados obligatorios.' });
  }

  // Validar consentimiento de VIH
  if (vih.consentimiento !== true) {
    return res.status(400).json({ error: 'Es obligatorio el consentimiento informado firmado para la prueba de VIH.' });
  }

  // Validar otros_analisis si se proporciona
  if (otros_analisis !== undefined) {
    if (!Array.isArray(otros_analisis)) {
      return res.status(400).json({ error: 'otros_analisis debe ser un array.' });
    }
    for (const analisis of otros_analisis) {
      if (!analisis.analisis || !analisis.resultado) {
        return res.status(400).json({ error: 'Cada análisis debe tener "analisis" y "resultado".' });
      }
    }
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar que el trámite existe y esté en el estado correcto
    const tramiteRes = await client.query('SELECT estado, paciente_id FROM tramites WHERE id = $1', [tramiteId]);
    if (tramiteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trámite no encontrado.' });
    }

    const tramite = tramiteRes.rows[0];
    if (tramite.estado !== 'Pendiente Laboratorio') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este trámite ya no se encuentra en cola de laboratorio.' });
    }

    // 2. Guardar o actualizar en la tabla laboratorios
    // Dado que es un trámite nuevo, usaremos un INSERT directo, o UPSERT
    const labResult = await client.query(`
      INSERT INTO laboratorios (tramite_id, quimica_sanguinea, coproparasitologico, vih, operador_id, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tramite_id) 
      DO UPDATE SET 
        quimica_sanguinea = EXCLUDED.quimica_sanguinea,
        coproparasitologico = EXCLUDED.coproparasitologico,
        vih = EXCLUDED.vih,
        operador_id = EXCLUDED.operador_id,
        observaciones = EXCLUDED.observaciones
      RETURNING id
    `, [
      tramiteId,
      JSON.stringify(quimica_sanguinea),
      JSON.stringify(coproparasitologico),
      JSON.stringify(vih),
      req.user.id,
      observaciones
    ]);

    const laboratorioId = labResult.rows[0].id;

    // 3. Guardar otros análisis si se proporcionaron
    if (otros_analisis && otros_analisis.length > 0) {
      // Eliminar análisis previos para este laboratorio
      await client.query('DELETE FROM laboratorio_otros_analisis WHERE laboratorio_id = $1', [laboratorioId]);

      // Insertar nuevos análisis
      for (const analisis of otros_analisis) {
        await client.query(`
          INSERT INTO laboratorio_otros_analisis (laboratorio_id, analisis, resultado)
          VALUES ($1, $2, $3)
        `, [laboratorioId, analisis.analisis, analisis.resultado]);
      }
    }

    // 4. Actualizar estado del trámite a 'Pendiente Medicina'
    await client.query(
      `UPDATE tramites SET estado = 'Pendiente Medicina' WHERE id = $1`,
      [tramiteId]
    );

    // Obtener detalles del paciente para el log
    const patientRes = await client.query('SELECT ci, nombres, apellidos FROM pacientes WHERE id = $1', [tramite.paciente_id]);
    const paciente = patientRes.rows[0];

    await client.query('COMMIT');

    await logAuditoria(
      req.user.id, 
      'REGISTRO_LABORATORIO', 
      `Registró exámenes de laboratorio para trámite ID: ${tramiteId} del paciente CI: ${paciente.ci}`, 
      req
    );

    res.json({ message: 'Resultados de laboratorio registrados. Trámite derivado al área médica.' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar laboratorio:', error);
    res.status(500).json({ error: 'Error al registrar resultados de laboratorio.' });
  } finally {
    client.release();
  }
});

module.exports = router;
