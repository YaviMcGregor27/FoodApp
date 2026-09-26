import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type FilaLote,
  type FilaMovimiento,
  type FilaProducto,
  type FormularioAlta,
  caducanPronto,
  construirHistorial,
  filtrarDespensa,
  formatoCantidad,
  mensajeErrorDespensa,
  nuevoId,
  parsearNumero,
  prepararSalida,
  resumirDespensa,
  textoDisponible,
  textoFecha,
  validarAlta,
} from '../src/logica/despensa.ts';

const HOY = '2026-09-26';

const arroz: FilaProducto = { id: 'p-arroz', name: 'Arroz redondo', category: 'Cereales y legumbres', unit: 'g', default_package_size: 1000, portion_size: 80 };
const leche: FilaProducto = { id: 'p-leche', name: 'Leche', category: 'Lácteos', unit: 'ml', default_package_size: 1000, portion_size: null };
const huevos: FilaProducto = { id: 'p-huevos', name: 'Huevos', category: 'Huevos', unit: 'ud', default_package_size: null, portion_size: null };
const sal: FilaProducto = { id: 'p-sal', name: 'Sal', category: 'Aceites y condimentos', unit: 'g', default_package_size: 1000, portion_size: null };

function lote(p: Partial<FilaLote> & Pick<FilaLote, 'id' | 'user_product_id'>): FilaLote {
  return {
    unit: 'g',
    package_count: 1,
    package_size: 1000,
    initial_quantity: 1000,
    available_quantity: 1000,
    purchased_on: '2026-09-20',
    date_value: '2027-06-01',
    date_kind: 'consumo_preferente',
    opened_at: null,
    location: 'despensa',
    status: 'disponible',
    created_at: '2026-09-20T10:00:00Z',
    ...p,
  };
}

const lotes: FilaLote[] = [
  lote({ id: 'a-nuevo', user_product_id: 'p-arroz', purchased_on: '2026-09-25', date_value: '2027-08-01' }),
  lote({ id: 'a-abierto', user_product_id: 'p-arroz', available_quantity: 375, opened_at: '2026-09-22T10:00:00Z', status: 'abierto' }),
  lote({ id: 'l-1', user_product_id: 'p-leche', unit: 'ml', package_count: 2, initial_quantity: 2000, available_quantity: 1750, date_kind: 'caducidad', date_value: '2026-09-28', location: 'frigorifico', status: 'abierto', opened_at: '2026-09-25T08:00:00Z' }),
  lote({ id: 'h-1', user_product_id: 'p-huevos', unit: 'ud', package_size: null, initial_quantity: 12, available_quantity: 8, date_kind: 'pendiente', date_value: null, location: 'frigorifico' }),
  lote({ id: 's-1', user_product_id: 'p-sal', available_quantity: 0, status: 'agotado' }),
];

const resumen = resumirDespensa([arroz, leche, huevos, sal], lotes, HOY);
const porNombre = (n: string) => resumen.find((r) => r.producto.name === n)!;

test('Resumen: total, orden de consumo (abierto primero) y agotados', () => {
  const r = porNombre('Arroz redondo');
  assert.equal(r.disponible, 1_375_000);
  assert.deepEqual(r.lotes.map((l) => l.id), ['a-abierto', 'a-nuevo']);
  assert.equal(textoDisponible(r), '1,375 kg en 2 lotes');
  assert.equal(porNombre('Sal').agotado, true);
  assert.equal(textoDisponible(porNombre('Sal')), 'Agotado');
});

test('Texto de disponibilidad de un único lote: "X de Y"', () => {
  assert.equal(textoDisponible(porNombre('Huevos')), '8 ud de 12 ud');
  assert.equal(textoDisponible(porNombre('Leche')), '1,75 l de 2 l');
});

test('Caducidad: próxima a caducar, fecha pendiente y etiquetas', () => {
  const l = porNombre('Leche');
  assert.equal(l.caducidad, 'proximo_a_caducar');
  assert.equal(textoFecha(l), 'Cad. 28/09');
  assert.equal(textoFecha(porNombre('Huevos')), 'Fecha pendiente');
  assert.equal(textoFecha(porNombre('Arroz redondo')), 'C. pref. 01/06');
  assert.deepEqual(caducanPronto(resumen).map((r) => r.producto.name), ['Leche']);
});

