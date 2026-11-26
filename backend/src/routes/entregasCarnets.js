const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');

const ciCompletoSql = (alias = 'p') => `CASE WHEN ${alias}.cedula_complemento IS NULL
  THEN ${alias}.cedula_identidad
  ELSE ${alias}.cedula_identidad || '-' || ${alias}.cedula_complemento END`;

// GET /api/entregas-carnets?estado=pendiente|entregado|todos&query=...
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  const estado = String(req.query.estado || 'pendiente').trim().toLowerCase();
  const query = String(req.query.query || '').trim().slice(0, 100);
  if (!['pendiente', 'entregado', 'todos'].includes(estado)) {
    return res.status(400).json({ error: 'El filtro de entrega debe ser pendiente, entregado o todos.' });
  }

  const params = [];
  let where = "WHERE t.estado = 'Aprobado'";
  if (estado === 'pendiente') {
    where += " AND COALESCE(t.estado_entrega, 'Pendiente de entrega') = 'Pendiente de entrega'";
  } else if (estado === 'entregado') {
    where += " AND t.estado_entrega = 'Entregado'";
  }
  if (query) {
    params.push(`%${query}%`);
    const searchParam = `$${params.length}`;
    where += ` AND (
      CONCAT_WS(' ', p.nombres, p.apellidos) ILIKE ${searchParam}
      OR
      p.nombres ILIKE ${searchParam}
      OR p.apellidos ILIKE ${searchParam}
      OR ${ciCompletoSql('p')} ILIKE ${searchParam}
      OR t.numero_carnet_sanitario ILIKE ${searchParam}
      OR COALESCE(t.codigo_carnet, '') ILIKE ${searchParam}
    )`;
  }

  try {
    const [rows, totals] = await Promise.all([
      db.query(`
        SELECT t.id AS tramite_id, t.numero_carnet_sanitario AS numero_carnet_fisico,
               t.codigo_carnet, t.tipo_tramite, t.fecha_emision, t.fecha_vencimiento,
               COALESCE(t.estado_entrega, 'Pendiente de entrega') AS estado_entrega,
               t.fecha_entrega,
               ${ciCompletoSql('p')} AS ci, p.ci_expedido AS ci_exp,
               p.nombres, p.apellidos, p.telefono,
               u.nombre_completo AS entregado_por_nombre
        FROM tramites t
        JOIN pacientes p ON p.id = t.paciente_id
        LEFT JOIN usuarios u ON u.id = t.entregado_por
        ${where}
        ORDER BY CASE WHEN COALESCE(t.estado_entrega, 'Pendiente de entrega') = 'Pendiente de entrega'
                      THEN 0 ELSE 1 END,
                 CASE WHEN COALESCE(t.estado_entrega, 'Pendiente de entrega') = 'Pendiente de entrega'
                      THEN t.fecha_emision END ASC NULLS LAST,
                 t.fecha_entrega DESC NULLS LAST,
                 t.id DESC
      `, params),
      db.query(`
        SELECT COUNT(*) FILTER (
                 WHERE COALESCE(estado_entrega, 'Pendiente de entrega') = 'Pendiente de entrega'
               )::int AS pendientes,
               COUNT(*) FILTER (WHERE estado_entrega = 'Entregado')::int AS entregados
        FROM tramites
        WHERE estado = 'Aprobado'
      `),
    ]);

    res.json({
      items: rows.rows,
      resumen: {
        pendientes: totals.rows[0].pendientes,
        entregados: totals.rows[0].entregados,
      },
    });
  } catch (error) {
    console.error('Error al consultar entregas de carnets:', error);
    res.status(500).json({ error: 'Error al cargar la bandeja de entrega de carnets.' });
  }
});

