import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
const TAX = Number(process.env.TAX_RATE ?? 0.16);
const round2 = n => Math.round(n * 100) / 100;

// Checkout: todo ocurre en una transacción. Si algo falla (stock, SQL), nada se guarda.
r.post('/', requireAuth, async (req, res) => {
  const { items, envio = {}, notas } = req.body || {};
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Tu carrito está vacío');
  for (const k of ['nombre', 'telefono', 'direccion', 'ciudad', 'cp']) {
    if (!String(envio[k] || '').trim()) throw new HttpError(400, 'Completa todos los datos de envío');
  }
  const merged = new Map();
  for (const it of items) {
    const id = Number(it.variante_id), q = Number(it.cantidad);
    if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1) throw new HttpError(400, 'Hay un artículo inválido en tu carrito');
    merged.set(id, (merged.get(id) || 0) + q);
  }
  const ids = [...merged.keys()].sort((a, b) => a - b); // orden fijo => evita deadlocks

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const lines = [];
    for (const id of ids) {
      const [[v]] = await conn.query(
        `SELECT v.id, v.sku, v.talla, v.precio, v.stock, p.nombre
         FROM variantes v JOIN productos p ON p.id = v.producto_id
         WHERE v.id = ? AND v.activo = 1 AND p.activo = 1 FOR UPDATE`, [id]);
      if (!v) throw new HttpError(409, 'Una de las joyas ya no está disponible');
      const cantidad = merged.get(id);
      if (v.stock < cantidad) {
        const detalle = `${v.nombre}${v.talla ? ' (' + v.talla + ')' : ''}`;
        throw new HttpError(409, v.stock === 0 ? `${detalle} se agotó` : `Solo quedan ${v.stock} pieza(s) de ${detalle}`);
      }
      lines.push({ ...v, cantidad });
    }
    const subtotal = round2(lines.reduce((s, l) => s + l.precio * l.cantidad, 0));
    const impuestos = round2(subtotal * TAX);
    const total = round2(subtotal + impuestos);
    const codigo = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [ins] = await conn.query('INSERT INTO ordenes SET ?', {
      usuario_id: req.user.id, codigo, subtotal, impuestos, total,
      envio_nombre: envio.nombre.trim(), envio_telefono: envio.telefono.trim(), envio_direccion: envio.direccion.trim(),
      envio_ciudad: envio.ciudad.trim(), envio_cp: envio.cp.trim(), notas: notas || null,
    });
    for (const l of lines) {
      await conn.query('INSERT INTO orden_items SET ?', {
        orden_id: ins.insertId, variante_id: l.id, producto_nombre: l.nombre, talla: l.talla, sku: l.sku,
        cantidad: l.cantidad, precio_unitario: l.precio, subtotal: round2(l.precio * l.cantidad),
      });
      await conn.query('UPDATE variantes SET stock = stock - ? WHERE id = ?', [l.cantidad, l.id]);
      await conn.query('INSERT INTO movimientos_stock SET ?', {
        variante_id: l.id, tipo: 'venta', cantidad: -l.cantidad, stock_resultante: l.stock - l.cantidad, orden_id: ins.insertId,
      });
    }
    await conn.commit();
    res.status(201).json({ orden: { id: ins.insertId, codigo, subtotal, impuestos, total } });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

r.get('/', requireAuth, async (req, res) => {
  const [ordenes] = await pool.query('SELECT * FROM ordenes WHERE usuario_id = ? ORDER BY created_at DESC, id DESC', [req.user.id]);
  res.json(await attachItems(ordenes));
});

export async function attachItems(ordenes) {
  if (!ordenes.length) return [];
  const [items] = await pool.query('SELECT * FROM orden_items WHERE orden_id IN (?)', [ordenes.map(o => o.id)]);
  return ordenes.map(o => ({ ...o, items: items.filter(i => i.orden_id === o.id) }));
}

export default r;
