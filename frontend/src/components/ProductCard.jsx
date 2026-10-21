import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import { money } from '../api.js';

export default function ProductCard({ p }) {
  return (
    <Link to={`/joya/${p.slug}`} className="card">
      <Img src={p.imagen} id={p.id} categoria={p.categoria_slug} alt={p.nombre} />
      <div className="card-body">
        <h3>{p.nombre}</h3>
        <p className="muted">{p.material}{p.piedra ? `, ${p.piedra}` : ''}</p>
        <p className="price">{p.stock_total > 0 ? <>Desde {money(p.precio_desde)}</> : <span className="soldout">Agotado</span>}</p>
      </div>
    </Link>
  );
}
