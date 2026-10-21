import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, money } from '../api.js';

export const ESTADOS = { pendiente: 'Pendiente de pago', pagada: 'Pagada', enviada: 'Enviada', entregada: 'Entregada', cancelada: 'Cancelada' };

export default function Orders() {
  const { state } = useLocation();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/ordenes').then(setList).catch(e => setError(e.message)); }, []);
  return (
    <section className="wrap pad narrow-lg">
      <h1>Mis pedidos</h1>
      {state?.nuevo && <p className="ok" role="status">Pedido {state.nuevo} registrado por {money(state.total)}. Te contactaremos para coordinar el pago y el envío.</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      {!list && !error && <p className="muted">Cargando…</p>}
      {list && !list.length && <p>Todavía no tienes pedidos. <Link to="/joyas">Explora las joyas</Link></p>}
      {list?.map(o => (
        <article key={o.id} className="order">
          <header>
            <div><strong>{o.codigo}</strong><p className="muted small">{new Date(o.created_at).toLocaleDateString('es-MX', { dateStyle: 'long' })}</p></div>
            <span className={`status ${o.estado}`}>{ESTADOS[o.estado]}</span>
          </header>
          <ul className="mini">{o.items.map(i => <li key={i.id}><span>{i.cantidad} × {i.producto_nombre}{i.talla ? ` (${i.talla})` : ''}</span><span>{money(i.subtotal)}</span></li>)}</ul>
          <p className="order-total">Total {money(o.total)}</p>
        </article>
      ))}
    </section>
  );
}
