import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cantidad, parsearFraccion, normalizar, ErrorDominio } from '../dominio/cantidades.ts';
import {
  type Lote,
  calcularCantidadConsumo,
  consumirDeLote,
  consumirDeProducto,
  descartarResiduo,
  estadoCaducidad,
  mensajeCaducidad,
  ordenarLotesParaConsumo,
  validarLoteNuevo,
} from '../dominio/inventario.ts';

function lote(p: Partial<Lote> & Pick<Lote, 'id'>): Lote {
  return {
    producto: 'Arroz',
    unidad: 'g',
    envases: 1,
    tamanoEnvase: 1_000_000, // 1000 g en milésimas
    inicial: 1_000_000,
    disponible: 1_000_000,
    fechaCompra: '2026-09-20',
    fecha: '2027-06-01',
    tipoFecha: 'consumo_preferente',
    abierto: false,
    estado: 'disponible',
    ...p,
  };
}

function consumirFraccion(l: Lote, texto: string, referencia: 'envase' | 'restante' = 'envase') {
  const c = calcularCantidadConsumo(l, { modo: 'fraccion', fraccion: parsearFraccion(texto), referencia });
  return consumirDeLote(l, c);
}

test('CA-03: consumir 1/4 de un producto de 1 kg deja 750 g y el producto permanece', () => {
  const r = consumirFraccion(lote({ id: 'a' }), '1/4');
  assert.equal(r.lote.disponible, 750_000);
  assert.equal(r.lote.estado, 'abierto');
  assert.equal(r.movimiento.tipo, 'consumo_parcial');
  assert.deepEqual([r.movimiento.antes, r.movimiento.delta, r.movimiento.despues], [1_000_000, -250_000, 750_000]);
});

test('CA-03: consumir la mitad de un envase de 500 g deja 250 g', () => {
  const l = lote({ id: 'b', tamanoEnvase: 500_000, inicial: 500_000, disponible: 500_000 });
  assert.equal(consumirFraccion(l, '1/2').lote.disponible, 250_000);
});

test('CA-03: consumir 3/4 de una unidad deja 1/4 de unidad', () => {
  const l = lote({ id: 'c', unidad: 'ud', tamanoEnvase: 1000, inicial: 1000, disponible: 1000 });
  const r = consumirFraccion(l, '3/4');
  assert.equal(r.lote.disponible, 250);
  assert.equal(r.lote.estado, 'abierto');
});

test('CA-03: una porción configurada no elimina el producto', () => {
  const l = lote({ id: 'd', tamanoEnvase: 500_000, inicial: 500_000, disponible: 500_000 });
  const c = calcularCantidadConsumo(l, { modo: 'porciones', porciones: 1, tamanoPorcion: cantidad(30, 'g') });
  const r = consumirDeLote(l, c);
  assert.equal(r.lote.disponible, 470_000);
  assert.notEqual(r.lote.estado, 'agotado');
});

test('RN-INV-07: sin porción configurada no se asume una ración estándar', () => {
  const l = lote({ id: 'e' });
  assert.throws(
    () => calcularCantidadConsumo(l, { modo: 'porciones', porciones: 1, tamanoPorcion: null }),
    (e: ErrorDominio) => e.codigo === 'SIN_PORCION_CONFIGURADA',
  );
});

test('RN-INV-04: fracción "de lo que queda" usa la cantidad disponible como referencia', () => {
  const l = lote({ id: 'f', disponible: 600_000, abierto: true, estado: 'abierto' });
  const c = calcularCantidadConsumo(l, { modo: 'fraccion', fraccion: parsearFraccion('1/2'), referencia: 'restante' });
  assert.equal(c.valor, 300_000);
});

test('RN-INV-04: fracción "del envase" sin tamaño de envase se rechaza', () => {
  const l = lote({ id: 'g', tamanoEnvase: null });
  assert.throws(() => consumirFraccion(l, '1/4'), (e: ErrorDominio) => e.codigo === 'SIN_TAMANO_ENVASE');
});

