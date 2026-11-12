import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { saveImage, deleteImage } from '../storage.js';
import { attachItems } from './orders.js';

const r = Router();
r.use(requireAuth, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Solo se permiten imágenes JPG, PNG o WebP')),
});

const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function cleanProduct(b = {}) {
  const nombre = String(b.nombre || '').trim();
  const categoria_id = Number(b.categoria_id);
  const material = String(b.material || '').trim();
  if (!nombre) throw new HttpError(400, 'El nombre es obligatorio');
  if (!Number.isInteger(categoria_id) || categoria_id < 1) throw new HttpError(400, 'Elige una categoría');
  if (!material) throw new HttpError(400, 'Indica el material (ej. Oro 14k)');
  return {
    nombre, categoria_id, material,
    descripcion: String(b.descripcion || '').trim() || null,
    piedra: String(b.piedra || '').trim() || null,
    destacado: b.destacado ? 1 : 0,
    activo: b.activo === false ? 0 : 1,
  };
}

function cleanVariantes(list) {
  if (!Array.isArray(list)) return [];
  return list.map(v => {
    const sku = String(v.sku || '').trim();
    const precio = Number(v.precio), stock = Number(v.stock);
    if (!sku) throw new HttpError(400, 'Cada variante necesita un SKU');
    if (!(precio >= 0) || !Number.isInteger(stock) || stock < 0) throw new HttpError(400, `Precio o stock inválido en ${sku}`);
    return { id: v.id ? Number(v.id) : null, sku, talla: String(v.talla || '').trim() || null, precio, stock, eliminar: !!v.eliminar };
  });
}

async function syncVariantes(conn, productoId, variantes) {
  for (const v of variantes) {
    if (v.id) {
      if (v.eliminar) { await conn.query('UPDATE variantes SET activo = 0 WHERE id = ? AND producto_id = ?', [v.id, productoId]); continue; }
      const [[prev]] = await conn.query('SELECT stock FROM variantes WHERE id = ? AND producto_id = ? FOR UPDATE', [v.id, productoId]);
      if (!prev) continue;
      await conn.query('UPDATE variantes SET sku=?, talla=?, precio=?, stock=? WHERE id=?', [v.sku, v.talla, v.precio, v.stock, v.id]);
      if (prev.stock !== v.stock) await conn.query('INSERT INTO movimientos_stock SET ?', { variante_id: v.id, tipo: 'ajuste', cantidad: v.stock - prev.stock, stock_resultante: v.stock });
    } else if (!v.eliminar) {
      const [ins] = await conn.query('INSERT INTO variantes SET ?', { producto_id: productoId, sku: v.sku, talla: v.talla, precio: v.precio, stock: v.stock });
      if (v.stock > 0) await conn.query('INSERT INTO movimientos_stock SET ?', { variante_id: ins.insertId, tipo: 'entrada', cantidad: v.stock, stock_resultante: v.stock });
    }
  }
}

r.get('/resumen', async (_req, res) => {
  const [[row]] = await pool.query(`SELECT
    (SELECT COALESCE(SUM(total),0) FROM ordenes WHERE estado <> 'cancelada') AS ventas,
    (SELECT COUNT(*) FROM ordenes WHERE estado = 'pendiente') AS pendientes,
    (SELECT COUNT(*) FROM productos WHERE activo = 1) AS productos,
    (SELECT COUNT(*) FROM variantes v JOIN productos p ON p.id = v.producto_id WHERE v.activo = 1 AND p.activo = 1 AND v.stock <= 2) AS stock_bajo`);
  res.json(row);
});

