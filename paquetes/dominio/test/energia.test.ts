import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PerfilEnergetico, estimarEnergia, sugerirNivelActividad, tendenciaPeso, ADVERTENCIA_SITUACION } from '../src/energia.ts';
import { validarNutrientes, nutrientesReceta } from '../src/nutricion.ts';

const base: PerfilEnergetico = {
  edad: 30,
  sexo: 'mujer',
  alturaCm: 165,
  pesoKg: 60,
  actividad: 'moderado',
  objetivo: 'mantener',
  objetivoSecundario: 'ninguno',
  situacionesRelevantes: [],
};

test('RF-13: Mifflin-St Jeor, mujer 30 años, 165 cm, 60 kg, actividad moderada', () => {
  const e = estimarEnergia(base);
  assert.equal(e.metodo, 'mifflin_st_jeor');
  assert.equal(e.metabolismoBasal, 1320);
  assert.equal(e.factorActividad, 1.55);
  assert.equal(e.gastoDiario, 2046);
  assert.deepEqual([e.gastoDiarioMin, e.gastoDiarioMax], [1842, 2251]);
  assert.equal(e.ajustePct, 0);
  assert.equal(e.soloReferencia, false);
});

test('Hombre, pérdida conservadora con prioridad proteica', () => {
  const e = estimarEnergia({ ...base, sexo: 'hombre', edad: 35, alturaCm: 178, pesoKg: 82, objetivo: 'perder', ritmo: 'conservador' });
  // 10*82 + 6,25*178 - 5*35 + 5 = 1762,5 ; x1,55 = 2731,9 ; -10 % = 2458,7
  assert.equal(e.metabolismoBasal, 1763);
  assert.equal(e.gastoDiario, 2732);
  assert.equal(e.objetivoKcal, 2459);
  assert.equal(e.ajustePct, -10);
  assert.deepEqual(e.proteinaG, [131, 180]);
});

test('Sexo no indicado: constante intermedia y margen del 15 %', () => {
  const e = estimarEnergia({ ...base, sexo: 'no_indicado' });
  assert.equal(e.metabolismoBasal, 1403); // 1320,25 + 83
  assert.equal(e.gastoDiarioMin, Math.round(1403.25 * 1.55 * 0.85));
  assert.ok(e.advertencias.some((a) => a.includes('15 %')));
});

test('Katch-McArdle cuando hay porcentaje graso medido', () => {
  const e = estimarEnergia({ ...base, grasaPct: 25 });
  assert.equal(e.metodo, 'katch_mcardle');
  assert.equal(e.metabolismoBasal, Math.round(370 + 21.6 * 45));
});

test('RN-NUT-06: una situación relevante impide calcular déficit y recomienda profesional', () => {
  const e = estimarEnergia({ ...base, objetivo: 'perder', ritmo: 'moderado', situacionesRelevantes: ['embarazo'] });
  assert.equal(e.soloReferencia, true);
  assert.equal(e.ajustePct, 0);
  assert.equal(e.objetivoKcal, e.gastoDiario);
  assert.ok(e.advertencias.includes(ADVERTENCIA_SITUACION));
});

test('IMC inferior a 18,5 con objetivo de pérdida: no se calcula déficit', () => {
  const e = estimarEnergia({ ...base, pesoKg: 48, objetivo: 'perder' });
  assert.equal(e.soloReferencia, true);
  assert.equal(e.ajustePct, 0);
});

test('RN-NUT-05: el rango objetivo nunca queda por debajo del metabolismo basal', () => {
  const e = estimarEnergia({ ...base, actividad: 'sedentario', objetivo: 'perder', ritmo: 'moderado' });
  assert.ok(e.rangoKcal[0] >= e.metabolismoBasal);
  assert.ok(e.objetivoKcal >= e.metabolismoBasal);
});

test('Con IMC superior a 30 la proteína se calcula sobre el peso de referencia', () => {
  const e = estimarEnergia({ ...base, pesoKg: 110, objetivo: 'perder' });
  assert.equal(e.pesoReferenciaKg, 68.1); // IMC 25 a 1,65 m
  assert.deepEqual(e.proteinaG, [109, 150]);
});

test('Validación de rangos del perfil', () => {
  assert.throws(() => estimarEnergia({ ...base, edad: 16 }), /18/);
  assert.throws(() => estimarEnergia({ ...base, pesoKg: 700 }), /30 y 300/);
});

test('Propuesta de nivel de actividad a partir de actividad diaria y entrenamiento', () => {
  assert.equal(sugerirNivelActividad('sentado', 0, 0), 'sedentario');
  assert.equal(sugerirNivelActividad('sentado', 3, 60), 'moderado');
  assert.equal(sugerirNivelActividad('de_pie', 5, 60), 'muy_alto');
  assert.equal(sugerirNivelActividad('fisico', 6, 90), 'muy_alto');
});

test('Tendencia de peso suavizada', () => {
  const t = tendenciaPeso([80, 81, 79, 80]);
  assert.deepEqual(t, [80, 80.1, 79.99, 79.99]);
});

test('RN-NUT-02: macronutrientes que superan 100 g por 100 g son inválidos', () => {
  const r = validarNutrientes({ kcal: 590, proteinas: 30, carbohidratos: 50, grasas: 30 });
  assert.equal(r.valido, false);
  assert.ok(r.errores.includes('MACRONUTRIENTES_SUPERAN_100G'));
});

test('RN-NUT-03: energía incoherente con macronutrientes se marca para revisión', () => {
  const ok = validarNutrientes({ kcal: 350, proteinas: 7, carbohidratos: 77, grasas: 0.6, fibra: 1.4 });
  assert.equal(ok.valido, true);
  assert.deepEqual(ok.advertencias, []);
  const mal = validarNutrientes({ kcal: 100, proteinas: 7, carbohidratos: 77, grasas: 0.6 });
  assert.ok(mal.advertencias.includes('ENERGIA_INCOHERENTE_CON_MACRONUTRIENTES'));
  assert.equal(validarNutrientes({ kcal: 50, proteinas: -1, carbohidratos: 5, grasas: 1 }).valido, false);
});

test('RN-NUT-04: receta con ingrediente sin datos indica cobertura incompleta', () => {
  const r = nutrientesReceta(
    [
      { nombre: 'Arroz', gramos: 200, por100: { kcal: 350, proteinas: 7, carbohidratos: 77, grasas: 0.6 } },
      { nombre: 'Especia sin datos', gramos: 5, por100: null },
    ],
    2,
  );
  assert.equal(r.porRacion.kcal, 350);
  assert.equal(r.coberturaPct, 97.6);
  assert.deepEqual(r.sinDatos, ['Especia sin datos']);
});
