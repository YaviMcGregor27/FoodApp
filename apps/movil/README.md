# App móvil de FoodApp

React Native con Expo (SDK 57) y Expo Router. Estado: fase F0 (cuentas y navegación). Las secciones Hoy, Despensa, Escanear, Recetas y Progreso son marcadores que indican en qué fase se construirán.

## Qué funciona

- Registro con correo, contraseña de al menos 12 caracteres, fecha de nacimiento (18 años como mínimo), aceptación de términos y consentimiento opcional para datos de salud.
- Verificación del correo con reenvío del enlace (espera de 60 segundos).
- Inicio y cierre de sesión, también en todos los dispositivos.
- Recuperación de contraseña por enlace; al cambiarla se cierran las demás sesiones.
- Pantalla para completar el registro (cuentas de Apple o Google).
- Sesión guardada cifrada en el teléfono (clave en Keychain o Keystore).
- Navegación protegida: sin sesión solo se ven las pantallas públicas.

Pendiente en esta fase: los botones de Apple y Google (requieren las cuentas de desarrollador y la configuración de los proveedores en Supabase).

## Arrancar en desarrollo

Desde la raíz del repositorio:

```bash
npm install
cp apps/movil/.env.example apps/movil/.env   # y rellenar la URL y la clave pública de Supabase
cd apps/movil
npx expo start
```

Se abre con la app Expo Go en el teléfono (escaneando el código QR) o en un emulador. Si Expo Go no incluyera algún módulo nativo, hay que usar una compilación de desarrollo (`npx eas-cli@latest build --profile development`). Sin el archivo `.env`, la app muestra un aviso de configuración pendiente.

## Comprobaciones

```bash
npm run typecheck          # tipos
npm test                   # lógica de formularios, errores, navegación y versiones legales
npm run verificar:android  # empaqueta la app para Android
npm run e2e                # recorrido completo en navegador con Supabase simulado
```

`npm run e2e` necesita Chromium de Playwright (`npx playwright install chromium`) o la variable `CHROMIUM_PATH`.

## Estructura

```
src/app/          Pantallas (cada archivo es una ruta de Expo Router)
  (publico)/      Bienvenida, iniciar sesión, registro, recuperar, verificar correo
  (app)/          Zona con sesión: pestañas y cuenta
src/logica/       Validaciones y reglas puras, con pruebas en test/
src/lib/          Cliente de Supabase, almacenamiento cifrado de la sesión, enlaces
src/sesion/       Estado de la sesión y de la cuenta
src/ui/           Componentes y tema visual
e2e/              Prueba de extremo a extremo
```
