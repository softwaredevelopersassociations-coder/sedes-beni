const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// GET /api/estadisticas/resumen (Contadores rápidos del dashboard)
router.get('/resumen', verifyToken, async (req, res) => {
  try {
    const totalPacientesRes = await db.query('SELECT COUNT(*) FROM pacientes');
    const tramitesPendLabRes = await db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Pendiente Laboratorio'");
    const tramitesPendMedRes = await db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Pendiente Medicina'");
    const carnetsActivosRes = await db.query("SELECT COUNT(*) FROM tramites WHERE estado = 'Aprobado' AND fecha_vencimiento > CURRENT_TIMESTAMP");

    res.json({
      total_pacientes: parseInt(totalPacientesRes.rows[0].count),
      pendientes_laboratorio: parseInt(tramitesPendLabRes.rows[0].count),
      pendientes_medicina: parseInt(tramitesPendMedRes.rows[0].count),
      carnets_activos: parseInt(carnetsActivosRes.rows[0].count),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de resumen:', error);
    res.status(500).json({ error: 'Error al obtener el resumen de estadísticas.' });
  }
});

// GET /api/estadisticas/mensuales (Datos de emisión mensual para gráfico)
router.get('/mensuales', verifyToken, async (req, res) => {
  try {
    // Retorna conteo de emitidos agrupado por mes en el último año
    const result = await db.query(`
      SELECT TO_CHAR(fecha_emision, 'YYYY-MM') as mes, COUNT(*) as cantidad
      FROM tramites
      WHERE estado = 'Aprobado' AND fecha_emision >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY mes
      ORDER BY mes ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener estadísticas mensuales:', error);
    res.status(500).json({ error: 'Error al obtener las estadísticas mensuales.' });
  }
});

// GET /api/estadisticas/laboratorio-resumen (Positivos vs Negativos Copro y VIH)
router.get('/laboratorio-resumen', verifyToken, async (req, res) => {
  try {
    const coproRes = await db.query(`
      SELECT 
        SUM(CASE WHEN coproparasitologico->>'parasito' = 'Negativo' THEN 1 ELSE 0 END) as negativos,
        SUM(CASE WHEN coproparasitologico->>'parasito' != 'Negativo' THEN 1 ELSE 0 END) as positivos,
        COUNT(*) as total
      FROM laboratorios
    `);

    const vihRes = await db.query(`
      SELECT 
        SUM(CASE WHEN vih->>'resultado' = 'No Reactivo' THEN 1 ELSE 0 END) as no_reactivos,
        SUM(CASE WHEN vih->>'resultado' = 'Reactivo' THEN 1 ELSE 0 END) as reactivos,
        COUNT(*) as total
      FROM laboratorios
    `);

    res.json({
      coproparasitologico: {
        negativos: parseInt(coproRes.rows[0].negativos || 0),
        positivos: parseInt(coproRes.rows[0].positivos || 0),
        total: parseInt(coproRes.rows[0].total || 0)
      },
      vih: {
        negativos: parseInt(vihRes.rows[0].no_reactivos || 0),
        positivos: parseInt(vihRes.rows[0].reactivos || 0),
        total: parseInt(vihRes.rows[0].total || 0)
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de laboratorio:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de laboratorio.' });
  }
});

// GET /api/estadisticas/rubros-mercados (Datos de ocupación y mercados)
router.get('/rubros-mercados', verifyToken, async (req, res) => {
  try {
    const ocupacionesRes = await db.query(`
      SELECT ocupacion, COUNT(*) as cantidad
      FROM pacientes
      GROUP BY ocupacion
      ORDER BY cantidad DESC
      LIMIT 10
    `);

    const mercadosRes = await db.query(`
      SELECT mercado, COUNT(*) as cantidad
      FROM pacientes
      WHERE mercado IS NOT NULL AND mercado != ''
      GROUP BY mercado
      ORDER BY cantidad DESC
      LIMIT 10
    `);

    res.json({
      ocupaciones: ocupacionesRes.rows,
      mercados: mercadosRes.rows
    });
  } catch (error) {
    console.error('Error al obtener rubros y mercados:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de rubros.' });
  }
});

// GET /api/estadisticas/formulario303 (Reporte epidemiológico consolidado oficial)
router.get('/formulario303', verifyToken, async (req, res) => {
  const { mes } = req.query; // Formato: YYYY-MM. Si no se provee, usar mes actual.
  let targetMonth = mes;
  if (!targetMonth) {
    const d = new Date();
    targetMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  try {
    // 1. Obtener listado de trámites completados en el mes objetivo
    // Agrupa pacientes con parasitosis positivas detectadas
    const statsRes = await db.query(`
      SELECT 
        COUNT(t.id) as total_evaluados,
        SUM(CASE WHEN t.estado = 'Aprobado' THEN 1 ELSE 0 END) as total_aprobados,
        SUM(CASE WHEN t.estado = 'Rechazado' THEN 1 ELSE 0 END) as total_rechazados,
        SUM(CASE WHEN l.coproparasitologico->>'parasito' != 'Negativo' THEN 1 ELSE 0 END) as total_copro_positivos,
        SUM(CASE WHEN l.vih->>'resultado' = 'Reactivo' THEN 1 ELSE 0 END) as total_vih_positivos
      FROM tramites t
      LEFT JOIN laboratorios l ON l.tramite_id = t.id
      WHERE TO_CHAR(t.created_at, 'YYYY-MM') = $1
    `, [targetMonth]);

    // 2. Detalle de parásitos encontrados
    const parasitosDetalleRes = await db.query(`
      SELECT l.coproparasitologico->>'parasito' as parasito, COUNT(*) as cantidad
      FROM laboratorios l
      JOIN tramites t ON l.tramite_id = t.id
      WHERE TO_CHAR(t.created_at, 'YYYY-MM') = $1 AND l.coproparasitologico->>'parasito' != 'Negativo'
      GROUP BY parasito
      ORDER BY cantidad DESC
    `, [targetMonth]);

    // 3. Detalle por Rubros
    const rubrosRes = await db.query(`
      SELECT p.ocupacion, COUNT(t.id) as total,
             SUM(CASE WHEN t.estado = 'Aprobado' THEN 1 ELSE 0 END) as aprobados,
             SUM(CASE WHEN t.estado = 'Rechazado' THEN 1 ELSE 0 END) as rechazados
      FROM tramites t
      JOIN pacientes p ON t.paciente_id = p.id
      WHERE TO_CHAR(t.created_at, 'YYYY-MM') = $1
      GROUP BY p.ocupacion
      ORDER BY total DESC
    `, [targetMonth]);

    res.json({
      mes: targetMonth,
      resumen: {
        total_evaluados: parseInt(statsRes.rows[0].total_evaluados || 0),
        total_aprobados: parseInt(statsRes.rows[0].total_aprobados || 0),
        total_rechazados: parseInt(statsRes.rows[0].total_rechazados || 0),
        total_copro_positivos: parseInt(statsRes.rows[0].total_copro_positivos || 0),
        total_vih_positivos: parseInt(statsRes.rows[0].total_vih_positivos || 0)
      },
      parasitos: parasitosDetalleRes.rows,
      rubros: rubrosRes.rows
    });

  } catch (error) {
    console.error('Error al generar Formulario 303:', error);
    res.status(500).json({ error: 'Error al generar el reporte del Formulario 303.' });
  }
});

// GET /api/estadisticas/auditoria (Solo admin - Logs de auditoría)
router.get('/auditoria', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.id, l.accion, l.detalles, l.ip_address, l.fecha,
             u.username, u.nombre_completo, u.rol
      FROM logs_auditoria l
      LEFT JOIN usuarios u ON l.usuario_id = u.id
      ORDER BY l.fecha DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener logs de auditoría:', error);
    res.status(500).json({ error: 'Error al obtener la auditoría del sistema.' });
  }
});

module.exports = router;
