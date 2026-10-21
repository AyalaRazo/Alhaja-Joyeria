import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(sp.get('q') || '');

  useEffect(() => { api('/categorias').then(setCats).catch(() => {}); api('/materiales').then(setMateriales).catch(() => {}); }, []);
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);
  useEffect(() => {
    setData(null); setError('');
    api('/productos?' + sp.toString() + (sp.has('limit') ? '' : '&limit=12')).then(setData).catch(e => setError(e.message));
  }, [sp]);

  const set = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n);
  };
  const page = Number(sp.get('page') || 1);
  const titulo = cats.find(c => c.slug === sp.get('categoria'))?.nombre || 'Todas las joyas';

  return (
    <div className="wrap pad catalog">
      <aside className="filters" aria-label="Filtros">
        <form onSubmit={e => { e.preventDefault(); set('q', q.trim()); }} role="search">
          <label htmlFor="q">Buscar</label>
          <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Zafiro, perla, solitario…" />
        </form>
        <label htmlFor="cat">Categoría</label>
        <select id="cat" value={sp.get('categoria') || ''} onChange={e => set('categoria', e.target.value)}>
          <option value="">Todas</option>
          {cats.map(c => <option key={c.id} value={c.slug}>{c.nombre}</option>)}
        </select>
        <label htmlFor="mat">Material</label>
        <select id="mat" value={sp.get('material') || ''} onChange={e => set('material', e.target.value)}>
          <option value="">Todos</option>
          {materiales.map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="two">
          <div><label htmlFor="min">Precio mínimo</label><input id="min" type="number" min="0" defaultValue={sp.get('min') || ''} onBlur={e => set('min', e.target.value)} /></div>
          <div><label htmlFor="max">Precio máximo</label><input id="max" type="number" min="0" defaultValue={sp.get('max') || ''} onBlur={e => set('max', e.target.value)} /></div>
        </div>
        <label htmlFor="ord">Ordenar por</label>
        <select id="ord" value={sp.get('orden') || ''} onChange={e => set('orden', e.target.value)}>
          <option value="">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
        </select>
        {sp.toString() && <button className="link" onClick={() => setSp({})}>Quitar filtros</button>}
      </aside>

      <section>
        <h1>{titulo}</h1>
        {error && <p className="alert" role="alert">{error}</p>}
        {!data && !error && <p className="muted">Cargando joyas…</p>}
        {data && (data.items.length ? (
          <>
            <p className="muted">{data.total} {data.total === 1 ? 'pieza' : 'piezas'}</p>
            <div className="grid">{data.items.map(p => <ProductCard key={p.id} p={p} />)}</div>
            {data.paginas > 1 && (
              <div className="pager">
                <button className="btn ghost" disabled={page <= 1} onClick={() => set('page', page - 1)}>Anterior</button>
                <span>Página {data.page} de {data.paginas}</span>
                <button className="btn ghost" disabled={page >= data.paginas} onClick={() => set('page', page + 1)}>Siguiente</button>
              </div>
            )}
          </>
        ) : <p>No encontramos joyas con esos filtros. <button className="link" onClick={() => setSp({})}>Quitar filtros</button></p>)}
      </section>
    </div>
  );
}
