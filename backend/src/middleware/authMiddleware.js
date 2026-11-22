const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// Middleware para verificar el token JWT
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token.' });
  }

  let verified;
  try {
    verified = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_para_jwt_sedes_beni');
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, nombre_completo, rol, activo FROM usuarios WHERE id = $1',
      [verified.id]
    );
    const account = result.rows[0];
    if (!account || !account.activo) {
      return res.status(401).json({ error: 'La cuenta ya no está activa. Inicia sesión con una cuenta vigente.' });
    }

    req.user = {
      ...verified,
      username: account.username,
      nombre_completo: account.nombre_completo,
      rol: account.rol,
    };
    return next();
  } catch (error) {
    console.error('Error al verificar la cuenta autenticada:', error.message);
    return res.status(500).json({ error: 'No se pudo verificar la cuenta.' });
  }
};

// Middleware para validar roles
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  checkRole
};
