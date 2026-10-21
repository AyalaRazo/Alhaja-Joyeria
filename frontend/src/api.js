const BASE = import.meta.env.VITE_API_URL || '/api';
export const TAX_RATE = 0.16; // debe coincidir con TAX_RATE del backend
export const money = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
export const getToken = () => localStorage.getItem('alhaja_token');

export const assetUrl = u =>
  u && u.startsWith('/uploads') && import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') + u : u;

export async function api(path, { method = 'GET', body, form } = {}) {
  if (import.meta.env.VITE_MOCK === 'true') { const { mockApi } = await import('./mock.js'); return mockApi(path, { method, body, form }); }
  const headers = {};
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(BASE + path, { method, headers, body: payload }); }
  catch { throw new Error('No se pudo conectar con el servidor. Revisa tu conexión.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ocurrió un error inesperado');
  return data;
}