test('RN-INV-05: el lote solo pasa a agotado cuando llega exactamente a cero', () => {
  const l = lote({ id: 'h' });
  const r1 = consumirDeLote(l, cantidad(999.999, 'g'));
  assert.equal(r1.lote.estado, 'abierto');
  assert.equal(r1.lote.disponible, 1);
  const r2 = consumirDeLote(r1.lote, calcularCantidadConsumo(r1.lote, { modo: 'todo' }));
  assert.equal(r2.lote.estado, 'agotado');
  assert.equal(r2.movimiento.tipo, 'consumo_total');
});

test('RN-INV-03: no se puede consumir más de lo disponible ni cantidades no positivas', () => {
  const l = lote({ id: 'i', tamanoEnvase: 500_000, inicial: 500_000, disponible: 500_000 });
  assert.throws(() => consumirDeLote(l, cantidad(600, 'g')), (e: ErrorDominio) => e.codigo === 'CONSUMO_SUPERA_DISPONIBLE');
  assert.throws(() => consumirDeLote(l, cantidad(0, 'g')), (e: ErrorDominio) => e.codigo === 'CANTIDAD_NO_POSITIVA');
  assert.throws(() => consumirDeLote(l, cantidad(-5, 'g')), (e: ErrorDominio) => e.codigo === 'CANTIDAD_NO_POSITIVA');
});

test('Unidades incompatibles no se convierten en silencio', () => {
  const l = lote({ id: 'j' });
  assert.throws(() => consumirDeLote(l, cantidad(1, 'ud')), (e: ErrorDominio) => e.codigo === 'UNIDAD_INCOMPATIBLE');
});

test('RN-INV-06: un residuo inferior al 2 % se señala pero no se elimina automáticamente', () => {
  const l = lote({ id: 'k' });
  const r = consumirDeLote(l, cantidad(990, 'g'));
  assert.equal(r.residuoBajo, true);
  assert.equal(r.lote.disponible, 10_000);
  assert.equal(r.lote.estado, 'abierto');
  const d = descartarResiduo(r.lote);
  assert.equal(d.movimiento.tipo, 'ajuste');
  assert.equal(d.movimiento.motivo, 'residuo');
  assert.equal(d.lote.estado, 'agotado');
});

test('Un tercio de unidad se redondea a milésimas sin perder la trazabilidad', () => {
  const l = lote({ id: 'l', unidad: 'ud', tamanoEnvase: 1000, inicial: 1000, disponible: 1000 });
  const r = consumirFraccion(l, '1/3');
  assert.equal(r.movimiento.delta, -333);
  assert.equal(r.lote.disponible, 667);
  assert.equal(r.movimiento.antes + r.movimiento.delta, r.movimiento.despues);
});

test('RN-INV-10: orden de asignación abiertos, caducidad próxima, compra antigua, sin fecha al final', () => {
  const lotes = [
    lote({ id: 'sin-fecha', fecha: null, tipoFecha: 'pendiente' }),
    lote({ id: 'cad-lejana', fecha: '2027-01-01' }),
    lote({ id: 'cad-cercana', fecha: '2026-10-01' }),
    lote({ id: 'abierto', fecha: '2027-05-01', abierto: true, estado: 'abierto' }),
    lote({ id: 'agotado', disponible: 0, estado: 'agotado' }),
  ];
  assert.deepEqual(ordenarLotesParaConsumo(lotes).map((l) => l.id), ['abierto', 'cad-cercana', 'cad-lejana', 'sin-fecha']);
});

test('Consumo repartido entre lotes genera un movimiento por lote y respeta el orden', () => {
  const lotes = [
    lote({ id: 'nuevo', fecha: '2026-12-01', fechaCompra: '2026-09-22' }),
    lote({ id: 'viejo', fecha: '2026-10-01', disponible: 200_000, abierto: true, estado: 'abierto' }),
  ];
  const r = consumirDeProducto(lotes, cantidad(500, 'g'));
  assert.deepEqual(
    r.movimientos.map((m) => [m.loteId, m.tipo, m.delta]),
    [
      ['viejo', 'consumo_total', -200_000],
      ['nuevo', 'consumo_parcial', -300_000],
    ],
  );
  assert.equal(r.lotes.find((l) => l.id === 'viejo')!.estado, 'agotado');
  assert.equal(r.lotes.find((l) => l.id === 'nuevo')!.disponible, 700_000);
});

