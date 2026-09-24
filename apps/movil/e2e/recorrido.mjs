// Prueba de extremo a extremo sobre la versión web exportada, con Supabase simulado.
// Recorre bienvenida, registro con validaciones, inicio de sesión fallido y correcto,
// pestañas, cuenta, cierre de sesión y registro pendiente de completar.
//
// Uso: node e2e/recorrido.mjs <carpeta de la exportación web> [carpeta para capturas]
// Variable opcional CHROMIUM_PATH para usar un Chromium ya instalado.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const RAIZ = process.argv[2];
const SALIDA = process.argv[3];
if (SALIDA) mkdirSync(SALIDA, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  let ruta = join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(ruta) || statSync(ruta).isDirectory()) ruta = join(RAIZ, 'index.html');
  res.writeHead(200, { 'content-type': tipos[extname(ruta)] ?? 'application/octet-stream' });
  res.end(readFileSync(ruta));
});
await new Promise((r) => servidor.listen(8123, r));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = Math.floor(Date.now() / 1000);
const usuario = { id: '00000000-0000-0000-0000-00000000000a', email: 'persona@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, role: 'authenticated', aud: 'authenticated', exp: ahora + 3600, iat: ahora, email: usuario.email, session_id: 's1' })}.firma`;
const sesion = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'r1', user: usuario };

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES' });
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text().slice(0, 300)); });

let registroCompleto = true;
const peticiones = [];
await pagina.route('https://ejemplo.supabase.co/**', async (ruta) => {
  const url = ruta.request().url();
  peticiones.push(`${ruta.request().method()} ${url.replace('https://ejemplo.supabase.co', '')}`);
  const json = (status, cuerpo) => ruta.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  if (url.includes('/auth/v1/token')) {
    const datos = ruta.request().postDataJSON();
    if (datos.password !== 'clave-correcta-123') return json(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return json(200, sesion);
  }
  if (url.includes('/rest/v1/rpc/estado_cuenta')) {
    const fila = { registro_completo: registroCompleto, correo_verificado: true, consentimiento_datos_salud: false };
    // Como PostgREST: con la cabecera de objeto único devuelve la fila, si no, una lista.
    const unico = (ruta.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return json(200, unico ? fila : [fila]);
  }
  if (url.includes('/auth/v1/logout')) return ruta.fulfill({ status: 204 });
  if (url.includes('/auth/v1/user')) return json(200, usuario);
  return json(404, {});
});

const captura = async (nombre) => {
  if (SALIDA) await pagina.screenshot({ path: join(SALIDA, `${nombre}.png`) });
};
const comprobar = async (texto) => {
  await pagina.getByText(texto, { exact: false }).first().waitFor({ timeout: 15000 });
};

// 1. Bienvenida
await pagina.goto('http://localhost:8123/');
await comprobar('Controla tu despensa');
await captura('01-bienvenida');

// 2. Registro con validaciones
await pagina.getByRole('button', { name: 'Crear cuenta' }).click();
await comprobar('Repite la contraseña');
await pagina.getByLabel('Correo electrónico').fill('persona@example');
await pagina.getByLabel('Contraseña', { exact: true }).fill('corta');
await pagina.getByLabel('Fecha de nacimiento').fill('01/01/2012');
await pagina.getByRole('button', { name: 'Crear cuenta' }).click();
await comprobar('Debes tener al menos 18 años');
await comprobar('Introduce un correo válido.');
await comprobar('Debes aceptar los términos');
await captura('02-registro-validaciones');

// 3. Inicio de sesión: credenciales incorrectas y después correctas
await pagina.goto('http://localhost:8123/iniciar-sesion');
await pagina.getByLabel('Correo electrónico').fill('persona@example.com');
await pagina.getByLabel('Contraseña', { exact: true }).fill('equivocada');
await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
await comprobar('Correo o contraseña incorrectos.');
await captura('03-inicio-sesion-error');
await pagina.getByLabel('Contraseña', { exact: true }).fill('clave-correcta-123');
await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();

// 4. Zona de la app: pestañas y aviso de consentimiento de salud
await comprobar('Resumen del día');
await comprobar('No has dado el consentimiento para datos de salud');
await captura('04-hoy');
await pagina.getByRole('tab', { name: /Progreso/ }).click().catch(async () => pagina.getByText('Progreso').last().click());
await comprobar('estimaciones basadas en fórmulas poblacionales');
await captura('05-progreso');

// 5. Cuenta y cierre de sesión
await pagina.getByRole('button', { name: 'Cuenta y ajustes' }).click();
await comprobar('persona@example.com');
await captura('06-cuenta');
await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
await comprobar('Controla tu despensa');

// 6. Cuenta creada con Apple o Google sin completar el registro
registroCompleto = false;
await pagina.goto('http://localhost:8123/iniciar-sesion');
await pagina.getByLabel('Correo electrónico').fill('persona@example.com');
await pagina.getByLabel('Contraseña', { exact: true }).fill('clave-correcta-123');
await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
await comprobar('Antes de continuar necesitamos tu fecha de nacimiento');
await captura('07-completar-registro');

await navegador.close();
servidor.close();

// Solo se admite el error esperado de la contraseña incorrecta (respuesta 400 simulada).
const inesperados = errores.filter((e) => !e.includes('status of 400'));
if (inesperados.length > 0) {
  console.error('Errores inesperados en la página:', inesperados);
  process.exit(1);
}
console.log('OK: recorrido de extremo a extremo completado');
