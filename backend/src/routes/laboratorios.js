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

const nullableBoolean = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLocaleLowerCase('es');
  if (['true', '1', 'si', 'sí', 'positivo', 'presente'].includes(normalized)) return true;
  if (['false', '0', 'no', 'negativo', 'ausente'].includes(normalized)) return false;
  return null;
};

// GET /api/laboratorios/pendientes
router.get('/pendientes', verifyToken, checkRole(['admin', 'laboratorio']), async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id AS tramite_id, t.tipo_tramite, t.costo_bs, t.fecha_inicio,
             t.numero_carnet_sanitario AS numero_carnet_fisico,
             p.id AS paciente_id,
             CASE WHEN p.cedula_complemento IS NULL THEN p.cedula_identidad
                  ELSE p.cedula_identidad || '-' || p.cedula_complemento END AS ci,
             p.ci_expedido AS ci_exp, p.nombres, p.apellidos, p.telefono,
             p.ocupacion, p.empresa_trabajo, p.mercado, p.foto_url
      FROM tramites t JOIN pacientes p ON p.id = t.paciente_id
      WHERE t.estado = 'Pendiente Laboratorio'
      ORDER BY t.fecha_inicio ASC, t.id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener pendientes de laboratorio:', error);
    res.status(500).json({ error: 'Error al obtener los trámites pendientes.' });
  }
});

// POST /api/laboratorios/:tramiteId
router.post('/:tramiteId', verifyToken, checkRole(['admin', 'laboratorio']), async (req, res) => {
  const { tramiteId } = req.params;
  const { quimica_sanguinea, coproparasitologico, vih, observaciones, otros_analisis = [] } = req.body;
  if (!quimica_sanguinea || typeof quimica_sanguinea !== 'object'
      || !coproparasitologico || typeof coproparasitologico !== 'object') {
    return res.status(400).json({ error: 'Se deben proporcionar los resultados de química sanguínea y coproparasitológico.' });
  }
  if (!Array.isArray(otros_analisis)) return res.status(400).json({ error: 'otros_analisis debe ser un array.' });
  if (otros_analisis.some((item) => !item?.analisis || !item?.resultado)) {
    return res.status(400).json({ error: 'Cada análisis debe tener "analisis" y "resultado".' });
  }

  const vihRealizado = Boolean(vih && vih.realizado !== false && vih.resultado !== 'No Realizado');
  if (vihRealizado && vih?.consentimiento !== true) {
    return res.status(400).json({ error: 'Es obligatorio el consentimiento informado firmado para la prueba de VIH.' });
  }
  const vihData = {
    realizado: vihRealizado,
    resultado: vihRealizado ? (vih?.resultado || 'No Reactivo') : 'No Realizado',
    consentimiento: vihRealizado && Boolean(vih?.consentimiento),
    mostrar_en_registro_medico: vih?.mostrar_en_registro_medico !== undefined
      ? Boolean(vih.mostrar_en_registro_medico) : vihRealizado,
  };

  const glucosa = nullableNumber(quimica_sanguinea.glucosa);
  const urea = nullableNumber(quimica_sanguinea.urea);
  const creatinina = nullableNumber(quimica_sanguinea.creatinina);
  if ([glucosa, urea, creatinina].some(Number.isNaN)) {
    return res.status(400).json({ error: 'Los resultados numéricos de química sanguínea deben ser válidos.' });
  }
  const grupoSanguineo = String(quimica_sanguinea.grupo_sanguineo || '').toUpperCase() || null;
  const factorRh = String(quimica_sanguinea.factor_rh || '').trim() || null;
  if (grupoSanguineo && !['A', 'B', 'AB', 'O'].includes(grupoSanguineo)) {
    return res.status(400).json({ error: 'Grupo sanguíneo no válido.' });
  }
  if (factorRh && !['+', '-'].includes(factorRh)) return res.status(400).json({ error: 'Factor Rh no válido.' });

  const aspecto = String(coproparasitologico.aspecto || '').trim() || null;
  const microscopico = String(coproparasitologico.examen_microscopico_directo
    || coproparasitologico.examen_microscopico || coproparasitologico.parasito || '').trim() || null;
  if (aspecto && aspecto.length > 50) return res.status(400).json({ error: 'El aspecto coproparasitológico admite hasta 50 caracteres.' });
  const moco = nullableBoolean(coproparasitologico.moco);
  const sangre = nullableBoolean(coproparasitologico.sangre_macroscopica ?? coproparasitologico.sangre);

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
    if (tramite.estado !== 'Pendiente Laboratorio') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este trámite ya no se encuentra en cola de laboratorio.' });
    }

    const qResult = await client.query(`
      INSERT INTO quimica_sanguinea (glucosa, urea, creatinina, grupo_sanguineo, factor_rh)
      VALUES ($1, $2, $3, $4, $5) RETURNING id_sanguinea
    `, [glucosa, urea, creatinina, grupoSanguineo, factorRh]);
    const coproResult = await client.query(`
      INSERT INTO coproparasitologico (aspecto, moco, sangre_macroscopica, examen_microscopico_directo)
      VALUES ($1, $2, $3, $4) RETURNING id_coproparasitologico
    `, [aspecto, moco, sangre, microscopico]);

    const labResult = await client.query(`
      INSERT INTO laboratorios (
        tramite_id, quimica_sanguinea_id, coproparasitologico_id, vih_resultado,
        operador_id, observaciones, vih_realizado, vih_consentimiento,
        vih_mostrar_en_registro_medico, datos_compatibilidad
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id
    `, [
      tramite.numero_carnet_sanitario, qResult.rows[0].id_sanguinea,
      coproResult.rows[0].id_coproparasitologico, vihData.resultado, req.user.id,
      observaciones || null, vihData.realizado, vihData.consentimiento,
      vihData.mostrar_en_registro_medico,
      JSON.stringify({ quimica_sanguinea, coproparasitologico, vih: vihData }),
    ]);

    for (const item of otros_analisis) {
      await client.query(
        'INSERT INTO laboratorio_otros_analisis (laboratorio_id, analisis, resultado) VALUES ($1, $2, $3)',
        [labResult.rows[0].id, String(item.analisis).trim(), String(item.resultado).trim()]
      );
    }
    await client.query("UPDATE tramites SET estado = 'Pendiente Medicina' WHERE id = $1", [tramite.id]);
    const patientRes = await client.query(`
      SELECT CASE WHEN cedula_complemento IS NULL THEN cedula_identidad
                  ELSE cedula_identidad || '-' || cedula_complemento END AS ci
      FROM pacientes WHERE id = $1
    `, [tramite.paciente_id]);
    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      'REGISTRO_LABORATORIO',
      `Registró exámenes de laboratorio para trámite ${tramite.numero_carnet_sanitario} del paciente CI: ${patientRes.rows[0].ci}`,
      req
    );
    res.json({ message: 'Resultados de laboratorio registrados. Trámite derivado al área médica.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error al guardar laboratorio:', error);
    res.status(500).json({ error: 'Error al registrar resultados de laboratorio.' });
  } finally {
    client.release();
  }
});

module.exports = router;
