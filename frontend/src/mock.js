// Modo demo: simula el API en memoria (sin servidor ni base de datos). Se activa con `npm run dev:demo`.
// Los datos se reinician al recargar la página. Las imágenes subidas solo duran la sesión.
const TAX = 0.16;
const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
let seq = 1000;
const nid = () => ++seq;
const fail = m => { throw new Error(m); };

function seed() {
  const cats = [[1, 'Anillos', 'Solitarios, alianzas y anillos de compromiso'], [2, 'Collares', 'Cadenas, gargantillas y colgantes'], [3, 'Pulseras', 'Esclavas, tenis y brazaletes'], [4, 'Aretes', 'Broqueles, argollas y aretes largos']]
    .map(([id, nombre, descripcion]) => ({ id, nombre, slug: slugify(nombre), descripcion, activa: true }));
  const T = n => [5, 6, 7, 8].map((t, i) => [`Talla ${t}`, n - i]);
  const L = (...l) => l.map((x, i) => [`${x} cm`, 5 - i]);
  const U = s => [[null, s]];
  const rows = [
    [1, 'Solitario Aurora', 'Oro blanco 14k', 'Diamante 0.25 ct', 1, 'Solitario clásico con diamante central montado en garras.', 18900, T(3)],
    [1, 'Anillo Marea', 'Oro amarillo 14k', 'Zafiro azul', 1, 'Zafiro azul ovalado rodeado de pequeños brillantes.', 12400, T(3)],
    [1, 'Alianza Lisa', 'Oro amarillo 14k', null, 0, 'Alianza de 3 mm con acabado pulido. Se puede grabar.', 5800, T(4)],
    [1, 'Anillo Brasa', 'Plata .925', 'Rubí sintético', 0, 'Plata esterlina con rubí sintético talla corazón.', 1350, T(5)],
    [2, 'Gargantilla Perla Única', 'Oro amarillo 14k', 'Perla cultivada', 1, 'Perla cultivada de 8 mm sobre cadena fina ajustable.', 4600, L(40, 45, 50)],
    [2, 'Cadena Cordón', 'Oro amarillo 10k', null, 0, 'Cadena tipo cordón de 2 mm con mosquetón reforzado.', 6900, L(45, 50, 60)],
    [2, 'Colgante Gota de Esmeralda', 'Oro blanco 14k', 'Esmeralda', 1, 'Esmeralda en corte pera con halo de circonias.', 9700, U(4)],
    [3, 'Tenis Destello', 'Plata .925', 'Circonia', 1, 'Línea continua de circonias engarzadas.', 2150, L(16, 17, 18)],
    [3, 'Esclava Cuadro', 'Oro amarillo 10k', null, 0, 'Esclava de eslabón cuadrado con placa para grabado.', 7300, L(18, 19, 20)],
    [4, 'Broqueles Diamante', 'Oro blanco 14k', 'Diamante 0.10 ct', 1, 'Par de broqueles con diamante, cierre de presión.', 8900, U(6)],
    [4, 'Argollas Media Luna', 'Oro amarillo 14k', null, 0, 'Argollas huecas de 18 mm, livianas.', 3900, U(8)],
    [4, 'Gotas de Perla', 'Plata .925', 'Perla cultivada', 0, 'Aretes largos con perla cultivada de 7 mm.', 1250, U(7)],
  ];
  const prods = rows.map(([categoria_id, nombre, material, piedra, destacado, descripcion, precio, vs], i) => ({
    id: i + 1, categoria_id, nombre, slug: slugify(nombre), descripcion, material, piedra, destacado: !!destacado, activo: true, imagenes: [],
    variantes: vs.map(([talla, stock], j) => ({ id: nid(), sku: `ALH-${String(i + 1).padStart(3, '0')}-${j + 1}`, talla, precio, stock, activo: true })),
  }));
  return {
    cats, prods, ordenes: [],
    users: [
      { id: 1, nombre: 'Administrador', apellido: 'Alhaja', email: 'admin@alhaja.mx', password: 'Admin12345!', rol: 'admin' },
      { id: 2, nombre: 'Ana', apellido: 'López', email: 'ana@demo.mx', password: 'demo12345', rol: 'cliente' },
    ],
  };
}
let db = seed();

