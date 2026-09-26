// Prueba de extremo a extremo sobre la versión web exportada, con Supabase simulado.
// Recorre bienvenida, registro con validaciones, inicio de sesión fallido y correcto,
// despensa (alta, validaciones, consumo de una fracción, deshacer, caducidad próxima),
// pestañas, cuenta, cierre de sesión y registro pendiente de completar.
//
// Uso: node e2e/recorrido.mjs <carpeta de la exportación web> [carpeta para capturas]
// Variable opcional CHROMIUM_PATH para usar un Chromium ya instalado.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { crearSimulador } from './supabase-simulado.mjs';

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

const simulador = crearSimulador();

const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-ES' });
const errores = [];
pagina.on('pageerror', (e) => errores.push(String(e)));
pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text().slice(0, 300)); });
// Confirmaciones (deshacer, residuos): se aceptan.
pagina.on('dialog', (d) => d.accept());
await pagina.route('https://ejemplo.supabase.co/**', (ruta) => simulador.manejar(ruta));

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

// 4. Zona de la app: pantalla Hoy y aviso de consentimiento de salud
await comprobar('Resumen del día');
await comprobar('No has dado el consentimiento para datos de salud');
await comprobar('Ningún producto de tu despensa caduca');
await captura('04-hoy');

// 5. Despensa vacía, validación y alta de un producto por envases
const fecha = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const pestana = (nombre) => pagina.getByRole('tab', { name: new RegExp(nombre) }).click();
await pestana('Despensa');
await comprobar('Tu despensa está vacía');
await pagina.getByRole('button', { name: 'Añadir producto' }).click();
await pagina.getByRole('button', { name: 'Guardar en la despensa' }).click();
await comprobar('El nombre del producto es obligatorio.');
await pagina.getByLabel('Nombre del producto').fill('Arroz redondo');
await pagina.getByRole('radio', { name: 'Cereales y legumbres' }).click();
await pagina.getByLabel('Tamaño de cada envase (g)').fill('1000');
await pagina.getByRole('radio', { name: 'Consumo preferente' }).click();
await pagina.getByLabel('Fecha', { exact: true }).fill(fecha(250));
await pagina.getByLabel('Porción habitual (g, opcional)').fill('80');
await captura('05-anadir');
await pagina.getByRole('button', { name: 'Guardar en la despensa' }).click();
await comprobar('Arroz redondo');
await comprobar('1 kg · C. pref.');

// 6. Segundo producto que caduca en dos días: aparece en "Caducan pronto"
await pagina.getByRole('button', { name: 'Añadir producto' }).click();
await pagina.getByLabel('Nombre del producto').fill('Leche semidesnatada');
await pagina.getByRole('radio', { name: 'Mililitros (ml)' }).click();
await pagina.getByLabel('Número de envases').fill('2');
await pagina.getByLabel('Tamaño de cada envase (ml)').fill('1000');
await pagina.getByRole('radio', { name: 'Caducidad', exact: true }).click();
await pagina.getByLabel('Fecha', { exact: true }).fill(fecha(2));
await pagina.getByRole('radio', { name: 'Frigorífico' }).click();
await pagina.getByRole('button', { name: 'Guardar en la despensa' }).click();
await comprobar('Leche semidesnatada');
await comprobar('Caduca pronto');
await captura('06-despensa');

// 7. Consumir 1/4 del envase de arroz: vista previa, registro e historial
await pagina.getByRole('button', { name: /^Arroz redondo/ }).click();
await comprobar('Porción configurada: 80 g');
await pagina.getByRole('button', { name: 'Consumir', exact: true }).click();
await comprobar('Se descontarán 250 g. Quedarán 750 g.');
await captura('07-consumir');
await pagina.getByRole('button', { name: 'Registrar consumo' }).click();
await comprobar('750 g de 1 kg');
await comprobar('Consumo: −250 g');
await captura('08-producto');

// 8. Deshacer el consumo
await pagina.getByRole('button', { name: 'Deshacer' }).first().click();
await comprobar('Operación deshecha.');
await comprobar('Deshecho: +250 g');

// 9. No se puede consumir más de lo disponible
await pagina.getByRole('button', { name: 'Consumir', exact: true }).click();
await pagina.getByRole('radio', { name: 'Cantidad', exact: true }).click();
await pagina.getByLabel('Cantidad (g)').fill('1500');
await comprobar('La cantidad supera lo disponible (1 kg).');
await pagina.getByLabel('Cantidad (g)').fill('');
await pagina.goBack();
await pagina.goBack();

// 10. La pantalla Hoy muestra la leche que caduca pronto
await pestana('Hoy');
await comprobar('Leche semidesnatada');
await captura('09-hoy-caducan');
await pagina.getByRole('tab', { name: /Progreso/ }).click().catch(async () => pagina.getByText('Progreso').last().click());
await comprobar('estimaciones basadas en fórmulas poblacionales');
await captura('10-progreso');

// 11. Cuenta y cierre de sesión
await pagina.getByRole('button', { name: 'Cuenta y ajustes' }).click();
await comprobar('persona@example.com');
await captura('11-cuenta');
await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
await comprobar('Controla tu despensa');

// 12. Cuenta creada con Apple o Google sin completar el registro
simulador.estado.registroCompleto = false;
await pagina.goto('http://localhost:8123/iniciar-sesion');
await pagina.getByLabel('Correo electrónico').fill('persona@example.com');
await pagina.getByLabel('Contraseña', { exact: true }).fill('clave-correcta-123');
await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
await comprobar('Antes de continuar necesitamos tu fecha de nacimiento');
await captura('12-completar-registro');

await navegador.close();
servidor.close();

// Solo se admite el error esperado de la contraseña incorrecta (respuesta 400 simulada).
const inesperados = errores.filter((e) => !e.includes('status of 400'));
if (inesperados.length > 0) {
  console.error('Errores inesperados en la página:', inesperados);
  process.exit(1);
}
console.log('OK: recorrido de extremo a extremo completado');
