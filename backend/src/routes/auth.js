const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const { logAuditoria } = require('../utils/logger');
require('dotenv').config();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await db.query('SELECT * FROM usuarios WHERE username = $1', [username.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({ error: 'El usuario se encuentra inactivo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar Token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET || 'clave_secreta_para_jwt_sedes_beni',
      { expiresIn: '8h' }
    );

    await logAuditoria(user.id, 'LOGIN', `Usuario ${user.username} inició sesión exitosamente`, req);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre_completo: user.nombre_completo,
        rol: user.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, nombre_completo, rol, activo FROM usuarios WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en me:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/users (Solo admin)
router.get('/users', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, nombre_completo, rol, activo, created_at FROM usuarios ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/auth/users (Solo admin)
router.post('/users', verifyToken, checkRole(['admin']), async (req, res) => {
  const { username, password, nombre_completo, rol } = req.body;

  if (!username || !password || !nombre_completo || !rol) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    // Validar si ya existe
    const exists = await db.query('SELECT id FROM usuarios WHERE username = $1', [username.toLowerCase().trim()]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO usuarios (username, password, nombre_completo, rol, activo)
       VALUES ($1, $2, $3, $4, true) RETURNING id, username, nombre_completo, rol, activo`,
      [username.toLowerCase().trim(), hashedPassword, nombre_completo, rol]
    );

    await logAuditoria(req.user.id, 'CREAR_USUARIO', `Creó al usuario ${username} con rol ${rol}`, req);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/auth/users/:id (Solo admin)
router.put('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, rol, password } = req.body;

  try {
    const userRes = await db.query('SELECT id, username FROM usuarios WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    const user = userRes.rows[0];

    let queryText = 'UPDATE usuarios SET nombre_completo = $1, rol = $2';
    let queryParams = [nombre_completo, rol, id];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      queryText += ', password = $3 WHERE id = $4';
      queryParams = [nombre_completo, rol, hashedPassword, id];
    } else {
      queryText += ' WHERE id = $3';
    }

    await db.query(queryText, queryParams);
    await logAuditoria(req.user.id, 'MODIFICAR_USUARIO', `Modificó al usuario ${user.username} (ID: ${id})`, req);

    res.json({ message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/auth/users/:id/toggle (Solo admin)
router.put('/users/:id/toggle', verifyToken, checkRole(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const userRes = await db.query('SELECT id, username, activo FROM usuarios WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    }

    const user = userRes.rows[0];
    const nuevoEstado = !user.activo;

    await db.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [nuevoEstado, id]);
    await logAuditoria(req.user.id, 'TOGGLE_USUARIO', `Cambió estado de usuario ${user.username} a ${nuevoEstado ? 'Activo' : 'Inactivo'}`, req);

    res.json({ message: `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.` });
  } catch (error) {
    console.error('Error al alternar estado de usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
