import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api.js';
import Img from '../components/Img.jsx';
import { useCart } from '../store.jsx';

export default function Product() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { add } = useCart();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setP(null); setError(''); setAdded(false); setImg(0); setQty(1);
    api('/productos/' + slug).then(d => { setP(d); setSel(d.variantes.find(v => v.stock > 0) || d.variantes[0] || null); }).catch(e => setError(e.message));
  }, [slug]);

  if (error) return <section className="wrap pad"><h1>No encontramos esta joya</h1><p>{error}</p><Link to="/joyas">Volver al catálogo</Link></section>;
  if (!p) return <section className="wrap pad"><p className="muted">Cargando…</p></section>;

  const agotado = !sel || sel.stock === 0;
  const addToCart = go => {
    add({ variante_id: sel.id, producto_id: p.id, slug: p.slug, nombre: p.nombre, talla: sel.talla, precio: sel.precio, stock: sel.stock, imagen: p.imagenes[0]?.url || null, categoria: p.categoria_slug }, qty);
    if (go) nav('/carrito'); else setAdded(true);
  };

  return (
    <div className="wrap pad product">
      <div className="gallery">
        <Img className="big" src={p.imagenes[img]?.url} id={p.id} categoria={p.categoria_slug} alt={p.nombre} />
        {p.imagenes.length > 1 && (
          <div className="thumbs">
            {p.imagenes.map((im, i) => (
              <button key={im.id} className={i === img ? 'on' : ''} onClick={() => setImg(i)} aria-label={`Ver imagen ${i + 1}`}><Img src={im.url} alt="" /></button>
            ))}
          </div>
        )}
      </div>
      <div className="info">
        <p className="crumbs"><Link to={`/joyas?categoria=${p.categoria_slug}`}>{p.categoria}</Link></p>
        <h1>{p.nombre}</h1>
        <p className="muted">{p.material}{p.piedra ? `, ${p.piedra}` : ''}</p>
        <p className="price big">{sel ? money(sel.precio) : '—'}</p>
        {p.descripcion && <p className="desc">{p.descripcion}</p>}

        {p.variantes.length > 0 && (
          <fieldset className="variants">
            <legend>{p.variantes.some(v => v.talla) ? 'Talla o largo' : 'Presentación'}</legend>
            <div className="chips">
              {p.variantes.map(v => (
                <button key={v.id} type="button" className={`chip ${sel?.id === v.id ? 'on' : ''}`} disabled={v.stock === 0}
                  aria-pressed={sel?.id === v.id} onClick={() => { setSel(v); setQty(1); setAdded(false); }}>
                  {v.talla || 'Única'}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {sel && <p className={sel.stock <= 2 ? 'stock low' : 'stock'}>{sel.stock === 0 ? 'Agotado' : sel.stock <= 2 ? `Quedan ${sel.stock} pieza(s)` : 'Disponible'}</p>}

        <div className="row buy">
          <div className="qty" role="group" aria-label="Cantidad">
            <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Menos">−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(q => Math.min(sel?.stock || 1, q + 1))} aria-label="Más">+</button>
          </div>
          <button className="btn" disabled={agotado} onClick={() => addToCart(false)}>Agregar al carrito</button>
          <button className="btn ghost" disabled={agotado} onClick={() => addToCart(true)}>Comprar ahora</button>
        </div>
        {added && <p className="ok" role="status">Agregado. <Link to="/carrito">Ver carrito</Link></p>}
      </div>
    </div>
  );
}
