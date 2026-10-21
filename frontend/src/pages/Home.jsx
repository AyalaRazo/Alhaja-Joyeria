import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const [destacados, setDestacados] = useState(null);
  const [cats, setCats] = useState([]);
  useEffect(() => {
    api('/productos?destacado=1&limit=4').then(d => setDestacados(d.items)).catch(() => setDestacados([]));
    api('/categorias').then(setCats).catch(() => {});
  }, []);
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-text">
            <h1>Oro y plata para las fechas que se heredan.</h1>
            <p>Anillos de compromiso, alianzas, collares y aretes con certificado de autenticidad. Elige tu talla, grábalo y recíbelo asegurado.</p>
            <div className="row">
              <Link className="btn" to="/joyas">Ver todas las joyas</Link>
              <Link className="btn ghost" to="/joyas?categoria=anillos">Anillos de compromiso</Link>
            </div>
          </div>
          <div className="velvet" aria-hidden="true">
            <svg viewBox="0 0 200 200" className="hero-ring">
              <g fill="none" stroke="#C9A96A" strokeWidth="1.4" strokeLinejoin="round">
                <circle cx="100" cy="124" r="46" />
                <circle cx="100" cy="124" r="40" opacity=".5" />
                <polygon points="100,24 124,50 100,82 76,50" />
                <path d="M76 50h48M100 24v58M88 37l12 13 12-13" />
                <path d="M100 82v-6" />
              </g>
              <path className="glint" d="M64 40l22 22" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      <section className="wrap pad">
        <h2>Destacadas</h2>
        {destacados === null ? <p className="muted">Cargando…</p> :
          destacados.length ? <div className="grid">{destacados.map(p => <ProductCard key={p.id} p={p} />)}</div> :
          <p className="muted">Aún no hay piezas destacadas.</p>}
      </section>

      {cats.length > 0 && (
        <section className="wrap pad tight">
          <h2>Explora por categoría</h2>
          <div className="cat-list">
            {cats.map(c => (
              <Link key={c.id} to={`/joyas?categoria=${c.slug}`} className="cat">
                <strong>{c.nombre}</strong>
                <span className="muted">{c.descripcion}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
