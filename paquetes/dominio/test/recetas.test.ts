import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cantidad } from '../src/cantidades.ts';
import {
  type Existencia,
  type Receta,
  type Restricciones,
  clasificarIngredientes,
  evaluarSeguridad,
  sugerirRecetas,
} from '../src/recetas.ts';

const sinRestricciones: Restricciones = { alergenos: [], intolerancias: [], dietas: [], rechazados: [], basicosDeclarados: ['sal', 'aceite_oliva'] };

const tortilla: Receta = {
  id: 'tortilla',
  nombre: 'Tortilla de espinacas y queso',
  raciones: 2,
  tiempoMin: 15,
  dificultad: 1,
  dietas: ['vegetariana', 'sin_gluten'],
  kcalPorRacion: 420,
  ingredientes: [
    { alimento: 'huevo', nombre: 'Huevo', cantidad: cantidad(4, 'ud'), alergenos: ['huevo'] },
    { alimento: 'espinaca', nombre: 'Espinacas frescas', cantidad: cantidad(150, 'g') },
    { alimento: 'queso_fresco', nombre: 'Queso fresco', cantidad: cantidad(100, 'g'), alergenos: ['leche'], sustitutos: [{ alimento: 'tofu', nombre: 'Tofu firme', ratio: 1 }] },
    { alimento: 'aceite_oliva', nombre: 'Aceite de oliva', cantidad: cantidad(10, 'ml') },
    { alimento: 'sal', nombre: 'Sal', cantidad: cantidad(2, 'g') },
    { alimento: 'nuez', nombre: 'Nueces picadas', cantidad: cantidad(20, 'g'), opcional: true, alergenos: ['frutos_de_cascara'] },
  ],
};

const lentejas: Receta = {
  id: 'lentejas',
  nombre: 'Lentejas estofadas',
  raciones: 4,
  tiempoMin: 50,
  dificultad: 2,
  dietas: ['vegana', 'vegetariana', 'sin_gluten'],
  kcalPorRacion: 380,
  ingredientes: [
    { alimento: 'lenteja', nombre: 'Lentejas pardinas', cantidad: cantidad(300, 'g') },
    { alimento: 'zanahoria', nombre: 'Zanahoria', cantidad: cantidad(2, 'ud') },
    { alimento: 'cebolla', nombre: 'Cebolla', cantidad: cantidad(1, 'ud') },
  ],
};

const despensa: Existencia[] = [
  { alimento: 'huevo', disponible: cantidad(6, 'ud'), diasHastaFecha: 10, abierto: true },
  { alimento: 'espinaca', disponible: cantidad(100, 'g'), diasHastaFecha: 1, abierto: true },
  { alimento: 'tofu', disponible: cantidad(200, 'g'), diasHastaFecha: 20, abierto: false },
  { alimento: 'lenteja', disponible: cantidad(1000, 'g'), diasHastaFecha: 300, abierto: false },
];

test('RN-NUT-07 / CA-05: una receta con alérgeno declarado nunca se sugiere', () => {
  const r = { ...sinRestricciones, alergenos: ['huevo'] };
  assert.equal(evaluarSeguridad(tortilla, r).segura, false);
  const s = sugerirRecetas([tortilla, lentejas], despensa, r, { kcalObjetivoComida: 600 });
  assert.deepEqual(s.map((x) => x.receta.id), ['lentejas']);
});

test('Un opcional con alérgeno se retira sin descartar la receta', () => {
  const r = { ...sinRestricciones, alergenos: ['frutos_de_cascara'] };
  const seg = evaluarSeguridad(tortilla, r);
  assert.equal(seg.segura, true);
  assert.deepEqual(seg.opcionalesRetirados, ['Nueces picadas']);
  assert.ok(!clasificarIngredientes(tortilla, despensa, r).some((c) => c.alimento === 'nuez'));
});

test('Intolerancia con tolerancia a trazas: solo filtra el ingrediente, no las trazas', () => {
  const receta: Receta = { ...lentejas, ingredientes: [...lentejas.ingredientes, { alimento: 'pan', nombre: 'Pan', cantidad: cantidad(50, 'g'), opcional: true, trazas: ['lactosa'] }] };
  const tolera = { ...sinRestricciones, intolerancias: [{ codigo: 'lactosa', toleraTrazas: true }] };
  const noTolera = { ...sinRestricciones, intolerancias: [{ codigo: 'lactosa', toleraTrazas: false }] };
  assert.deepEqual(evaluarSeguridad(receta, tolera).opcionalesRetirados, []);
  assert.deepEqual(evaluarSeguridad(receta, noTolera).opcionalesRetirados, ['Pan']);
});

test('Dieta declarada: una receta no apta se descarta', () => {
  const r = { ...sinRestricciones, dietas: ['vegana'] };
  assert.equal(evaluarSeguridad(tortilla, r).segura, false);
  assert.equal(evaluarSeguridad(lentejas, r).segura, true);
});

test('Clasificación: disponible, parcial, falta, básico y opcional, con sustituto en despensa', () => {
  const c = clasificarIngredientes(tortilla, despensa, sinRestricciones);
  const grupo = Object.fromEntries(c.map((x) => [x.alimento, x.grupo]));
  assert.deepEqual(grupo, {
    huevo: 'disponible',
    espinaca: 'parcial',
    queso_fresco: 'falta',
    aceite_oliva: 'basico',
    sal: 'basico',
    nuez: 'opcional',
  });
  const espinaca = c.find((x) => x.alimento === 'espinaca')!;
  assert.equal(espinaca.faltante!.valor, 50_000);
  const queso = c.find((x) => x.alimento === 'queso_fresco')!;
  assert.deepEqual(queso.sustitutosEnDespensa.map((s) => s.alimento), ['tofu']);
});

test('Escalado de raciones recalcula necesidades y faltantes', () => {
  const c = clasificarIngredientes(lentejas, despensa, sinRestricciones, 8);
  const lenteja = c.find((x) => x.alimento === 'lenteja')!;
  assert.equal(lenteja.necesario.valor, 600_000);
  assert.equal(lenteja.grupo, 'disponible');
});

test('Prioriza recetas que usan productos próximos a caducar y abiertos', () => {
  const s = sugerirRecetas([lentejas, tortilla], despensa, sinRestricciones, { kcalObjetivoComida: 450 });
  assert.equal(s[0].receta.id, 'tortilla');
  assert.ok(s[0].puntuacion.motivos.some((m) => m.includes('Espinacas frescas')));
});

test('Filtros de tiempo y dificultad', () => {
  const s = sugerirRecetas([lentejas, tortilla], despensa, sinRestricciones, { kcalObjetivoComida: 450, tiempoMaxMin: 20 });
  assert.deepEqual(s.map((x) => x.receta.id), ['tortilla']);
});
