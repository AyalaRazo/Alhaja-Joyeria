import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError } from '../errors.js';

const r = Router();

r.get('/categorias', async (_req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, slug, descripcion FROM categorias WHERE activa = 1 ORDER BY nombre');
  res.json(rows);
});

r.get('/materiales', async (_req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT material FROM productos WHERE activo = 1 ORDER BY material');
  res.json(rows.map(x => x.material));
});

// Listado: ?q=&categoria=slug&material=&min=&max=&orden=recientes|precio_asc|precio_desc&destacado=1&page=&limit=
r.get('/productos', async (req, res) => {
  const { q, categoria, material, min, max, destacado } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 12));
  const where = ['p.activo = 1', 'c.activa = 1'];
  const args = [];
  if (q) { where.push('(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.piedra LIKE ? OR p.material LIKE ?)'); args.push(...Array(4).fill(`%${q}%`)); }
  if (categoria) { where.push('c.slug = ?'); args.push(categoria); }
  if (material) { where.push('p.material = ?'); args.push(material); }
  if (destacado === '1') where.push('p.destacado = 1');
  if (min !== undefined && min !== '' && !isNaN(min)) { where.push('v.precio_desde >= ?'); args.push(Number(min)); }
  if (max !== undefined && max !== '' && !isNaN(max)) { where.push('v.precio_desde <= ?'); args.push(Number(max)); }
  const orderBy = { precio_asc: 'v.precio_desde ASC', precio_desc: 'v.precio_desde DESC' }[req.query.orden] || 'p.created_at DESC, p.id DESC';

  const from = `FROM productos p
    JOIN categorias c ON c.id = p.categoria_id
    JOIN (SELECT producto_id, MIN(precio) AS precio_desde, SUM(stock) AS stock_total
          FROM variantes WHERE activo = 1 GROUP BY producto_id) v ON v.producto_id = p.id
    WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${from}`, args);
  const [items] = await pool.query(
    `SELECT p.id, p.nombre, p.slug, p.material, p.piedra, p.destacado,
            c.nombre AS categoria, c.slug AS categoria_slug,
            v.precio_desde, v.stock_total,
            (SELECT url FROM producto_imagenes WHERE producto_id = p.id ORDER BY orden, id LIMIT 1) AS imagen
     ${from} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...args, limit, (page - 1) * limit]
  );
  res.json({ items, total, page, paginas: Math.max(1, Math.ceil(total / limit)) });
});

r.get('/productos/:ref', async (req, res) => {
  const ref = req.params.ref;
  const [[p]] = await pool.query(
    `SELECT p.*, c.nombre AS categoria, c.slug AS categoria_slug
     FROM productos p JOIN categorias c ON c.id = p.categoria_id
     WHERE p.activo = 1 AND c.activa = 1 AND (p.slug = ? OR p.id = ?)`, [ref, /^\d+$/.test(ref) ? Number(ref) : 0]);
  if (!p) throw new HttpError(404, 'Esta joya no está disponible');
  const [imagenes] = await pool.query('SELECT id, url FROM producto_imagenes WHERE producto_id = ? ORDER BY orden, id', [p.id]);
  const [variantes] = await pool.query('SELECT id, sku, talla, precio, stock FROM variantes WHERE producto_id = ? AND activo = 1 ORDER BY precio, id', [p.id]);
  res.json({ ...p, imagenes, variantes });
});

export default r;
