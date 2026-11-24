const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// GET /api/estadisticas/resumen
router.get('/resumen', verifyToken, async (_req, res) => {
  try {
    const [totalPacientes, pendientesLab, pendientesMed, carnetsActivos] = await Promise.all([
      db.query('SELECT COUNT(*) FROM pacientes'),
      db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Pendiente Laboratorio'"),
      db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Pendiente Medicina'"),
      db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Aprobado' AND fecha_vencimiento > CURRENT_DATE"),
    ]);
    res.json({
      total_pacientes: Number(totalPacientes.rows[0].count),
      pendientes_laboratorio: Number(pendientesLab.rows[0].count),
      pendientes_medicina: Number(pendientesMed.rows[0].count),
      carnets_activos: Number(carnetsActivos.rows[0].count),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de resumen:', error);
    res.status(500).json({ error: 'Error al obtener el resumen de estadísticas.' });
  }
});

// GET /api/estadisticas/mensuales
router.get('/mensuales', verifyToken, async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT TO_CHAR(fecha_emision, 'YYYY-MM') AS mes, COUNT(*) AS cantidad
      FROM tramites
      WHERE estado = 'Aprobado' AND fecha_emision >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY mes ORDER BY mes ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener estadísticas mensuales:', error);
    res.status(500).json({ error: 'Error al obtener las estadísticas mensuales.' });
  }
});

