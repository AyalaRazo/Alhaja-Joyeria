import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos.' } }));

const sign = u => jwt.sign({ id: u.id, rol: u.rol, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol });

r.post('/register', async (req, res) => {
  const { nombre, apellido, email, password, telefono } = req.body || {};
  if (!nombre?.trim() || !apellido?.trim()) throw new HttpError(400, 'Escribe tu nombre y apellido');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) throw new HttpError(400, 'Correo electrónico inválido');
  if ((password || '').length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const [ins] = await pool.query('INSERT INTO usuarios SET ?', { nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim().toLowerCase(), password_hash, telefono: telefono || null });
    const user = { id: ins.insertId, nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim().toLowerCase(), rol: 'cliente' };
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw e;
  }
});

r.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const [[u]] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND activo = 1', [String(email || '').trim().toLowerCase()]);
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) throw new HttpError(401, 'Correo o contraseña incorrectos');
  res.json({ token: sign(u), user: publicUser(u) });
});

r.get('/me', requireAuth, async (req, res) => {
  const [[u]] = await pool.query('SELECT id,nombre,apellido,email,rol FROM usuarios WHERE id = ?', [req.user.id]);
  if (!u) throw new HttpError(401, 'Usuario no encontrado');
  res.json({ user: u });
});

export default r;
