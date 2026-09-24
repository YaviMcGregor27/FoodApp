# Registro de decisiones

Estado: decisiones tomadas el 24/09/2026 por delegación expresa del propietario del proyecto ("hazlo según conveniencia"). Cada decisión indica el motivo, lo que se descarta y la condición que obligaría a revisarla. Sustituyen a las alternativas abiertas en la versión 0.1 de la especificación.

Resumen:

| Código | Tema | Decisión |
|---|---|---|
| DEC-01 | Aplicación móvil | React Native con Expo, en TypeScript |
| DEC-02 | Backend, base de datos, autenticación y almacenamiento | Supabase en región UE (Fráncfort) |
| DEC-03 | Configuración de autenticación | Correo y contraseña con verificación, Sign in with Apple y Google, rotación de tokens con detección de reutilización, bloqueo de contraseñas filtradas |
| DEC-04 | Lectura de tickets | Modelo multimodal Claude Opus 5 con salida estructurada, verificada por reglas deterministas propias |
| DEC-05 | Datos nutricionales | Etiqueta del envase, Open Food Facts, CIQUAL y USDA FoodData Central; BEDCA excluida hasta obtener autorización |
| DEC-06 | Mercado inicial | España, español, euros; Mercadona, Lidl, Carrefour, Dia y Alcampo |
| DEC-07 | Modo sin conexión | Consulta y registro de consumos sin conexión; lectura de tickets solo con conexión |
| DEC-08 | Organización del código | Monorepositorio con app, Supabase y paquete de dominio compartido |
| DEC-09 | Reglas de producto ya propuestas | Se confirman las cinco decisiones de la versión 0.1 |
| DEC-10 | Calidad | Integración continua obligatoria desde el primer día |

---

## DEC-01 Aplicación móvil: React Native con Expo

- **Decisión.** React Native con Expo (TypeScript), navegación con `expo-router`, base local con `expo-sqlite`, credenciales en `expo-secure-store`, cámara y escáner de documentos nativo, compilación y publicación en tiendas con EAS Build.
- **Motivo.** Una sola base de código para iOS y Android. El núcleo de reglas ya está escrito y probado en TypeScript (`paquetes/dominio/`) y se reutiliza sin reescribirlo. Expo simplifica compilar y publicar sin mantener proyectos nativos a mano, lo que reduce la dependencia de especialistas.
- **Descartado.** Flutter (obligaría a reescribir el dominio en Dart); dos apps nativas (doble coste).
- **Revisar si.** El escáner de documentos o el rendimiento de la cámara no alcanzan la calidad necesaria en dispositivos Android de gama baja.

## DEC-02 Backend: Supabase en la Unión Europea

- **Decisión.** Supabase como plataforma gestionada: PostgreSQL con seguridad a nivel de fila, autenticación, almacenamiento de imágenes con URL firmadas y funciones de servidor (Edge Functions en TypeScript). Proyecto en la región de Fráncfort (UE).
- **Reparto de la lógica.**
  - Operaciones de inventario (confirmar ticket, consumir, cocinar, corregir): funciones de PostgreSQL llamadas por RPC, para que cada operación sea una única transacción. El esquema de `supabase/migrations/` ya está diseñado así.
  - Lectura de tickets, exportación de datos, eliminación de cuenta y notificaciones: Edge Functions.
  - Sustituye al servicio NestJS propuesto en la versión 0.1: un servidor menos que mantener.
- **Adaptación del esquema.** Hecha en la fase F0: las políticas usan `auth.uid()` y se aplican al rol `authenticated`; se retiran los privilegios por defecto peligrosos (ver `04-modelo-de-datos.md`).
- **Plan de servicio.** Plan de pago (Pro o superior) antes del lanzamiento: lo exige la protección de contraseñas filtradas y es necesario para copias con recuperación a un punto en el tiempo (complemento de pago). Para desarrollo basta el plan gratuito.
- **Descartado.** Servidor propio (más mantenimiento y más riesgo de seguridad); Firebase (base de datos no relacional, poco adecuada para el libro de movimientos y sin seguridad a nivel de fila en SQL).
- **Revisar si.** El coste mensual o los límites del plan dejan de ser razonables para el número de usuarios.

## DEC-03 Autenticación