// PATCH /api/entregas-carnets/:tramiteId/entregar
router.patch('/:tramiteId/entregar', verifyToken, checkRole(['admin']), async (req, res) => {
  const tramiteId = Number.parseInt(req.params.tramiteId, 10);

  if (!Number.isInteger(tramiteId) || tramiteId < 1) {
    return res.status(400).json({ error: 'El identificador del trámite no es válido.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`
      SELECT t.id, t.estado, t.estado_entrega, t.numero_carnet_sanitario,
             t.codigo_carnet, p.nombres, p.apellidos,
             ${ciCompletoSql('p')} AS ci
      FROM tramites t
      JOIN pacientes p ON p.id = t.paciente_id
      WHERE t.id = $1
      FOR UPDATE OF t
    `, [tramiteId]);

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró el trámite indicado.' });
    }

    const tramite = current.rows[0];
    if (tramite.estado !== 'Aprobado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Solo se puede entregar un carnet aprobado por el área médica.' });
    }
    if (tramite.estado_entrega === 'Entregado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este carnet ya figura como entregado.' });
    }

    await client.query(`
      UPDATE tramites
      SET estado_entrega = 'Entregado', fecha_entrega = CURRENT_TIMESTAMP,
          entregado_por = $1
      WHERE id = $2 AND estado = 'Aprobado'
    `, [req.user.id, tramiteId]);

    const updated = await client.query(`
      SELECT t.id AS tramite_id, t.numero_carnet_sanitario AS numero_carnet_fisico,
             t.codigo_carnet, t.estado_entrega, t.fecha_entrega,
             p.nombres, p.apellidos,
             ${ciCompletoSql('p')} AS ci,
             u.nombre_completo AS entregado_por_nombre
      FROM tramites t
      JOIN pacientes p ON p.id = t.paciente_id
      LEFT JOIN usuarios u ON u.id = t.entregado_por
      WHERE t.id = $1
    `, [tramiteId]);
    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      'ENTREGA_CARNET',
      `Operador: ${req.user.nombre_completo}. Registró entrega personal del carnet físico N° ${tramite.numero_carnet_sanitario} (código ${tramite.codigo_carnet || 'sin código'}) a ${tramite.nombres} ${tramite.apellidos}, CI: ${tramite.ci}`,
      req
    );

    res.json({ message: 'Entrega del carnet registrada.', entrega: updated.rows[0] });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error al registrar la entrega del carnet:', error);
    res.status(500).json({ error: 'Error al registrar la entrega del carnet.' });
  } finally {
    client.release();
  }
});

// PATCH /api/entregas-carnets/:tramiteId/deshacer-entrega
router.patch('/:tramiteId/deshacer-entrega', verifyToken, checkRole(['admin']), async (req, res) => {
  const tramiteId = Number.parseInt(req.params.tramiteId, 10);
  if (!Number.isInteger(tramiteId) || tramiteId < 1) {
    return res.status(400).json({ error: 'El identificador del trámite no es válido.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`
      SELECT t.id, t.estado, t.estado_entrega, t.fecha_entrega,
             t.numero_carnet_sanitario, t.codigo_carnet,
             p.nombres, p.apellidos, ${ciCompletoSql('p')} AS ci,
             u.nombre_completo AS operador_anterior
      FROM tramites t
      JOIN pacientes p ON p.id = t.paciente_id
      LEFT JOIN usuarios u ON u.id = t.entregado_por
      WHERE t.id = $1
      FOR UPDATE OF t
    `, [tramiteId]);

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró el trámite indicado.' });
    }

    const tramite = current.rows[0];
    if (tramite.estado !== 'Aprobado' || tramite.estado_entrega !== 'Entregado') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Solo se puede deshacer una entrega que figure como entregada.' });
    }

    await client.query(`
      UPDATE tramites
      SET estado_entrega = 'Pendiente de entrega', fecha_entrega = NULL, entregado_por = NULL
      WHERE id = $1 AND estado = 'Aprobado' AND estado_entrega = 'Entregado'
    `, [tramiteId]);
    await client.query('COMMIT');

    await logAuditoria(
      req.user.id,
      'ANULAR_ENTREGA_CARNET',
      `Operador: ${req.user.nombre_completo}. Revirtió por corrección la entrega del carnet físico N° ${tramite.numero_carnet_sanitario} (código ${tramite.codigo_carnet || 'sin código'}) de ${tramite.nombres} ${tramite.apellidos}, CI: ${tramite.ci}. Registro anterior: ${tramite.fecha_entrega ? new Date(tramite.fecha_entrega).toISOString() : 'sin fecha'}; operador anterior: ${tramite.operador_anterior || 'no disponible'}`,
      req
    );

    res.json({ message: 'La entrega se revirtió y el carnet volvió a pendientes.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Error al revertir la entrega del carnet:', error);
    res.status(500).json({ error: 'Error al revertir la entrega del carnet.' });
  } finally {
    client.release();
  }
});

module.exports = router;
