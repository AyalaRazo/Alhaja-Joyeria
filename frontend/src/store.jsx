import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext();
const CartCtx = createContext();
export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('alhaja_user')); } catch { return null; } });
  const save = ({ token, user }) => {
    localStorage.setItem('alhaja_token', token);
    localStorage.setItem('alhaja_user', JSON.stringify(user));
    setUser(user);
  };
  const value = useMemo(() => ({
    user,
    login: async (email, password) => save(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async data => save(await api('/auth/register', { method: 'POST', body: data })),
    logout: () => { localStorage.removeItem('alhaja_token'); localStorage.removeItem('alhaja_user'); setUser(null); },
  }), [user]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// Carrito en localStorage; el servidor revalida precio y stock al hacer el pedido.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('alhaja_cart')) || []; } catch { return []; } });
  useEffect(() => {
    localStorage.setItem('alhaja_cart', JSON.stringify(items));
    return () => {};
  }, [items]);
  const value = useMemo(() => ({
    items,
    count: items.reduce((s, i) => s + i.cantidad, 0),
    subtotal: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
    add: (item, qty = 1) => setItems(cur => {
      const found = cur.find(i => i.variante_id === item.variante_id);
      if (found) return cur.map(i => i.variante_id === item.variante_id ? { ...i, ...item, cantidad: Math.min(item.stock, i.cantidad + qty) } : i);
      return [...cur, { ...item, cantidad: Math.min(item.stock, qty) }];
    }),
    setQty: (id, q) => setItems(cur => cur.map(i => i.variante_id === id ? { ...i, cantidad: Math.max(1, Math.min(i.stock, q)) } : i)),
    remove: id => setItems(cur => cur.filter(i => i.variante_id !== id)),
    clear: () => setItems([]),
  }), [items]);
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}