- **Decisión.**
  - Correo y contraseña con verificación obligatoria del correo.
  - Sign in with Apple y Google. Si una app de iOS ofrece inicio de sesión con Google, Apple exige ofrecer también una opción equivalente como Sign in with Apple.
  - Rotación de tokens de refresco con detección de reutilización, activada en Supabase (valor por defecto; no se desactiva).
  - Protección de contraseñas filtradas de Supabase (consulta a HaveIBeenPwned sin enviar la contraseña), disponible desde el plan Pro. Mientras se use el plan gratuito, se aplicará solo la longitud mínima de 12 caracteres.
  - Caducidad del token de acceso: 15 minutos.
  - Segundo factor (TOTP) en fase posterior.
- **Revisar si.** Cambian las condiciones de las tiendas de aplicaciones sobre inicio de sesión.

## DEC-04 Lectura de tickets: modelo multimodal con verificación propia

- **Decisión.** La Edge Function de lectura envía las imágenes del ticket al modelo **Claude Opus 5** (`claude-opus-5`) mediante la API de Mensajes de Anthropic con el SDK oficial de TypeScript, en una sola llamada por ticket, con:
  - salida estructurada (`output_config.format` con esquema JSON) que devuelve cabecera, total y, por cada línea, el texto transcrito literalmente, el tipo de línea, el nombre interpretado, la cantidad, la unidad, el envase, el precio, el importe y el descuento;
  - razonamiento adaptativo (`thinking: {type: "adaptive"}`);
  - respaldo automático en servidor ante rechazos (`fallbacks: "default"`), que se deja activado.
- **Verificación determinista.** La respuesta del modelo nunca se acepta tal cual. El módulo `ticket.ts` recalcula cada línea (peso por precio por kilo, unidades por precio unitario, suma de líneas menos descuentos frente al total) y fija la confianza de cada campo según esas comprobaciones. Una línea que no cuadra baja a confianza baja y requiere acción del usuario. Se mantiene RN-INV-01: nada entra en la despensa sin confirmación.
- **Motivo.** Un modelo multimodal lee directamente tickets arrugados, largos, con poca luz o con abreviaturas, y a la vez propone la interpretación del producto. Así se sustituyen tres componentes (OCR, análisis de líneas y parte de la normalización) por uno, sin perder control, porque la aritmética la verifica el código propio.
- **Privacidad.** Solo se envían las imágenes del ticket, sin nombre, correo ni identificador del usuario. Las condiciones comerciales de Anthropic prohíben entrenar modelos con el contenido de los clientes, y la retención estándar de la API es de 30 días. [PEND] Confirmar si se puede fijar la región de procesamiento en la UE; si no, declararlo en la política de privacidad como transferencia internacional con las garantías correspondientes.
- **Coste.** Se medirá el coste por ticket con el conjunto de evaluación (DEC-06) y se ajustará el nivel de esfuerzo (`effort`) a la calidad mínima exigida (CA-07). Cambiar a un modelo más económico es una decisión de negocio que se tomará con esos datos, no antes.
- **Descartado.** OCR clásico (Google Document AI, Azure Document Intelligence o AWS Textract) más reglas: más piezas y más proveedores, y peor con tickets en mal estado. Queda como alternativa si la evaluación no alcanza los umbrales.
- **Revisar si.** La evaluación con 200 tickets no alcanza el 90 % de nombres correctos y el 98 % de importes correctos, o el coste por ticket no es asumible.

## DEC-05 Fuentes de datos nutricionales

| Prioridad | Fuente | Uso | Licencia y obligaciones |
|---|---|---|---|
| 1 | Etiqueta del envase | Dato introducido o fotografiado por el usuario | Dato del usuario |
| 2 | Open Food Facts | Productos de marca por código de barras | Base de datos bajo ODbL: atribución obligatoria y, si se combina con otra base de datos que se use públicamente, la base resultante debe publicarse también en abierto. Por eso los datos de Open Food Facts se guardan en tablas separadas, sin mezclarlos con el catálogo propio, y se muestra la atribución en la app. |
| 3 | CIQUAL (ANSES, Francia) | Alimentos genéricos | Licencia Abierta de Etalab: reutilización libre, incluso comercial, citando la fuente y la fecha de actualización. Los nombres están en francés: se mantendrá una tabla de traducción al español. |
| 4 | USDA FoodData Central | Respaldo para genéricos que falten en CIQUAL | Dominio público (CC0); el USDA pide citarlo como fuente. |
| — | BEDCA (AESAN, España) | Excluida en la versión 1 | Sus condiciones de uso no permiten la reutilización libre y no se han podido revisar desde este entorno. Se incorporará solo si AESAN lo autoriza por escrito. |

- **Motivo.** Todas las fuentes elegidas permiten el uso en una aplicación, incluida la comercial. CIQUAL, por ser europea, se ajusta mejor a la alimentación española que USDA.
- **Revisar si.** AESAN autoriza el uso de BEDCA (pasaría a prioridad 3).