r.get('/productos', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id, p.nombre, p.material, p.piedra, p.activo, p.destacado, c.nombre AS categoria,
      (SELECT url FROM producto_imagenes WHERE producto_id = p.id ORDER BY orden, id LIMIT 1) AS imagen,
      (SELECT MIN(precio) FROM variantes WHERE producto_id = p.id AND activo = 1) AS precio_desde,
      (SELECT COALESCE(SUM(stock),0) FROM variantes WHERE producto_id = p.id AND activo = 1) AS stock_total
    FROM productos p JOIN categorias c ON c.id = p.categoria_id ORDER BY p.id DESC`);
  res.json(rows);
});

r.get('/productos/:id', async (req, res) => {
  const [[p]] = await pool.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
  if (!p) throw new HttpError(404, 'Producto no encontrado');
  const [imagenes] = await pool.query('SELECT id, url FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id', [p.id]);
  const [variantes] = await pool.query('SELECT id, sku, talla, precio, stock FROM variantes WHERE producto_id = ? AND activo = 1 ORDER BY id', [p.id]);
  res.json({ ...p, imagenes, variantes });
});

r.post('/productos', async (req, res) => {
  const data = cleanProduct(req.body);
  const variantes = cleanVariantes(req.body.variantes);
  if (!variantes.length) throw new HttpError(400, 'Agrega al menos una variante con precio y stock');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const slug = `${slugify(data.nombre)}-${crypto.randomBytes(2).toString('hex')}`;
    const [ins] = await conn.query('INSERT INTO productos SET ?', { ...data, slug });
    await syncVariantes(conn, ins.insertId, variantes);
    await conn.commit();
    res.status(201).json({ id: ins.insertId });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
});

r.put('/productos/:id', async (req, res) => {
  const data = cleanProduct(req.body);
  const variantes = cleanVariantes(req.body.variantes);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.query('UPDATE productos SET ? WHERE id = ?', [data, req.params.id]);
    if (!upd.affectedRows) throw new HttpError(404, 'Producto no encontrado');
    await syncVariantes(conn, Number(req.params.id), variantes);
    await conn.commit();
    res.json({ id: Number(req.params.id) });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
});

// Archivar (no se borra: las órdenes antiguas lo referencian)
r.delete('/productos/:id', async (req, res) => {
  await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

r.post('/productos/:id/imagenes', upload.single('imagen'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Selecciona una imagen');
  const [[p]] = await pool.query('SELECT id FROM productos WHERE id = ?', [req.params.id]);
  if (!p) throw new HttpError(404, 'Producto no encontrado');
  const { url, key } = await saveImage(req.file);
  const [[{ siguiente }]] = await pool.query('SELECT COALESCE(MAX(orden),0)+1 AS siguiente FROM producto_imagenes WHERE producto_id = ?', [p.id]);
  const [ins] = await pool.query('INSERT INTO producto_imagenes SET ?', { producto_id: p.id, url, s3_key: key, orden: siguiente });
  res.status(201).json({ id: ins.insertId, url });
});

r.delete('/imagenes/:id', async (req, res) => {
  const [[img]] = await pool.query('SELECT s3_key FROM producto_imagenes WHERE id = ?', [req.params.id]);
  if (!img) throw new HttpError(404, 'Imagen no encontrada');
  await pool.query('DELETE FROM producto_imagenes WHERE id = ?', [req.params.id]);
  await deleteImage(img.s3_key);
  res.json({ ok: true });
});

r.get('/ordenes', async (_req, res) => {
  const [ordenes] = await pool.query(
    `SELECT o.*, u.email AS cliente_email FROM ordenes o JOIN usuarios u ON u.id = o.usuario_id ORDER BY o.created_at DESC, o.id DESC LIMIT 200`);
  res.json(await attachItems(ordenes));
});

r.patch('/ordenes/:id/estado', async (req, res) => {
  const estado = req.body?.estado;
  if (!['pendiente', 'pagada', 'enviada', 'entregada', 'cancelada'].includes(estado)) throw new HttpError(400, 'Estado inválido');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]] = await conn.query('SELECT id, estado FROM ordenes WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!o) throw new HttpError(404, 'Pedido no encontrado');
    if (o.estado === 'cancelada') throw new HttpError(409, 'Un pedido cancelado no se puede reabrir');
    if (estado === 'cancelada') { // devolver stock
      const [items] = await conn.query('SELECT variante_id, cantidad FROM orden_items WHERE orden_id = ?', [o.id]);
      for (const it of items) {
        await conn.query('UPDATE variantes SET stock = stock + ? WHERE id = ?', [it.cantidad, it.variante_id]);
        const [[v]] = await conn.query('SELECT stock FROM variantes WHERE id = ?', [it.variante_id]);
        await conn.query('INSERT INTO movimientos_stock SET ?', { variante_id: it.variante_id, tipo: 'cancelacion', cantidad: it.cantidad, stock_resultante: v.stock, orden_id: o.id });
      }
    }
    await conn.query('UPDATE ordenes SET estado = ? WHERE id = ?', [estado, o.id]);
    await conn.commit();
    res.json({ ok: true, estado });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
});

export default r;
