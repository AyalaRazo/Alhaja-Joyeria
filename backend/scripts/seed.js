// Datos de ejemplo: categorías, un admin y piezas de joyería. Se puede ejecutar una sola vez.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM categorias');
if (n > 0) { console.log('La base ya tiene datos; no se hizo nada.'); process.exit(0); }

const adminEmail = process.env.ADMIN_EMAIL || 'admin@alhaja.mx';
const adminPass = process.env.ADMIN_PASSWORD || 'Admin12345!';
await pool.query('INSERT INTO usuarios SET ?', {
  nombre: 'Administrador', apellido: 'Alhaja', email: adminEmail, rol: 'admin',
  password_hash: await bcrypt.hash(adminPass, 10),
});

const cats = [
  ['Anillos', 'anillos', 'Solitarios, alianzas y anillos de compromiso'],
  ['Collares', 'collares', 'Cadenas, gargantillas y colgantes'],
  ['Pulseras', 'pulseras', 'Esclavas, tenis y brazaletes'],
  ['Aretes', 'aretes', 'Broqueles, argollas y aretes largos'],
];
const catId = {};
for (const [nombre, slug, descripcion] of cats) {
  const [r] = await pool.query('INSERT INTO categorias SET ?', { nombre, slug, descripcion });
  catId[slug] = r.insertId;
}

const tallas = n => [5, 6, 7, 8].map((t, i) => ({ talla: `Talla ${t}`, stock: n - i }));
const largos = (...l) => l.map((x, i) => ({ talla: `${x} cm`, stock: 5 - i }));
const unica = s => [{ talla: null, stock: s }];

const productos = [
  ['anillos', 'Solitario Aurora', 'Oro blanco 14k', 'Diamante 0.25 ct', 1, 'Solitario clásico con diamante central montado en garras. Un anillo para pedir la mano o para celebrar una fecha propia.', 18900, tallas(3)],
  ['anillos', 'Anillo Marea', 'Oro amarillo 14k', 'Zafiro azul', 1, 'Zafiro azul ovalado rodeado de pequeños brillantes. Banda fina de uso diario.', 12400, tallas(3)],
  ['anillos', 'Alianza Lisa', 'Oro amarillo 14k', null, 0, 'Alianza de 3 mm con acabado pulido. Se puede grabar con nombre y fecha.', 5800, tallas(4)],
  ['anillos', 'Anillo Brasa', 'Plata .925', 'Rubí sintético', 0, 'Plata esterlina con rubí sintético talla corazón. Ligero y fácil de combinar.', 1350, tallas(5)],
  ['collares', 'Gargantilla Perla Única', 'Oro amarillo 14k', 'Perla cultivada', 1, 'Perla cultivada de 8 mm sobre cadena fina ajustable.', 4600, largos(40, 45, 50)],
  ['collares', 'Cadena Cordón', 'Oro amarillo 10k', null, 0, 'Cadena tipo cordón de 2 mm. Cierre de mosquetón reforzado.', 6900, largos(45, 50, 60)],
  ['collares', 'Colgante Gota de Esmeralda', 'Oro blanco 14k', 'Esmeralda', 1, 'Esmeralda en corte pera con halo de circonias. Incluye cadena de 45 cm.', 9700, unica(4)],
  ['pulseras', 'Tenis Destello', 'Plata .925', 'Circonia', 1, 'Línea continua de circonias engarzadas. Cierre de seguridad.', 2150, largos(16, 17, 18)],
  ['pulseras', 'Esclava Cuadro', 'Oro amarillo 10k', null, 0, 'Esclava de eslabón cuadrado con placa para grabado.', 7300, largos(18, 19, 20)],
  ['aretes', 'Broqueles Diamante', 'Oro blanco 14k', 'Diamante 0.10 ct', 1, 'Par de broqueles con diamante de 0.05 ct cada uno, cierre de presión.', 8900, unica(6)],
  ['aretes', 'Argollas Media Luna', 'Oro amarillo 14k', null, 0, 'Argollas huecas de 18 mm, livianas y con cierre seguro.', 3900, unica(8)],
  ['aretes', 'Gotas de Perla', 'Plata .925', 'Perla cultivada', 0, 'Aretes largos con perla cultivada de 7 mm.', 1250, unica(7)],
];

let i = 0;
for (const [cat, nombre, material, piedra, destacado, descripcion, precio, vars] of productos) {
  i++;
  const slug = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const [p] = await pool.query('INSERT INTO productos SET ?', { categoria_id: catId[cat], nombre, slug, descripcion, material, piedra, destacado });
  let j = 0;
  for (const v of vars) {
    j++;
    const [ins] = await pool.query('INSERT INTO variantes SET ?', { producto_id: p.insertId, sku: `ALH-${String(i).padStart(3, '0')}-${j}`, talla: v.talla, precio: precio, stock: v.stock });
    await pool.query('INSERT INTO movimientos_stock SET ?', { variante_id: ins.insertId, tipo: 'entrada', cantidad: v.stock, stock_resultante: v.stock });
  }
}
console.log(`Listo. Admin: ${adminEmail} / ${adminPass}  (cámbiala después del primer ingreso)`);
process.exit(0);
