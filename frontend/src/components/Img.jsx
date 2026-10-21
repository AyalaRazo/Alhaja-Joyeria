import { assetUrl } from '../api.js';

const TINTS = [['#2A0E15', '#561A2B'], ['#0E2724', '#1B4A43'], ['#121D36', '#26407A'], ['#24211D', '#453F37']];

function Glyph({ categoria }) {
  const p = { fill: 'none', stroke: '#C9A96A', strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' };
  const g = {
    anillos: <><circle cx="50" cy="62" r="22" {...p} /><polygon points="50,14 61,27 50,42 39,27" {...p} /><path d="M39 27h22M50 14v28" {...p} /></>,
    collares: <><path d="M16 22Q50 92 84 22" {...p} /><polygon points="50,64 58,74 50,88 42,74" {...p} /></>,
    pulseras: <><ellipse cx="50" cy="50" rx="32" ry="20" {...p} /><circle cx="50" cy="30" r="3" {...p} /><circle cx="28" cy="40" r="3" {...p} /><circle cx="72" cy="40" r="3" {...p} /></>,
    aretes: <><path d="M34 14v22M66 14v22" {...p} /><path d="M34 36l8 14-8 16-8-16z" {...p} /><path d="M66 36l8 14-8 16-8-16z" {...p} /></>,
  };
  return <svg viewBox="0 0 100 100" aria-hidden="true" className="glyph">{g[categoria] || <><polygon points="28,38 40,24 60,24 72,38 50,78" {...p} /><path d="M28 38h44M40 24l10 14 10-14M50 38v40" {...p} /></>}</svg>;
}

export default function Img({ src, alt = '', id = 0, categoria = '', className = '' }) {
  if (src) return <img className={`img ${className}`} src={assetUrl(src)} alt={alt} loading="lazy" />;
  const [a, b] = TINTS[id % TINTS.length];
  return (
    <div className={`img ph ${className}`} role="img" aria-label={alt} style={{ background: `radial-gradient(circle at 50% 38%, ${b}, ${a} 75%)` }}>
      <Glyph categoria={categoria} />
    </div>
  );
}
