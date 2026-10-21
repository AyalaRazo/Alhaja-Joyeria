import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store.jsx';

export default function Auth() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const { state } = useLocation();
  const [modo, setModo] = useState('login');
  const [f, setF] = useState({ nombre: '', apellido: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const on = k => e => setF({ ...f, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (modo === 'login') await login(f.email, f.password); else await register(f);
      nav(state?.from || '/', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <section className="wrap pad narrow">
      <h1>{modo === 'login' ? 'Ingresar' : 'Crear cuenta'}</h1>
      {state?.from && <p className="muted">Ingresa para continuar con tu pedido.</p>}
      <form onSubmit={submit} className="form">
        {modo === 'register' && (
          <div className="two">
            <div><label htmlFor="nom">Nombre</label><input id="nom" required value={f.nombre} onChange={on('nombre')} autoComplete="given-name" /></div>
            <div><label htmlFor="ape">Apellido</label><input id="ape" required value={f.apellido} onChange={on('apellido')} autoComplete="family-name" /></div>
          </div>
        )}
        <label htmlFor="em">Correo electrónico</label>
        <input id="em" type="email" required value={f.email} onChange={on('email')} autoComplete="email" />
        <label htmlFor="pw">Contraseña</label>
        <input id="pw" type="password" required minLength={modo === 'register' ? 8 : undefined} value={f.password} onChange={on('password')} autoComplete={modo === 'login' ? 'current-password' : 'new-password'} />
        {modo === 'register' && <p className="muted small">Mínimo 8 caracteres.</p>}
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      </form>
      <p>{modo === 'login' ? '¿Primera vez?' : '¿Ya tienes cuenta?'}{' '}
        <button className="link" onClick={() => { setModo(modo === 'login' ? 'register' : 'login'); setError(''); }}>{modo === 'login' ? 'Crear cuenta' : 'Ingresar'}</button>
      </p>
    </section>
  );
}
