import { useCallback, useEffect, useState } from 'react';
import { api, money } from '../api.js';
import Img from '../components/Img.jsx';
import { ESTADOS } from './Orders.jsx';

const VACIO = { nombre: '', categoria_id: '', material: '', piedra: '', descripcion: '', destacado: false, activo: true, variantes: [{ sku: '', talla: '', precio: '', stock: 0 }], imagenes: [] };

export default function Admin() {
  const [tab, setTab] = useState('resumen');
  return (
    <section className="wrap pad">
      <h1>Panel de administración</h1>
      <div className="tabs" role="tablist">
        {[['resumen', 'Resumen'], ['productos', 'Productos'], ['pedidos', 'Pedidos']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'resumen' && <Resumen />}
      {tab === 'productos' && <Productos />}
      {tab === 'pedidos' && <Pedidos />}
    </section>
  );
}

function Resumen() {
  const [r, setR] = useState(null);
  useEffect(() => { api('/admin/resumen').then(setR).catch(() => {}); }, []);
  if (!r) return <p className="muted">Cargando…</p>;
  return (
    <div className="stats">
      <div><span className="muted">Ventas (sin canceladas)</span><strong>{money(r.ventas)}</strong></div>
      <div><span className="muted">Pedidos pendientes</span><strong>{r.pendientes}</strong></div>
      <div><span className="muted">Productos activos</span><strong>{r.productos}</strong></div>
      <div><span className="muted">Variantes con 2 piezas o menos</span><strong>{r.stock_bajo}</strong></div>
    </div>
  );
}

function Productos() {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null); // null = lista; objeto = formulario
  const load = useCallback(() => api('/admin/productos').then(setList), []);
  useEffect(() => { load(); }, [load]);

  const abrir = async id => setEdit(id ? await api('/admin/productos/' + id) : { ...VACIO });
  const archivar = async p => {
    if (!confirm(`¿Archivar "${p.nombre}"? Dejará de verse en la tienda.`)) return;
    await api('/admin/productos/' + p.id, { method: 'DELETE' }); load();
  };

  if (edit) return <ProductoForm inicial={edit} onClose={() => { setEdit(null); load(); }} />;
  return (
    <>
      <div className="row between"><h2>Productos</h2><button className="btn" onClick={() => abrir()}>Nuevo producto</button></div>
      {!list ? <p className="muted">Cargando…</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Nombre</th><th>Categoría</th><th>Material</th><th>Desde</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} className={p.activo ? '' : 'off'}>
                  <td className="mini-img"><Img src={p.imagen} id={p.id} alt="" /></td>
                  <td>{p.nombre}</td><td>{p.categoria}</td><td>{p.material}</td>
                  <td>{p.precio_desde != null ? money(p.precio_desde) : '—'}</td>
                  <td>{p.stock_total}</td><td>{p.activo ? 'Activo' : 'Archivado'}</td>
                  <td className="nowrap"><button className="link" onClick={() => abrir(p.id)}>Editar</button>{p.activo && <button className="link danger" onClick={() => archivar(p)}>Archivar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ProductoForm({ inicial, onClose }) {
  const [f, setF] = useState(inicial);
  const [cats, setCats] = useState([]);
  const [msg, setMsg] = useState({ tipo: '', texto: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/categorias').then(setCats); }, []);
  const on = k => e => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setVar = (i, k, v) => setF({ ...f, variantes: f.variantes.map((x, j) => j === i ? { ...x, [k]: v } : x) });
  const quitarVar = i => {
    const v = f.variantes[i];
    setF({ ...f, variantes: v.id ? f.variantes.map((x, j) => j === i ? { ...x, eliminar: true } : x) : f.variantes.filter((_, j) => j !== i) });
  };

  const guardar = async e => {
    e.preventDefault(); setBusy(true); setMsg({});
    try {
      const body = { ...f, variantes: f.variantes.map(v => ({ ...v, precio: Number(v.precio), stock: Number(v.stock) })) };
      const res = f.id ? await api('/admin/productos/' + f.id, { method: 'PUT', body }) : await api('/admin/productos', { method: 'POST', body });
      setF(await api('/admin/productos/' + res.id));
      setMsg({ tipo: 'ok', texto: 'Guardado. Ya puedes subir imágenes.' });
    } catch (err) { setMsg({ tipo: 'alert', texto: err.message }); } finally { setBusy(false); }
  };

  const subir = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const form = new FormData(); form.append('imagen', file);
    try {
      const im = await api(`/admin/productos/${f.id}/imagenes`, { method: 'POST', form });
      setF(cur => ({ ...cur, imagenes: [...cur.imagenes, im] }));
    } catch (err) { setMsg({ tipo: 'alert', texto: err.message }); }
  };
  const borrarImg = async id => {
    await api('/admin/imagenes/' + id, { method: 'DELETE' });
    setF(cur => ({ ...cur, imagenes: cur.imagenes.filter(i => i.id !== id) }));
  };

  return (
    <form onSubmit={guardar} className="form editor">
      <div className="row between"><h2>{f.id ? 'Editar producto' : 'Nuevo producto'}</h2><button type="button" className="btn ghost" onClick={onClose}>Volver a la lista</button></div>
      <div className="two">
        <div><label htmlFor="pn">Nombre</label><input id="pn" required value={f.nombre} onChange={on('nombre')} /></div>
        <div><label htmlFor="pc">Categoría</label>
          <select id="pc" required value={f.categoria_id} onChange={on('categoria_id')}>
            <option value="">Elegir…</option>{cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></div>
        <div><label htmlFor="pm">Material</label><input id="pm" required placeholder="Oro amarillo 14k" value={f.material} onChange={on('material')} /></div>
        <div><label htmlFor="pp">Piedra (opcional)</label><input id="pp" placeholder="Diamante 0.25 ct" value={f.piedra || ''} onChange={on('piedra')} /></div>
      </div>
      <label htmlFor="pd">Descripción</label>
      <textarea id="pd" rows="3" value={f.descripcion || ''} onChange={on('descripcion')} />
      <div className="row checks">
        <label><input type="checkbox" checked={!!f.destacado} onChange={on('destacado')} /> Destacado en inicio</label>
        <label><input type="checkbox" checked={!!f.activo} onChange={on('activo')} /> Visible en la tienda</label>
      </div>

      <h3>Variantes (talla o largo, precio y stock)</h3>
      {f.variantes.map((v, i) => v.eliminar ? null : (
        <div className="var-row" key={v.id || i}>
          <input aria-label="SKU" placeholder="SKU" required value={v.sku} onChange={e => setVar(i, 'sku', e.target.value)} />
          <input aria-label="Talla o largo" placeholder="Talla 6 / 45 cm" value={v.talla || ''} onChange={e => setVar(i, 'talla', e.target.value)} />
          <input aria-label="Precio" type="number" min="0" step="0.01" placeholder="Precio" required value={v.precio} onChange={e => setVar(i, 'precio', e.target.value)} />
          <input aria-label="Stock" type="number" min="0" step="1" placeholder="Stock" required value={v.stock} onChange={e => setVar(i, 'stock', e.target.value)} />
          <button type="button" className="link danger" onClick={() => quitarVar(i)}>Quitar</button>
        </div>
      ))}
      <button type="button" className="link" onClick={() => setF({ ...f, variantes: [...f.variantes, { sku: '', talla: '', precio: '', stock: 0 }] })}>Agregar variante</button>

      {msg.texto && <p className={msg.tipo} role={msg.tipo === 'alert' ? 'alert' : 'status'}>{msg.texto}</p>}
      <div><button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button></div>

      <h3>Imágenes</h3>
      {!f.id ? <p className="muted">Guarda el producto para poder subir imágenes.</p> : (
        <>
          <div className="img-admin">
            {f.imagenes.map(im => (
              <div key={im.id}><Img src={im.url} alt="" /><button type="button" className="link danger" onClick={() => borrarImg(im.id)}>Quitar</button></div>
            ))}
          </div>
          <label htmlFor="up">Subir imagen (JPG, PNG o WebP, máximo 5 MB)</label>
          <input id="up" type="file" accept="image/jpeg,image/png,image/webp" onChange={subir} />
        </>
      )}
    </form>
  );
}

function Pedidos() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api('/admin/ordenes').then(setList).catch(e => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const cambiar = async (o, estado) => {
    if (estado === 'cancelada' && !confirm('Cancelar el pedido devuelve las piezas al inventario. ¿Continuar?')) return;
    try { await api(`/admin/ordenes/${o.id}/estado`, { method: 'PATCH', body: { estado } }); setError(''); load(); }
    catch (e) { setError(e.message); }
  };
  return (
    <>
      <h2>Pedidos</h2>
      {error && <p className="alert" role="alert">{error}</p>}
      {!list ? <p className="muted">Cargando…</p> : !list.length ? <p>Aún no hay pedidos.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Cliente</th><th>Envío</th><th>Piezas</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
              {list.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.codigo}</strong><br /><span className="muted small">{new Date(o.created_at).toLocaleDateString('es-MX')}</span></td>
                  <td>{o.envio_nombre}<br /><span className="muted small">{o.cliente_email} · {o.envio_telefono}</span></td>
                  <td className="small">{o.envio_direccion}, {o.envio_ciudad}, {o.envio_cp}{o.notas && <><br /><em>{o.notas}</em></>}</td>
                  <td className="small">{o.items.map(i => <div key={i.id}>{i.cantidad} × {i.producto_nombre}{i.talla ? ` (${i.talla})` : ''}</div>)}</td>
                  <td>{money(o.total)}</td>
                  <td>
                    <select aria-label={`Estado de ${o.codigo}`} value={o.estado} disabled={o.estado === 'cancelada'} onChange={e => cambiar(o, e.target.value)}>
                      {Object.entries(ESTADOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
