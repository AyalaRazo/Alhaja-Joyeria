import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, useCart } from '../store.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const nav = useNavigate();
  return (
    <header className="site-header">
      <div className="wrap bar">
        <Link to="/" className="brand" aria-label="Alhaja, inicio">Alhaja</Link>
        <nav className="nav" aria-label="Principal">
          <NavLink to="/joyas" end>Joyas</NavLink>
          <NavLink to="/joyas?categoria=anillos">Anillos</NavLink>
          <NavLink to="/joyas?categoria=collares">Collares</NavLink>
          <NavLink to="/joyas?categoria=pulseras">Pulseras</NavLink>
          <NavLink to="/joyas?categoria=aretes">Aretes</NavLink>
        </nav>
        <div className="actions">
          {user?.rol === 'admin' && <Link to="/admin">Panel</Link>}
          {user ? (
            <>
              <Link to="/pedidos">Mis pedidos</Link>
              <button className="link" onClick={() => { logout(); nav('/'); }}>Salir</button>
            </>
          ) : <Link to="/acceso">Ingresar</Link>}
          <Link to="/carrito" className="cart-link">Carrito<span className="badge" aria-label={`${count} artículos`}>{count}</span></Link>
        </div>
      </div>
    </header>
  );
}
