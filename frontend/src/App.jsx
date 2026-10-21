import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Auth from './pages/Auth.jsx';
import Orders from './pages/Orders.jsx';
import Admin from './pages/Admin.jsx';
import { useAuth } from './store.jsx';

function Guard({ children, admin }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/acceso" state={{ from: loc.pathname }} replace />;
  if (admin && user.rol !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip" href="#main">Saltar al contenido</a>
      {import.meta.env.VITE_MOCK === 'true' && <p className="demo-banner">Modo demo: datos de ejemplo sin servidor. Admin: admin@alhaja.mx / Admin12345! · Cliente: ana@demo.mx / demo12345</p>}
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/joyas" element={<Catalog />} />
          <Route path="/joya/:slug" element={<Product />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/acceso" element={<Auth />} />
          <Route path="/pagar" element={<Guard><Checkout /></Guard>} />
          <Route path="/pedidos" element={<Guard><Orders /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<section className="wrap pad"><h1>Esta página no existe</h1><p>Vuelve al <a href="/">inicio</a> o explora las <a href="/joyas">joyas</a>.</p></section>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