const pub = u => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol });
const activas = p => p.variantes.filter(v => v.activo);
const cat = p => db.cats.find(c => c.id === p.categoria_id);
const session = () => { const t = localStorage.getItem('alhaja_token') || ''; return t.startsWith('mock:') ? db.users.find(u => u.id === Number(t.slice(5))) : null; };

function card(p) {
  const vs = activas(p), c = cat(p);
  return { id: p.id, nombre: p.nombre, slug: p.slug, material: p.material, piedra: p.piedra, destacado: p.destacado ? 1 : 0, categoria: c.nombre, categoria_slug: c.slug,
    precio_desde: vs.length ? Math.min(...vs.map(v => v.precio)) : null, stock_total: vs.reduce((s, v) => s + v.stock, 0), imagen: p.imagenes[0]?.url || null };
}
const detalle = p => ({ ...p, destacado: p.destacado ? 1 : 0, categoria: cat(p).nombre, categoria_slug: cat(p).slug, variantes: activas(p).map(({ activo, ...v }) => v) });

function syncVariantes(p, list = []) {
  for (const v of list) {
    const sku = String(v.sku || '').trim(); const precio = Number(v.precio), stock = Number(v.stock);
    if (!sku) fail('Cada variante necesita un SKU');
    if (!(precio >= 0) || !Number.isInteger(stock) || stock < 0) fail(`Precio o stock inválido en ${sku}`);
    const dup = db.prods.some(x => x.variantes.some(y => y.sku === sku && y.id !== v.id));
    if (dup && !v.eliminar) fail('Ya existe un registro con ese valor (correo o SKU)');
    if (v.id) { const t = p.variantes.find(x => x.id === v.id); if (!t) continue; if (v.eliminar) t.activo = false; else Object.assign(t, { sku, talla: String(v.talla || '').trim() || null, precio, stock }); }
    else if (!v.eliminar) p.variantes.push({ id: nid(), sku, talla: String(v.talla || '').trim() || null, precio, stock, activo: true });
  }
}
function applyProduct(p, b) {
  const nombre = String(b.nombre || '').trim(), categoria_id = Number(b.categoria_id), material = String(b.material || '').trim();
  if (!nombre) fail('El nombre es obligatorio');
  if (!db.cats.some(c => c.id === categoria_id)) fail('Elige una categoría');
  if (!material) fail('Indica el material (ej. Oro 14k)');
  Object.assign(p, { nombre, categoria_id, material, descripcion: String(b.descripcion || '').trim() || null, piedra: String(b.piedra || '').trim() || null, destacado: !!b.destacado, activo: b.activo !== false });
}
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

