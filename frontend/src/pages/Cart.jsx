import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../store.jsx';
import { money, TAX_RATE } from '../api.js';
import Img from '../components/Img.jsx';

export function Totals({ subtotal }) {
  const iva = Math.round(subtotal * TAX_RATE * 100) / 100;
  return (
    <dl className="totals">
      <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      <div><dt>IVA ({Math.round(TAX_RATE * 100)}%)</dt><dd>{money(iva)}</dd></div>
      <div className="grand"><dt>Total</dt><dd>{money(subtotal + iva)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  const { items, subtotal, setQty, remove } = useCart();
  const nav = useNavigate();
  if (!items.length) return <section className="wrap pad"><h1>Tu carrito está vacío</h1><p>Cuando agregues una joya aparecerá aquí.</p><Link className="btn" to="/joyas">Ver joyas</Link></section>;
  return (
    <section className="wrap pad cart">
      <h1>Carrito</h1>
      <div className="cart-grid">
        <ul className="lines">
          {items.map(i => (
            <li key={i.variante_id}>
              <Link to={`/joya/${i.slug}`} className="thumb"><Img src={i.imagen} id={i.producto_id} categoria={i.categoria} alt={i.nombre} /></Link>
              <div className="grow">
                <Link to={`/joya/${i.slug}`}><strong>{i.nombre}</strong></Link>
                <p className="muted">{i.talla || 'Talla única'} · {money(i.precio)}</p>
                <button className="link" onClick={() => remove(i.variante_id)}>Quitar</button>
              </div>
              <div className="qty" role="group" aria-label={`Cantidad de ${i.nombre}`}>
                <button onClick={() => setQty(i.variante_id, i.cantidad - 1)} aria-label="Menos">−</button>
                <span>{i.cantidad}</span>
                <button onClick={() => setQty(i.variante_id, i.cantidad + 1)} disabled={i.cantidad >= i.stock} aria-label="Más">+</button>
              </div>
              <p className="line-total">{money(i.precio * i.cantidad)}</p>
            </li>
          ))}
        </ul>
        <aside className="summary">
          <h2>Resumen</h2>
          <Totals subtotal={subtotal} />
          <button className="btn full" onClick={() => nav('/pagar')}>Continuar con el pedido</button>
          <p className="muted small">El precio y la disponibilidad se confirman al finalizar.</p>
        </aside>
      </div>
    </section>
  );
}