test('Filtros por ubicación, estado y búsqueda', () => {
  const nombres = (o: Parameters<typeof filtrarDespensa>[1]) => filtrarDespensa(resumen, o).map((r) => r.producto.name);
  assert.deepEqual(nombres({ ubicacion: 'todas', filtro: 'todos', texto: '' }), ['Arroz redondo', 'Huevos', 'Leche']);
  assert.deepEqual(nombres({ ubicacion: 'frigorifico', filtro: 'todos', texto: '' }), ['Huevos', 'Leche']);
  assert.deepEqual(nombres({ ubicacion: 'todas', filtro: 'abiertos', texto: '' }), ['Arroz redondo', 'Leche']);
  assert.deepEqual(nombres({ ubicacion: 'todas', filtro: 'fecha_pendiente', texto: '' }), ['Huevos']);
  assert.deepEqual(nombres({ ubicacion: 'todas', filtro: 'agotados', texto: '' }), ['Sal']);
  assert.deepEqual(nombres({ ubicacion: 'todas', filtro: 'todos', texto: 'ARR' }), ['Arroz redondo']);
});

test('CA-03 en la app: fracciones del envase y de lo que queda sobre el lote que se consume primero', () => {
  const r = porNombre('Arroz redondo');
  const cuarto = prepararSalida(r, { modo: 'fraccion', fraccion: '1/4', referencia: 'envase' }, null);
  assert.equal(cuarto.salida!.cantidadDecimal, 250);
  assert.equal(cuarto.salida!.resumen, 'Se descontarán 250 g. Quedarán 1,125 kg.');
  const mitadRestante = prepararSalida(r, { modo: 'fraccion', fraccion: '1/2', referencia: 'restante' }, null);
  assert.equal(mitadRestante.salida!.cantidadDecimal, 187.5);
  const nuevo = prepararSalida(r, { modo: 'fraccion', fraccion: '1/2', referencia: 'envase' }, 'a-nuevo');
  assert.equal(nuevo.salida!.resumen, 'Se descontarán 500 g. Quedarán 500 g en este lote.');
});

test('3/4 de una unidad deja 1/4 y las porciones usan la porción configurada', () => {
  const unidad: FilaProducto = { id: 'p-u', name: 'Pan', category: 'Panadería', unit: 'ud', default_package_size: 1, portion_size: null };
  const r = resumirDespensa([unidad], [lote({ id: 'u', user_product_id: 'p-u', unit: 'ud', package_size: 1, initial_quantity: 1, available_quantity: 1 })], HOY)[0];
  assert.equal(prepararSalida(r, { modo: 'fraccion', fraccion: '3/4', referencia: 'envase' }, null).salida!.resumen,
    'Se descontarán 0,75 ud. Quedarán 0,25 ud.');
  const porcion = prepararSalida(porNombre('Arroz redondo'), { modo: 'porciones', texto: '2' }, null);
  assert.equal(porcion.salida!.cantidadDecimal, 160);
  assert.match(prepararSalida(porNombre('Leche'), { modo: 'porciones', texto: '1' }, null).error!, /porción configurada/);
});

test('No se puede consumir más de lo disponible ni cantidades no válidas', () => {
  assert.equal(prepararSalida(porNombre('Huevos'), { modo: 'cantidad', texto: '9' }, null).error, 'La cantidad supera lo disponible (8 ud).');
  assert.match(prepararSalida(porNombre('Huevos'), { modo: 'cantidad', texto: '0' }, null).error!, /mayor que 0/);
  assert.match(prepararSalida(porNombre('Huevos'), { modo: 'cantidad', texto: 'abc' }, null).error!, /mayor que 0/);
  assert.match(prepararSalida(porNombre('Huevos'), { modo: 'fraccion', fraccion: '1/2', referencia: 'envase' }, null).error!, /tamaño de envase/);
  assert.equal(prepararSalida(porNombre('Huevos'), { modo: 'todo' }, null).salida!.cantidadDecimal, 8);
});

const formulario: FormularioAlta = {
  nombre: 'Yogur natural',
  categoria: 'Lácteos',
  unidad: 'g',
  modo: 'envases',
  envases: '6',
  tamanoEnvase: '125',
  cantidad: '',
  fechaCompra: '26/09/2026',
  tipoFecha: 'caducidad',
  fecha: '08/10/2026',
  ubicacion: 'frigorifico',
  porcion: '125',
  abierto: false,
  confirmaFechaAnterior: false,
};

