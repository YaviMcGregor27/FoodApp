import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENSAJES,
  calcularEdad,
  hayErrores,
  parsearFecha,
  validarCorreo,
  validarDatosIniciales,
  validarInicioSesion,
  validarNuevaContrasena,
  validarRegistro,
} from '../src/logica/registro.ts';

const HOY = '2026-09-25';

const valido = {
  correo: 'persona@example.com',
  contrasena: 'una-clave-larga-1',
  repetirContrasena: 'una-clave-larga-1',
  fechaNacimiento: '10/05/1990',
  aceptaTerminos: true,
};

test('Un registro correcto no tiene errores', () => {
  assert.deepEqual(validarRegistro(valido, HOY), {});
});

test('Correo, contraseña corta, contraseñas distintas y términos', () => {
  const e = validarRegistro(
    { ...valido, correo: 'sin-arroba', contrasena: 'corta', repetirContrasena: 'otra', aceptaTerminos: false },
    HOY,
  );
  assert.equal(e.correo, MENSAJES.correo);
  assert.equal(e.contrasena, MENSAJES.contrasenaCorta);
  assert.equal(e.repetirContrasena, MENSAJES.contrasenasDistintas);
  assert.equal(e.aceptaTerminos, MENSAJES.terminos);
  assert.equal(hayErrores(e), true);
});

test('RF-01: edad mínima de 18 años, contada al día', () => {
  assert.equal(validarRegistro({ ...valido, fechaNacimiento: '25/09/2008' }, HOY).fechaNacimiento, undefined);
  assert.equal(validarRegistro({ ...valido, fechaNacimiento: '26/09/2008' }, HOY).fechaNacimiento, MENSAJES.edadMinima);
});

test('Fechas: formato, fechas imposibles y futuras', () => {
  assert.equal(parsearFecha('10/05/1990'), '1990-05-10');
  assert.equal(parsearFecha('1-2-1985'), '1985-02-01');
  assert.equal(parsearFecha('29/02/2023'), null);
  assert.equal(parsearFecha('29/02/2024'), '2024-02-29');
  assert.equal(parsearFecha('1990-05-10'), null);
  assert.equal(parsearFecha('31/04/1990'), null);
  assert.equal(validarRegistro({ ...valido, fechaNacimiento: 'ayer' }, HOY).fechaNacimiento, MENSAJES.fechaFormato);
  assert.equal(validarRegistro({ ...valido, fechaNacimiento: '01/01/2030' }, HOY).fechaNacimiento, MENSAJES.fechaFutura);
});

test('Cálculo de edad', () => {
  assert.equal(calcularEdad('1990-05-10', '2026-05-09'), 35);
  assert.equal(calcularEdad('1990-05-10', '2026-05-10'), 36);
});

test('Validación de correo', () => {
  assert.equal(validarCorreo(' persona@example.com '), true);
  assert.equal(validarCorreo('persona@example'), false);
  assert.equal(validarCorreo('per sona@example.com'), false);
});

test('Inicio de sesión, nueva contraseña y datos iniciales', () => {
  assert.deepEqual(validarInicioSesion({ correo: 'a@b.es', contrasena: 'x' }), {});
  assert.equal(validarInicioSesion({ correo: 'a@b.es', contrasena: '' }).contrasena, MENSAJES.contrasenaVacia);
  assert.deepEqual(validarNuevaContrasena({ contrasena: 'doce-caracteres', repetirContrasena: 'doce-caracteres' }), {});
  assert.equal(validarNuevaContrasena({ contrasena: 'corta', repetirContrasena: 'corta' }).contrasena, MENSAJES.contrasenaCorta);
  assert.deepEqual(validarDatosIniciales({ fechaNacimiento: '01/01/2000', aceptaTerminos: true }, HOY), {});
  assert.equal(validarDatosIniciales({ fechaNacimiento: '01/01/2015', aceptaTerminos: true }, HOY).fechaNacimiento, MENSAJES.edadMinima);
});