## DEC-06 Mercado inicial y conjunto de evaluación

- **Decisión.** Primera versión para España: interfaz en español, euros, fechas en formato dd/mm/aaaa, zona horaria de Madrid por defecto. Cadenas prioritarias para la lectura de tickets: Mercadona, Lidl, Carrefour, Dia y Alcampo.
- **Conjunto de evaluación.** 200 tickets reales (40 por cadena), con variedad de estados: arrugados, largos, con poca luz, con productos a peso y con descuentos. Se anonimizan (se tapan los datos de tarjeta) y se transcriben a mano para tener la respuesta correcta. Con él se mide CA-07 y se ajustan los umbrales de confianza.
- **Motivo.** Un mercado y un idioma permiten afinar la lectura antes de ampliar.
- **Revisar si.** Se decide lanzar en otro país (requiere su propio conjunto de tickets).

## DEC-07 Modo sin conexión

- **Decisión.** Sin conexión se puede consultar la despensa, registrar consumos, desperdicios y peso; las operaciones se guardan en cola con clave de idempotencia y se envían al recuperar la conexión. La lectura de tickets requiere conexión: las fotos se guardan y se procesan después.
- **Motivo.** Cubre el uso habitual en la cocina sin la complejidad de ejecutar la lectura de tickets en el teléfono.

## DEC-08 Organización del código

- **Decisión.** Monorepositorio con espacios de trabajo de npm:

```
apps/movil/          App Expo
supabase/            Migraciones SQL, funciones de PostgreSQL, Edge Functions, pruebas de aislamiento
paquetes/dominio/    Reglas de negocio compartidas (antes prototipo/)
docs/                Especificación y decisiones
```

- Hecho en la fase F0: el prototipo está en `paquetes/dominio` con sus pruebas.

## DEC-09 Reglas de producto confirmadas

Se confirman las decisiones propuestas en la versión 0.1:

1. Las fracciones se calculan por defecto sobre el envase completo; "de lo que queda" es una opción explícita, y la cantidad resultante se muestra antes de confirmar.
2. Un resto inferior al 2 % del envase genera una pregunta al usuario, nunca un borrado automático.
3. Sin dato de sexo se usa una constante intermedia y un margen de incertidumbre del 15 %.
4. Situaciones sanitarias relevantes o IMC inferior a 18,5 con objetivo de pérdida: solo estimación de mantenimiento y recomendación de consultar con un profesional sanitario.
5. Edad mínima de 18 años.

## DEC-10 Integración continua

- **Decisión.** Cada envío al repositorio ejecuta en GitHub Actions (`.github/workflows/pruebas.yml`): comprobación de tipos y pruebas del dominio, y pruebas del esquema SQL sobre PostgreSQL 16. Un cambio que rompa las pruebas no debe integrarse.

---

## Acciones que requieren al propietario

Estas tareas no se pueden hacer desde el código y bloquean el lanzamiento, no el desarrollo:

| Acción | Cuándo | Motivo |
|---|---|---|
| Crear cuenta de Supabase y proyecto en región UE | Inicio de F0 | DEC-02 |
| Crear cuenta en la plataforma de Anthropic y una clave de API | Inicio de F3 | DEC-04 |
| Reunir los 200 tickets del conjunto de evaluación | Durante F1–F2 | DEC-06 |
| Cuentas de desarrollador de Apple y Google | Antes de las pruebas con usuarios | Publicación y Sign in with Apple |
| Revisión legal: política de privacidad, consentimiento de datos de salud, evaluación de impacto (RGPD art. 35) | Antes del lanzamiento | Datos de salud: categoría especial |
| Contratar el plan de pago de Supabase | Antes del lanzamiento | DEC-02, DEC-03 |
| Solicitar a AESAN autorización para BEDCA (opcional) | Cuando se quiera | DEC-05 |

## Fuentes consultadas

- Licencia de Open Food Facts: https://world.openfoodfacts.org/terms-of-use y https://world.openfoodfacts.org/data
- Licencia de CIQUAL: https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020
- Licencia de USDA FoodData Central: https://data.nal.usda.gov/dataset/fooddata-central-0
- Reutilización de BEDCA: https://datos.gob.es/en/solicitud-de-datos/base-de-datos-bedca
- Supabase, contraseñas filtradas: https://supabase.com/docs/guides/auth/password-security
- Supabase, sesiones y rotación de tokens: https://supabase.com/docs/guides/auth/sessions
- Anthropic, retención de datos de la API: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