export async function mockApi(path, { method = 'GET', body, form } = {}) {
  await new Promise(r => setTimeout(r, 120));
  const url = new URL(path, 'http://mock'), p = url.pathname, q = url.searchParams, u = session();
  const need = admin => { if (!u) fail('Inicia sesión para continuar'); if (admin && u.rol !== 'admin') fail('Acceso solo para administradores'); };
  const is = (m, re) => method === m && re.test(p);
  const seg = i => decodeURIComponent(p.split('/')[i]);

  if (is('GET', /^\/categorias$/)) return db.cats.filter(c => c.activa).map(({ activa, ...c }) => c);
  if (is('GET', /^\/materiales$/)) return [...new Set(db.prods.filter(x => x.activo).map(x => x.material))].sort();

  if (is('GET', /^\/productos$/)) {
    const lim = Math.min(48, Math.max(1, parseInt(q.get('limit')) || 12)), page = Math.max(1, parseInt(q.get('page')) || 1);
    const t = (q.get('q') || '').toLowerCase(), min = q.get('min'), max = q.get('max');
    let list = db.prods.filter(x => x.activo && activas(x).length).filter(x => {
      const c = card(x);
      return (!t || [x.nombre, x.descripcion, x.piedra, x.material].some(s => (s || '').toLowerCase().includes(t)))
        && (!q.get('categoria') || c.categoria_slug === q.get('categoria')) && (!q.get('material') || x.material === q.get('material'))
        && (q.get('destacado') !== '1' || x.destacado) && (!min || c.precio_desde >= +min) && (!max || c.precio_desde <= +max);
    }).map(card);
    const o = q.get('orden');
    if (o === 'precio_asc') list.sort((a, b) => a.precio_desde - b.precio_desde); else if (o === 'precio_desc') list.sort((a, b) => b.precio_desde - a.precio_desde); else list.sort((a, b) => b.id - a.id);
    return { items: list.slice((page - 1) * lim, page * lim), total: list.length, page, paginas: Math.max(1, Math.ceil(list.length / lim)) };
  }
  if (is('GET', /^\/productos\/[^/]+$/)) {
    const ref = seg(2), x = db.prods.find(x => x.activo && (x.slug === ref || String(x.id) === ref));
    return x ? detalle(x) : fail('Esta joya no está disponible');
  }

  if (is('POST', /^\/auth\/login$/)) {
    const x = db.users.find(x => x.email === String(body?.email || '').trim().toLowerCase() && x.password === body?.password);
    return x ? { token: 'mock:' + x.id, user: pub(x) } : fail('Correo o contraseña incorrectos');
  }
  if (is('POST', /^\/auth\/register$/)) {
    const { nombre, apellido, email, password } = body || {};
    if (!nombre?.trim() || !apellido?.trim()) fail('Escribe tu nombre y apellido');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) fail('Correo electrónico inválido');
    if ((password || '').length < 8) fail('La contraseña debe tener al menos 8 caracteres');
    if (db.users.some(x => x.email === email.trim().toLowerCase())) fail('Ya existe una cuenta con ese correo');
    const x = { id: nid(), nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim().toLowerCase(), password, rol: 'cliente' };
    db.users.push(x); return { token: 'mock:' + x.id, user: pub(x) };
  }

  if (is('POST', /^\/ordenes$/)) {
    need();
    const { items, envio = {}, notas } = body || {};
    if (!Array.isArray(items) || !items.length) fail('Tu carrito está vacío');
    if (['nombre', 'telefono', 'direccion', 'ciudad', 'cp'].some(k => !String(envio[k] || '').trim())) fail('Completa todos los datos de envío');
    const merged = new Map();
    for (const it of items) merged.set(Number(it.variante_id), (merged.get(Number(it.variante_id)) || 0) + Number(it.cantidad));
    const lines = [];
    for (const [id, cantidad] of merged) {
      const prod = db.prods.find(x => x.activo && x.variantes.some(v => v.id === id && v.activo)); const v = prod?.variantes.find(v => v.id === id);
      if (!v) fail('Una de las joyas ya no está disponible');
      if (v.stock < cantidad) fail(v.stock === 0 ? `${prod.nombre} se agotó` : `Solo quedan ${v.stock} pieza(s) de ${prod.nombre}${v.talla ? ' (' + v.talla + ')' : ''}`);
      lines.push({ v, prod, cantidad });
    }
    const r2 = n => Math.round(n * 100) / 100;
    const subtotal = r2(lines.reduce((s, l) => s + l.v.precio * l.cantidad, 0)), impuestos = r2(subtotal * TAX), total = r2(subtotal + impuestos);
    const oid = nid(), codigo = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    lines.forEach(l => { l.v.stock -= l.cantidad; });
    db.ordenes.unshift({ id: oid, usuario_id: u.id, cliente_email: u.email, codigo, subtotal, impuestos, total, estado: 'pendiente', envio_nombre: envio.nombre, envio_telefono: envio.telefono,
      envio_direccion: envio.direccion, envio_ciudad: envio.ciudad, envio_cp: envio.cp, notas: notas || null, created_at: new Date().toISOString(),
      items: lines.map(l => ({ id: nid(), orden_id: oid, variante_id: l.v.id, producto_nombre: l.prod.nombre, talla: l.v.talla, sku: l.v.sku, cantidad: l.cantidad, precio_unitario: l.v.precio, subtotal: r2(l.v.precio * l.cantidad) })) });
    return { orden: { id: oid, codigo, subtotal, impuestos, total } };
  }
  if (is('GET', /^\/ordenes$/)) { need(); return db.ordenes.filter(o => o.usuario_id === u.id); }

  // ---- Admin ----
  if (p.startsWith('/admin')) {
    need(true);
    if (is('GET', /^\/admin\/resumen$/)) return {
      ventas: db.ordenes.filter(o => o.estado !== 'cancelada').reduce((s, o) => s + o.total, 0), pendientes: db.ordenes.filter(o => o.estado === 'pendiente').length,
      productos: db.prods.filter(x => x.activo).length, stock_bajo: db.prods.filter(x => x.activo).flatMap(activas).filter(v => v.stock <= 2).length };
    if (is('GET', /^\/admin\/productos$/)) return [...db.prods].reverse().map(x => ({ ...card(x), activo: x.activo }));
    if (is('GET', /^\/admin\/productos\/\d+$/)) { const x = db.prods.find(x => x.id === +seg(3)); return x ? detalle(x) : fail('Producto no encontrado'); }
    if (is('POST', /^\/admin\/productos$/)) {
      const x = { id: nid(), slug: `${slugify(body?.nombre || 'producto')}-${Math.random().toString(16).slice(2, 6)}`, imagenes: [], variantes: [] };
      applyProduct(x, body || {});
      if (!(body.variantes || []).filter(v => !v.eliminar).length) fail('Agrega al menos una variante con precio y stock');
      syncVariantes(x, body.variantes); db.prods.push(x); return { id: x.id };
    }
    if (is('PUT', /^\/admin\/productos\/\d+$/)) { const x = db.prods.find(x => x.id === +seg(3)) || fail('Producto no encontrado'); applyProduct(x, body || {}); syncVariantes(x, body.variantes); return { id: x.id }; }
    if (is('DELETE', /^\/admin\/productos\/\d+$/)) { const x = db.prods.find(x => x.id === +seg(3)); if (x) x.activo = false; return { ok: true }; }
    if (is('POST', /^\/admin\/productos\/\d+\/imagenes$/)) {
      const x = db.prods.find(x => x.id === +seg(3)) || fail('Producto no encontrado'); const f = form?.get('imagen');
      if (!f) fail('Selecciona una imagen');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) fail('Solo se permiten imágenes JPG, PNG o WebP');
      if (f.size > 5 * 1024 * 1024) fail('La imagen supera los 5 MB');
      const im = { id: nid(), url: await readFile(f) }; x.imagenes.push(im); return im;
    }
    if (is('DELETE', /^\/admin\/imagenes\/\d+$/)) { db.prods.forEach(x => { x.imagenes = x.imagenes.filter(i => i.id !== +seg(3)); }); return { ok: true }; }
    if (is('GET', /^\/admin\/ordenes$/)) return db.ordenes;
    if (is('PATCH', /^\/admin\/ordenes\/\d+\/estado$/)) {
      const o = db.ordenes.find(o => o.id === +seg(3)) || fail('Pedido no encontrado'), e = body?.estado;
      if (!['pendiente', 'pagada', 'enviada', 'entregada', 'cancelada'].includes(e)) fail('Estado inválido');
      if (o.estado === 'cancelada') fail('Un pedido cancelado no se puede reabrir');
      if (e === 'cancelada') o.items.forEach(i => { const v = db.prods.flatMap(x => x.variantes).find(v => v.id === i.variante_id); if (v) v.stock += i.cantidad; });
      o.estado = e; return { ok: true, estado: e };
    }
  }
  fail('Ruta no encontrada');
}
