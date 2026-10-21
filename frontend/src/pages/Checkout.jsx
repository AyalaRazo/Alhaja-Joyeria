import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api.js';
import { useAuth, useCart } from '../store.jsx';
import { Totals } from './Cart.jsx';

export default function Checkout() {
  const { user, logout } = useAuth();
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [f, setF] = useState({ nombre: `${user.nombre} ${user.apellido || ''}`.trim(), telefono: '', direccion: '', ciudad: '', cp: '', notas: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const on = k => e => setF({ ...f, [k]: e.target.value });

  if (!items.length) return <section className="wrap pad"><h1>No hay nada que pagar</h1><Link className="btn" to="/joyas">Ver joyas</Link></section>;

  const submit = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const { notas, ...envio } = f;
      const { orden } = await api('/ordenes', { method: 'POST', body: { items: items.map(i => ({ variante_id: i.variante_id, cantidad: i.cantidad })), envio, notas } });
      clear();
      nav('/pedidos', { state: { nuevo: orden.codigo, total: orden.total } });
    } catch (err) {
      setError(err.message);
      if (/sesión/i.test(err.message)) { logout(); nav('/acceso', { state: { from: '/pagar' } }); }
    } finally { setBusy(false); }
  };

  return (
    <section className="wrap pad cart">
      <h1>Datos de envío</h1>
      <div className="cart-grid">
        <form onSubmit={submit} className="form">
          <label htmlFor="n">Nombre de quien recibe</label>
          <input id="n" required value={f.nombre} onChange={on('nombre')} autoComplete="name" />
          <label htmlFor="t">Teléfono</label>
          <input id="t" required type="tel" value={f.telefono} onChange={on('telefono')} autoComplete="tel" />
          <label htmlFor="d">Calle y número</label>
          <input id="d" required value={f.direccion} onChange={on('direccion')} autoComplete="street-address" />
          <div className="two">
            <div><label htmlFor="c">Ciudad</label><input id="c" required value={f.ciudad} onChange={on('ciudad')} autoComplete="address-level2" /></div>
            <div><label htmlFor="z">Código postal</label><input id="z" required value={f.cp} onChange={on('cp')} autoComplete="postal-code" inputMode="numeric" /></div>
          </div>
          <label htmlFor="o">Notas (grabado, regalo, horario)</label>
          <textarea id="o" rows="3" value={f.notas} onChange={on('notas')} />
          {error && <p className="alert" role="alert">{error} <Link to="/carrito">Revisar carrito</Link></p>}
          <button className="btn" disabled={busy}>{busy ? 'Procesando…' : 'Confirmar pedido'}</button>
          <p className="muted small">Al confirmar se aparta tu pieza. El pago se coordina con la tienda para completar el pedido.</p>
        </form>
        <aside className="summary">
          <h2>Tu pedido</h2>
          <ul className="mini">{items.map(i => <li key={i.variante_id}><span>{i.cantidad} × {i.nombre}{i.talla ? ` (${i.talla})` : ''}</span><span>{money(i.precio * i.cantidad)}</span></li>)}</ul>
          <Totals subtotal={subtotal} />
        </aside>
      </div>
    </section>
  );
}
