import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeError } from '../src/logica/erroresAuth.ts';
import { decidirZona } from '../src/logica/rutas.ts';

test('Credenciales incorrectas: mensaje que no revela si el correo existe', () => {
  const m = mensajeError({ code: 'invalid_credentials', status: 400 }, 'inicio');
  assert.equal(m, 'Correo o contraseña incorrectos.');
});

test('Registro de un correo existente se trata como alta correcta', () => {
  assert.equal(mensajeError({ code: 'user_already_exists', status: 422 }, 'registro'), null);
});

test('Errores de la base de datos se traducen', () => {
  assert.match(mensajeError({ message: 'EDAD_MINIMA' }, 'completar_registro')!, /18 años/);
});

test('Sin conexión y límite de intentos', () => {
  assert.match(mensajeError({ name: 'AuthRetryableFetchError', status: 0 }, 'inicio')!, /conexión/);
  assert.match(mensajeError({ status: 429 }, 'inicio')!, /Demasiados intentos/);
});

test('Error desconocido: mensaje genérico, nunca el texto técnico', () => {
  const m = mensajeError({ message: 'relation "x" does not exist', status: 500 }, 'general')!;
  assert.doesNotMatch(m, /relation/);
});

test('Sin error no hay mensaje', () => {
  assert.equal(mensajeError(null, 'inicio'), null);
});

test('Zonas de navegación según la sesión', () => {
  const base = { cargando: false, conSesion: true, registroCompleto: true, errorEstado: false };
  assert.equal(decidirZona({ ...base, cargando: true }), 'cargando');
  assert.equal(decidirZona({ ...base, conSesion: false }), 'publica');
  assert.equal(decidirZona({ ...base, errorEstado: true }), 'error_cuenta');
  assert.equal(decidirZona({ ...base, registroCompleto: null }), 'cargando');
  assert.equal(decidirZona({ ...base, registroCompleto: false }), 'completar_registro');
  assert.equal(decidirZona(base), 'app');
});