test('Consumo superior a la suma de todos los lotes se rechaza sin modificar nada', () => {
  const lotes = [lote({ id: 'x', disponible: 100_000 }), lote({ id: 'y', disponible: 100_000 })];
  assert.throws(() => consumirDeProducto(lotes, cantidad(250, 'g')), (e: ErrorDominio) => e.codigo === 'CONSUMO_SUPERA_DISPONIBLE');
  assert.equal(lotes[0].disponible, 100_000);
});

test('RN-INV-11: estados derivados de caducidad', () => {
  const hoy = '2026-09-24';
  assert.equal(estadoCaducidad(lote({ id: '1', fecha: '2026-09-23', tipoFecha: 'caducidad' }), hoy), 'caducado');
  assert.equal(estadoCaducidad(lote({ id: '2', fecha: '2026-09-26', tipoFecha: 'caducidad' }), hoy), 'proximo_a_caducar');
  assert.equal(estadoCaducidad(lote({ id: '3', fecha: '2026-10-20', tipoFecha: 'caducidad' }), hoy), 'vigente');
  assert.equal(estadoCaducidad(lote({ id: '4', fecha: null, tipoFecha: 'pendiente' }), hoy), 'sin_fecha');
});

test('RN-INV-14: el mensaje de caducidad no afirma seguridad ni peligro', () => {
  const m = mensajeCaducidad(lote({ id: '1', fecha: '2026-09-20', tipoFecha: 'caducidad' }), '2026-09-24')!;
  assert.match(m, /Revisa el producto/);
  assert.doesNotMatch(m, /seguro|peligro|inseguro/i);
});

test('RN-INV-12 y RN-INV-13: validaciones de alta', () => {
  const hoy = '2026-09-24';
  const ok = { nombre: 'Leche', cantidad: 1000, fechaCompra: '2026-09-24', fecha: '2026-10-05' };
  assert.deepEqual(validarLoteNuevo(ok, hoy), []);
  assert.deepEqual(validarLoteNuevo({ ...ok, nombre: '   ' }, hoy), ['NOMBRE_OBLIGATORIO']);
  assert.deepEqual(validarLoteNuevo({ ...ok, cantidad: -1 }, hoy), ['CANTIDAD_NO_POSITIVA']);
  assert.deepEqual(validarLoteNuevo({ ...ok, fechaCompra: '2026-09-30' }, hoy), ['FECHA_COMPRA_FUTURA']);
  assert.deepEqual(validarLoteNuevo({ ...ok, fechaCompra: '2026-02-30' }, hoy), ['FECHA_COMPRA_INVALIDA']);
  assert.deepEqual(validarLoteNuevo({ ...ok, fecha: '2026-09-01' }, hoy), ['CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR']);
  assert.deepEqual(validarLoteNuevo({ ...ok, fecha: '2026-09-01', confirmaFechaAnterior: true }, hoy), []);
});

test('Normalización de unidades y fracciones', () => {
  assert.deepEqual(normalizar(1.5, 'L'), { valor: 1_500_000, unidad: 'ml' });
  assert.deepEqual(normalizar(0.532, 'kg'), { valor: 532_000, unidad: 'g' });
  assert.deepEqual(parsearFraccion('0,75'), { numerador: 750, denominador: 1000 });
  assert.throws(() => parsearFraccion('5/4'), (e: ErrorDominio) => e.codigo === 'FRACCION_FUERA_DE_RANGO');
  assert.throws(() => parsearFraccion('0'), (e: ErrorDominio) => e.codigo === 'FRACCION_FUERA_DE_RANGO');
});