test('Alta válida con envases genera los parámetros de la base de datos', () => {
  const { errores, parametros } = validarAlta(formulario, HOY);
  assert.deepEqual(errores, {});
  assert.deepEqual(parametros, {
    p_nombre: 'Yogur natural',
    p_categoria: 'Lácteos',
    p_unidad: 'g',
    p_fecha_compra: '2026-09-26',
    p_ubicacion: 'frigorifico',
    p_tipo_fecha: 'caducidad',
    p_fecha: '2026-10-08',
    p_envases: 6,
    p_tamano_envase: 125,
    p_cantidad: null,
    p_porcion: 125,
    p_abierto: false,
    p_confirma_fecha_anterior: false,
  });
});

test('Alta a granel y sin fecha', () => {
  const { parametros } = validarAlta({ ...formulario, modo: 'cantidad', cantidad: '532,5', tipoFecha: 'sin_fecha', fecha: '', porcion: '' }, HOY);
  assert.equal(parametros!.p_cantidad, 532.5);
  assert.equal(parametros!.p_tamano_envase, null);
  assert.equal(parametros!.p_fecha, null);
});

test('Validaciones de alta: nombre, cantidades, fechas y porción', () => {
  const e = (cambios: Partial<FormularioAlta>) => validarAlta({ ...formulario, ...cambios }, HOY).errores;
  assert.ok(e({ nombre: '  ' }).nombre);
  assert.ok(e({ envases: '1,5' }).envases);
  assert.ok(e({ tamanoEnvase: '0' }).tamanoEnvase);
  assert.ok(e({ modo: 'cantidad', cantidad: '-3' }).cantidad);
  assert.ok(e({ fechaCompra: '30/02/2026' }).fechaCompra);
  assert.match(e({ fechaCompra: '01/10/2026' }).fechaCompra!, /futura/);
  assert.match(e({ fecha: '20/09/2026' }).fecha!, /anterior a la compra/);
  assert.deepEqual(e({ fecha: '20/09/2026', confirmaFechaAnterior: true }), {});
  assert.ok(e({ fecha: '' }).fecha);
  assert.match(e({ porcion: '200' }).porcion!, /mayor que el envase/);
});

test('Historial: orden, textos, deshacer una sola vez', () => {
  const mov = (p: Partial<FilaMovimiento> & Pick<FilaMovimiento, 'id' | 'kind' | 'delta' | 'quantity_after' | 'created_at'>): FilaMovimiento => ({
    lot_id: 'a-abierto', quantity_before: 0, consumption_event_id: null, reverses_movement_id: null, reason: null, ...p,
  });
  const h = construirHistorial([
    mov({ id: 'm1', kind: 'entrada_manual', delta: 1000, quantity_after: 1000, created_at: '2026-09-20T10:00:00Z' }),
    mov({ id: 'm2', kind: 'consumo_parcial', delta: -250, quantity_after: 750, created_at: '2026-09-21T10:00:00Z', consumption_event_id: 'e1' }),
    mov({ id: 'm3', kind: 'desperdicio', delta: -100, quantity_after: 650, created_at: '2026-09-22T10:00:00Z', consumption_event_id: 'e2', reason: 'en mal estado' }),
    mov({ id: 'm4', kind: 'correccion', delta: 100, quantity_after: 750, created_at: '2026-09-23T10:00:00Z', reverses_movement_id: 'm3', reason: 'deshacer' }),
  ], 'g');
  assert.deepEqual(h.map((x) => x.texto), ['Deshecho', 'Desechado (en mal estado)', 'Consumo', 'Entrada']);
  assert.deepEqual(h.map((x) => x.cambio), ['+100 g', '−100 g', '−250 g', '+1 kg']);
  assert.equal(h[1].deshecho, true);
  assert.equal(h[1].eventoDeshacible, null);
  assert.equal(h[2].eventoDeshacible, 'e1');
  assert.equal(h[3].eventoDeshacible, null);
});

test('Utilidades: números, cantidades, errores e identificadores', () => {
  assert.equal(parsearNumero('1,5'), 1.5);
  assert.equal(parsearNumero('1.5'), 1.5);
  assert.equal(parsearNumero('1,5,2'), null);
  assert.equal(parsearNumero(''), null);
  assert.equal(formatoCantidad(250, 'ud'), '0,25 ud');
  assert.equal(formatoCantidad(1_500_000, 'ml'), '1,5 l');
  assert.equal(formatoCantidad(999_000, 'g'), '999 g');
  assert.match(mensajeErrorDespensa({ message: 'CONSUMO_SUPERA_DISPONIBLE' })!, /supera lo disponible/);
  assert.equal(mensajeErrorDespensa({ message: 'otro error' }), null);
  assert.match(nuevoId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(nuevoId(), nuevoId());
});
