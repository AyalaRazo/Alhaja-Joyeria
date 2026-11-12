import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso solo para administradores' });
  next();
}
