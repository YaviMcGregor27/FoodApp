import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarLinea, analizarTicket, extraerEnvase, type LineaProducto } from '../src/ticket.ts';

function producto(texto: string): LineaProducto {
  const l = analizarLinea(texto);
  assert.equal(l.tipo, 'producto', `"${texto}" debería ser un producto`);
  return l as LineaProducto;
}

test('Producto vendido por peso coherente', () => {
  const p = producto('PLATANO CANARIAS 0,532 kg x 2,19 €/kg 1,17');
  assert.equal(p.nombreLeido, 'PLATANO CANARIAS');
  assert.equal(p.cantidad, 532);
  assert.equal(p.unidadCantidad, 'g');
  assert.equal(p.precioKg, 219);
  assert.equal(p.importe, 117);
  assert.equal(p.confianza.cantidad, 0.95);
  assert.deepEqual(p.avisos, []);
});

test('RN-TIC-04: producto a peso incoherente baja la confianza y avisa', () => {
  const p = producto('PLATANO CANARIAS 0,532 kg x 2,19 €/kg 1,71');
  assert.ok(p.confianza.cantidad < 0.7);
  assert.match(p.avisos[0], /^PESO_INCOHERENTE/);
});

test('RN-TIC-05: multiplicador delante y detrás del nombre', () => {
  const a = producto('2 LECHE SEMIDESNATADA 1L 0,89 1,78');
  assert.equal(a.cantidad, 2);
  assert.equal(a.nombreLeido, 'LECHE SEMIDESNATADA 1L');
  assert.deepEqual(a.envase, { cantidad: 1, tamano: 1000, unidad: 'ml' });
  const b = producto('TOMATE TRITURADO 400G 3 x 0,65 1,95');
  assert.equal(b.cantidad, 3);
  assert.deepEqual(b.envase, { cantidad: 1, tamano: 400, unidad: 'g' });
  const c = producto('2 x ATUN CLARO 0,95 2,00');
  assert.equal(c.confianza.importe, 0.6);
  assert.match(c.avisos[0], /^MULTIPLICADOR_INCOHERENTE/);
});

test('Línea simple con pack: cantidad supuesta con confianza media y envase extraído', () => {
  const p = producto('YOGUR NATURAL 6X125G 1,45');
  assert.equal(p.cantidad, 1);
  assert.ok(p.confianza.cantidad < 0.9);
  assert.deepEqual(p.envase, { cantidad: 6, tamano: 125, unidad: 'g' });
});

test('Sin tamaño en el texto, el envase queda pendiente (no se inventa)', () => {
  assert.deepEqual(extraerEnvase('PAN RUST'), { cantidad: 1, tamano: null, unidad: null });
});

test('RN-TIC-03 y RN-TIC-06: descuentos asociados y reconciliación con el total', () => {
  const t = analizarTicket([
    'SUPERMERCADO EJEMPLO S.A.',
    'NIF A00000000',
    '24/09/2026 18:42',
    '2 LECHE SEMIDESNATADA 1L 0,89 1,78',
    'YOGUR NATURAL 6X125G 1,45',
    'DTO 2ª UD -0,45',
    'PLATANO CANARIAS 0,532 kg x 2,19 €/kg 1,17',
    'BOLSA 0,15',
    'TOTAL 4,10',
    'TARJETA 4,10',
  ]);
  assert.equal(t.productos.length, 4);
  const yogur = t.productos.find((p) => p.nombreLeido.startsWith('YOGUR'))!;
  assert.equal(yogur.descuento, 45);
  assert.deepEqual(t.descuentosSinAsociar, []);
  assert.deepEqual(t.reconciliacion, { sumaLineas: 455, descuentos: 45, totalImpreso: 410, diferencia: 0, coincide: true });
});

test('Reconciliación que no cuadra indica posibles líneas no leídas', () => {
  const t = analizarTicket(['ARROZ REDONDO 1KG 1,20', 'TOTAL 2,55']);
  assert.equal(t.reconciliacion.coincide, false);
  assert.equal(t.reconciliacion.diferencia, 135);
});

test('Descuento sin producto previo queda sin asociar para revisión', () => {
  const t = analizarTicket(['CUPON BIENVENIDA -1,00', 'ARROZ REDONDO 1KG 1,20', 'TOTAL 0,20']);
  assert.equal(t.descuentosSinAsociar.length, 1);
  assert.equal(t.reconciliacion.coincide, true);
});

test('Líneas de pago e impuestos se ignoran', () => {
  assert.equal(analizarLinea('IVA 10% 0,37').tipo, 'ignorada');
  assert.equal(analizarLinea('ENTREGADO 5,00').tipo, 'ignorada');
  assert.equal(analizarLinea('GRACIAS POR SU VISITA').tipo, 'ignorada');
});
