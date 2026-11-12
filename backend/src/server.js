import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db.js';
import { HttpError } from './errors.js';
import { UPLOAD_DIR } from './storage.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('Define JWT_SECRET (mínimo 16 caracteres) en .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // detrás de Nginx
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean) }));
app.use(express.json({ limit: '200kb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/ordenes', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe un registro con ese valor (correo o SKU)' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'La imagen supera los 5 MB' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API Alhaja escuchando en :${port}`));
