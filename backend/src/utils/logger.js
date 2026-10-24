const db = require('../config/db');

/**
 * Registra una acción en la tabla logs_auditoria.
 * @param {number|null} usuarioId ID del usuario que realiza la acción
 * @param {string} accion Nombre o código de la acción realizada
 * @param {string} detalles Descripción detallada de la acción
 * @param {object} req Objeto de petición Express (opcional, para extraer la IP)
 */
async function logAuditoria(usuarioId, accion, detalles, req = null) {
  try {
    let ipAddress = '0.0.0.0';
    if (req) {
      ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    }
    
    await db.query(
      `INSERT INTO logs_auditoria (usuario_id, accion, detalles, ip_address) 
       VALUES ($1, $2, $3, $4)`,
      [usuarioId, accion, detalles, ipAddress]
    );
  } catch (error) {
    console.error('Error al guardar log de auditoría:', error.message);
  }
}

module.exports = {
  logAuditoria
};