// GET /api/estadisticas/laboratorio-resumen
router.get('/laboratorio-resumen', verifyToken, async (_req, res) => {
  try {
    const [coproRes, vihRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE resultado IS NOT NULL AND resultado ~* '(negativo|no se observan)') AS negativos,
          COUNT(*) FILTER (WHERE resultado IS NOT NULL AND resultado !~* '(negativo|no se observan)') AS positivos,
          COUNT(*) FILTER (WHERE resultado IS NOT NULL) AS total
        FROM (
          SELECT COALESCE(l.datos_compatibilidad#>>'{coproparasitologico,parasito}',
                          l.datos_compatibilidad#>>'{coproparasitologico,examen_microscopico}',
                          cp.examen_microscopico_directo) AS resultado
          FROM laboratorios l
          LEFT JOIN coproparasitologico cp ON cp.id_coproparasitologico = l.coproparasitologico_id
        ) resultados
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE resultado = 'No Reactivo') AS no_reactivos,
          COUNT(*) FILTER (WHERE resultado = 'Reactivo') AS reactivos,
          COUNT(*) FILTER (WHERE resultado IN ('No Reactivo', 'Reactivo')) AS total
        FROM (
          SELECT COALESCE(l.vih_resultado, l.datos_compatibilidad#>>'{vih,resultado}') AS resultado
          FROM laboratorios l
        ) resultados
      `),
    ]);
    res.json({
      coproparasitologico: {
        negativos: Number(coproRes.rows[0].negativos || 0),
        positivos: Number(coproRes.rows[0].positivos || 0),
        total: Number(coproRes.rows[0].total || 0),
      },
      vih: {
        negativos: Number(vihRes.rows[0].no_reactivos || 0),
        positivos: Number(vihRes.rows[0].reactivos || 0),
        total: Number(vihRes.rows[0].total || 0),
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de laboratorio:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de laboratorio.' });
  }
});

// GET /api/estadisticas/diagnosticos
router.get('/diagnosticos', verifyToken, checkRole(['admin']), async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT TRIM(diagnostico) AS diagnostico,
             COUNT(*)::int AS cantidad,
             COUNT(*) FILTER (WHERE aprobado = true)::int AS aprobados,
             COUNT(*) FILTER (WHERE aprobado = false)::int AS rechazados
      FROM consultas_medicas
      WHERE diagnostico IS NOT NULL AND TRIM(diagnostico) <> ''
      GROUP BY TRIM(diagnostico)
      ORDER BY cantidad DESC, diagnostico ASC LIMIT 8
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener resumen de diagnósticos:', error);
    res.status(500).json({ error: 'Error al obtener el resumen de diagnósticos.' });
  }
});

// GET /api/estadisticas/rubros-mercados
router.get('/rubros-mercados', verifyToken, async (_req, res) => {
  try {
    const [ocupaciones, mercados] = await Promise.all([
      db.query('SELECT ocupacion, COUNT(*) AS cantidad FROM pacientes GROUP BY ocupacion ORDER BY cantidad DESC LIMIT 10'),
      db.query("SELECT mercado, COUNT(*) AS cantidad FROM pacientes WHERE mercado IS NOT NULL AND mercado <> '' GROUP BY mercado ORDER BY cantidad DESC LIMIT 10"),
    ]);
    res.json({ ocupaciones: ocupaciones.rows, mercados: mercados.rows });
  } catch (error) {
    console.error('Error al obtener rubros y mercados:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de rubros.' });
  }
});

// GET /api/estadisticas/formulario303
router.get('/formulario303', verifyToken, async (req, res) => {
  let targetMonth = req.query.mes;
  if (!targetMonth) {
    const d = new Date();
    targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
    return res.status(400).json({ error: 'El mes debe tener formato YYYY-MM.' });
  }

  try {
    const statsRes = await db.query(`
      SELECT COUNT(t.id) AS total_evaluados,
             COUNT(*) FILTER (WHERE t.estado = 'Aprobado') AS total_aprobados,
             COUNT(*) FILTER (WHERE t.estado = 'Rechazado') AS total_rechazados,
             COUNT(*) FILTER (WHERE l.copro_resultado IS NOT NULL
                              AND l.copro_resultado !~* '(negativo|no se observan)') AS total_copro_positivos,
             COUNT(*) FILTER (WHERE l.vih_resultado = 'Reactivo') AS total_vih_positivos
      FROM tramites t
      LEFT JOIN LATERAL (
        SELECT COALESCE(l.datos_compatibilidad#>>'{coproparasitologico,parasito}',
                        l.datos_compatibilidad#>>'{coproparasitologico,examen_microscopico}',
                        cp.examen_microscopico_directo) AS copro_resultado,
               COALESCE(l.vih_resultado, l.datos_compatibilidad#>>'{vih,resultado}') AS vih_resultado
        FROM laboratorios l
        LEFT JOIN coproparasitologico cp ON cp.id_coproparasitologico = l.coproparasitologico_id
        WHERE l.tramite_id = t.numero_carnet_sanitario
        ORDER BY l.fecha_registro DESC, l.id DESC LIMIT 1
      ) l ON true
      WHERE TO_CHAR(t.fecha_registro, 'YYYY-MM') = $1
    `, [targetMonth]);

    const parasitos = await db.query(`
      SELECT resultado AS parasito, COUNT(*) AS cantidad
      FROM (
        SELECT COALESCE(l.datos_compatibilidad#>>'{coproparasitologico,parasito}',
                        l.datos_compatibilidad#>>'{coproparasitologico,examen_microscopico}',
                        cp.examen_microscopico_directo) AS resultado
        FROM tramites t
        JOIN LATERAL (
          SELECT * FROM laboratorios WHERE tramite_id = t.numero_carnet_sanitario
          ORDER BY fecha_registro DESC, id DESC LIMIT 1
        ) l ON true
        LEFT JOIN coproparasitologico cp ON cp.id_coproparasitologico = l.coproparasitologico_id
        WHERE TO_CHAR(t.fecha_registro, 'YYYY-MM') = $1
      ) detalle
      WHERE resultado IS NOT NULL AND resultado !~* '(negativo|no se observan)'
      GROUP BY resultado ORDER BY cantidad DESC
    `, [targetMonth]);

    const rubros = await db.query(`
      SELECT p.ocupacion, COUNT(t.id) AS total,
             COUNT(*) FILTER (WHERE t.estado = 'Aprobado') AS aprobados,
             COUNT(*) FILTER (WHERE t.estado = 'Rechazado') AS rechazados
      FROM tramites t JOIN pacientes p ON p.id = t.paciente_id
      WHERE TO_CHAR(t.fecha_registro, 'YYYY-MM') = $1
      GROUP BY p.ocupacion ORDER BY total DESC
    `, [targetMonth]);

    res.json({
      mes: targetMonth,
      resumen: {
        total_evaluados: Number(statsRes.rows[0].total_evaluados || 0),
        total_aprobados: Number(statsRes.rows[0].total_aprobados || 0),
        total_rechazados: Number(statsRes.rows[0].total_rechazados || 0),
        total_copro_positivos: Number(statsRes.rows[0].total_copro_positivos || 0),
        total_vih_positivos: Number(statsRes.rows[0].total_vih_positivos || 0),
      },
      parasitos: parasitos.rows,
      rubros: rubros.rows,
    });
  } catch (error) {
    console.error('Error al generar Formulario 303:', error);
    res.status(500).json({ error: 'Error al generar el reporte del Formulario 303.' });
  }
});

// GET /api/estadisticas/auditoria
router.get('/auditoria', verifyToken, checkRole(['admin']), async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT l.id, l.accion, l.detalles, l.ip_address, l.fecha_registro AS fecha,
             u.nombre_usuario AS username, u.nombre_completo, u.rol
      FROM logs_auditoria l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      ORDER BY l.fecha_registro DESC LIMIT 200
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({ error: 'Error al obtener la auditoría del sistema.' });
  }
});

module.exports = router;
