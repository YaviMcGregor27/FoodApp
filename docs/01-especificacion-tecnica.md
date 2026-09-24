# Especificación técnica de FoodApp

Versión del documento: 0.2 (diseño con decisiones de plataforma cerradas; ver `09-decisiones.md`)
Estado: Diseño propuesto, con la fase F0 (fundamentos) en construcción: ver el estado de cada elemento en `README.md`. Las reglas marcadas [PROTO] están en el paquete de dominio `paquetes/dominio/`.

Leyenda de estado usada en todo el documento:

| Etiqueta | Significado |
|---|---|
| [REQ] | Requisito funcional: lo que el sistema debe hacer. |
| [DIS] | Diseño propuesto: cómo se propone resolverlo. No existe código de producción. |
| [PROTO] | Prototipo: existe código de validación en `paquetes/dominio/` con pruebas, todavía no integrado en las pantallas de la app. |
| [IMPL] | Funcionalidad implementada. Actualmente ninguna. |
| [PEND] | Limitación pendiente o decisión abierta. |

---

## 1. Resumen del producto

FoodApp es una aplicación móvil multiplataforma (iOS y Android) con cuenta de usuario que:

1. Lee tickets de compra fotografiados, propone una interpretación línea a línea con nivel de confianza y exige revisión y confirmación del usuario antes de crear existencias.
2. Mantiene un inventario por lotes, con cantidades en unidades base (gramos, mililitros, unidades), fechas de compra y caducidad o consumo preferente, ubicación y estado.
3. Registra cada entrada y salida como un movimiento inmutable (libro de movimientos), incluidos consumos parciales, desperdicios, correcciones y combinaciones de lotes.
4. Sugiere recetas priorizando productos próximos a caducar, productos abiertos y cobertura de la despensa, y separa ingredientes disponibles, parciales, que faltan y opcionales.
5. Calcula kilocalorías y macronutrientes de alimentos y recetas a partir de fuentes de datos identificadas.
6. Estima metabolismo basal, gasto energético diario y un rango calórico objetivo, mostrando método, factores y margen de incertidumbre.
7. Registra peso y otros indicadores corporales y muestra tendencias.

Principios de producto:

- Nada entra en la despensa sin confirmación del usuario.
- Ningún dato se inventa: lo que no se conoce queda "Pendiente de confirmación".
- Toda modificación de inventario es trazable y reversible mediante un movimiento compensatorio, nunca mediante borrado.
- Las estimaciones se presentan como estimaciones, con su método y su margen.

Fuera del alcance de la versión 1 [PEND]: despensas compartidas entre varios usuarios (hogar), compra en línea, integración con básculas o relojes, planificación semanal automática de menús completos.

---

## 2. Usuarios y permisos

### 2.1 Tipos de actor

| Actor | Descripción | Acceso a datos personales |
|---|---|---|
| Usuario final | Persona titular de la cuenta. | Solo a sus propios datos. Lectura, escritura, exportación y eliminación. |
| Usuario no verificado | Cuenta registrada sin correo verificado. | Puede completar el cuestionario y usar la despensa en modo local; no puede exportar datos ni recuperar la cuenta hasta verificar. [DIS] |
| Operador de soporte | Personal técnico. | Ninguno por defecto. Acceso a metadatos técnicos (errores, métricas agregadas). Acceso a datos de un usuario solo con consentimiento explícito y temporal del usuario, registrado en auditoría. [DIS] |
| Servicios internos | Trabajadores de OCR, notificaciones y copias de seguridad. | Cuenta de servicio con permisos mínimos; cada operación se ejecuta en nombre de un `user_id` concreto y queda registrada. [DIS] |

### 2.2 Reglas de aislamiento [REQ]

- Todas las tablas con datos de usuario contienen `user_id` y tienen políticas de seguridad a nivel de fila (RLS) que restringen lectura y escritura a `user_id = usuario autenticado`.
- Las imágenes de tickets se almacenan bajo una ruta con prefijo `user_id` y se sirven solo mediante URL firmadas de corta duración (5 minutos) emitidas tras comprobar la propiedad.
- Ningún endpoint acepta `user_id` como parámetro de entrada: se deriva siempre del token de sesión.
- Los catálogos compartidos (alimentos genéricos, datos nutricionales de referencia, recetas curadas) son de solo lectura para usuarios. Los alias y productos personalizados creados por un usuario son privados.

### 2.3 Edad mínima [DIS]

- Edad mínima de registro: 18 años. Motivo: la aplicación produce objetivos calóricos y no está diseñada para población en crecimiento.
- Si la fecha de nacimiento indica menos de 18 años, se bloquea el registro con un mensaje neutro.

---

## 3. Módulos funcionales

| Código | Módulo | Responsabilidad | Estado |
|---|---|---|---|
| M1 | Cuentas y autenticación | Registro, inicio y cierre de sesión, verificación de correo, recuperación de contraseña, sesiones, eliminación de cuenta, exportación. | [DIS] |
| M2 | Perfil corporal | Cuestionario inicial, restricciones, alergias, preferencias, objetivos, avisos de condiciones que requieren profesional sanitario. | [DIS] |
| M3 | Captura y lectura de tickets | Captura, preprocesado, OCR, análisis de líneas, reconciliación con el total, detección de duplicados. | [DIS], analizador de líneas [PROTO] |
| M4 | Normalización de productos | Traducción de texto de ticket a producto normalizado, alias por usuario y por cadena, detección de artículos no alimentarios. | [DIS] |
| M5 | Despensa e inventario | Productos, lotes, ubicaciones, estados, cantidades, consumos parciales, libro de movimientos. | [DIS], reglas [PROTO] |
| M6 | Nutrición | Datos nutricionales por producto, cálculo por receta y por ración, diario de ingesta, validaciones de coherencia. | [DIS], validaciones [PROTO] |
| M7 | Motor energético | Metabolismo basal, gasto diario, objetivo calórico, macronutrientes, recalibración con datos reales. | [DIS], cálculo [PROTO] |
| M8 | Recetas y recomendaciones | Filtrado por seguridad (alergias), puntuación, clasificación de ingredientes, sustituciones, registro de cocinado y sobras. | [DIS], clasificación [PROTO] |
| M9 | Lista de compra | Ingredientes que faltan, reposición de productos agotados, entrada rápida. | [DIS] |
| M10 | Seguimiento corporal | Registro de peso y medidas, tendencia suavizada, gráficos, comparación con objetivo. | [DIS] |
| M11 | Notificaciones | Caducidades, recordatorios de registro, resultados de procesamiento de tickets. | [DIS] |
| M12 | Privacidad y auditoría | Consentimientos, auditoría de accesos, exportación, eliminación, retención. | [DIS] |

La especificación detallada de cada funcionalidad está en `docs/02-requisitos-funcionales.md` y el diseño de pantallas en `docs/03-pantallas.md`.

---

## 4. Modelo de datos

Resumen. El detalle de campos, restricciones y políticas está en `docs/04-modelo-de-datos.md` y el esquema SQL en `supabase/migrations/`.

### 4.1 Entidades principales

| Entidad | Propósito | Relaciones clave |
|---|---|---|
| `app_user` | Cuenta. Identidad gestionada por el servicio de autenticación. | 1:1 `body_profile` |
| `body_profile` | Datos del cuestionario: fecha de nacimiento, sexo opcional, altura, actividad, entrenamiento, objetivos, comidas por día. | pertenece a `app_user` |
| `dietary_restriction` | Alergias, intolerancias, dietas, alimentos rechazados, con severidad. | N:1 `app_user` |
| `energy_estimate` | Instantánea de cada cálculo energético con entradas, método, resultados y rango. | N:1 `app_user` |
| `body_measurement` | Peso, perímetro de cintura, porcentaje graso, etc., con fecha y origen. | N:1 `app_user` |
| `receipt` | Ticket: tienda, fecha, total, moneda, imágenes, estado de procesamiento, huella para duplicados. | N:1 `app_user`, 1:N `receipt_line` |
| `receipt_line` | Línea detectada: texto original, interpretación, cantidad, unidad, precio, descuento, confianza por campo, decisión del usuario. | N:1 `receipt`, 0..1 `pantry_lot` |
| `food` | Alimento del catálogo (genérico o de marca) con su fuente de datos nutricionales. | 1:N `food_nutrient` |
| `user_product` | Producto tal como lo conoce el usuario (nombre, categoría, tamaño de envase, porción configurada) vinculado opcionalmente a `food`. | N:1 `app_user`, N:1 `food` |
| `product_alias` | Texto de ticket normalizado a `user_product` por usuario y cadena. | N:1 `user_product` |
| `pantry_lot` | Lote: cantidad inicial y disponible en unidad base, tamaño de envase, fechas, ubicación, estado, abierto o no. | N:1 `user_product`, 0..1 `receipt_line` |
| `inventory_movement` | Movimiento inmutable: tipo, delta, cantidad antes y después, origen, motivo, movimiento revertido. | N:1 `pantry_lot` |
| `consumption_event` | Evento de consumo (individual, cocinado, desperdicio) que agrupa movimientos. | 1:N `inventory_movement` |
| `recipe` y `recipe_ingredient` | Recetas curadas o generadas y sus ingredientes estructurados. | N:1 `food` o `user_product` |
| `cooking_log` | Registro de cocinado: receta, raciones producidas, comensales, raciones consumidas por el usuario, sobras. | 1:1 `consumption_event` |
| `intake_entry` | Entrada del diario nutricional del usuario (lo que él come, no lo que come el hogar). | N:1 `app_user` |
| `shopping_list_item` | Artículo pendiente de compra. | N:1 `app_user` |
| `notification` | Notificaciones programadas y enviadas. | N:1 `app_user` |
| `consent` | Consentimientos otorgados y revocados con versión del texto. | N:1 `app_user` |
| `audit_log` | Accesos y acciones sensibles (exportación, eliminación, acceso de soporte). | N:1 `app_user` |

### 4.2 Representación de cantidades [DIS] [PROTO]

- Unidad base por dimensión: masa en gramos (`g`), volumen en mililitros (`ml`), recuento en unidades (`ud`).
- Las cantidades se almacenan como `NUMERIC(12,3)` en base de datos y como enteros en milésimas en la lógica de dominio para evitar errores de coma flotante.
- Conversión entre dimensiones (por ejemplo, unidades a gramos, mililitros a gramos) solo si existe un dato confirmado: peso por unidad o densidad. Sin ese dato, la conversión no se realiza y se solicita al usuario.
- Un lote distingue: número de envases comprados, tamaño de envase, cantidad inicial total, cantidad disponible, cantidad consumida acumulada, cantidad desperdiciada acumulada. Las porciones estimadas son un dato derivado (cantidad disponible dividida por tamaño de porción configurado), nunca almacenado como existencia.

---

## 5. Flujos principales

### 5.1 Ticket a despensa [DIS]

1. El usuario pulsa "Escanear ticket". La cámara detecta bordes y avisa si hay poca luz, desenfoque o el ticket no cabe completo.
2. Para tickets largos, el usuario toma varias fotografías solapadas; la aplicación las ordena y elimina líneas duplicadas del solapamiento.
3. Las imágenes se suben cifradas en tránsito. El ticket queda en estado `procesando`.
4. La función de lectura envía las imágenes al modelo multimodal, que devuelve por esquema JSON la cabecera (tienda, fecha, hora), las líneas transcritas literalmente con su interpretación, los descuentos y el total. El módulo de dominio verifica la aritmética de cada línea y fija la confianza (DEC-04).
5. El normalizador propone producto, categoría, cantidad, unidad y confianza por campo. Detecta artículos no alimentarios.
6. La reconciliación compara la suma de líneas menos descuentos con el total impreso y muestra el resultado.
7. El usuario revisa en la pantalla de revisión: acepta, corrige, divide, combina o descarta líneas; completa fechas de caducidad y ubicaciones. Los campos de baja confianza exigen acción explícita.
8. Al confirmar, en una única transacción se crean los lotes y un movimiento `entrada_compra` por lote. Las correcciones del usuario se guardan como alias para futuros tickets de esa cadena.

### 5.2 Consumo parcial [DIS] [PROTO]

1. El usuario abre un producto y pulsa "Consumir".
2. Elige la forma de indicar la cantidad: fracción (1/4, 1/2, 3/4, otra), cantidad exacta, número de porciones o "todo".
3. Si elige fracción, indica la referencia: "del envase" (por defecto) o "de lo que queda". La aplicación muestra la cantidad resultante en unidad base antes de confirmar.
4. Si hay varios lotes, propone el orden: primero lotes abiertos, después caducidad más próxima (FEFO). El usuario puede cambiarlo.
5. Indica quién lo consume: el usuario (cuenta en su diario), otras personas (no cuenta) o reparto.
6. Al confirmar, se crean movimientos `consumo_parcial` o `consumo_total`. El lote pasa a `agotado` solo si la cantidad disponible llega exactamente a cero.

### 5.3 Receta sugerida a cocinado [DIS]

1. El motor filtra recetas incompatibles con alergias, intolerancias y restricciones (filtro estricto).
2. Puntúa las restantes por caducidad próxima, productos abiertos, cobertura, ajuste a los objetivos restantes del día, preferencias, tiempo y dificultad.
3. Muestra cada receta con ingredientes clasificados: disponibles, parcialmente disponibles (con faltante), que faltan (a comprar), opcionales o sustituibles.
4. El usuario puede añadir los faltantes a la lista de compra.
5. Al pulsar "He cocinado esto", la aplicación propone los lotes a descontar y las cantidades; el usuario ajusta cantidades reales, raciones producidas, comensales y raciones que come él.
6. Se registran los movimientos, el `cooking_log`, la entrada en el diario del usuario y, si quedan raciones, un lote de sobras en la despensa con caducidad pendiente de confirmar.

### 5.4 Perfil energético [DIS] [PROTO]

1. Cuestionario inicial (ver RF-02).
2. Cálculo con la fórmula de Mifflin-St Jeor (o Katch-McArdle si el usuario aporta porcentaje graso medido), factor de actividad, ajuste por objetivo.
3. Presentación con método, valores, rango y advertencias.
4. Tras al menos 21 días con registros de peso e ingesta suficientes, se ofrece una recalibración basada en datos observados, siempre como propuesta que el usuario acepta o rechaza.

### 5.5 Seguimiento de peso [DIS]

1. Registro manual de peso con fecha y hora, y opcionalmente otros indicadores.
2. Cálculo de una tendencia suavizada (media móvil exponencial) para reducir el efecto de fluctuaciones diarias de agua y contenido intestinal.
3. Gráfico con peso diario, tendencia y ritmo semanal; comparación con el ritmo esperado para el objetivo.

---

## 6. Reglas de negocio

Reglas numeradas y verificables. Las marcadas [PROTO] tienen prueba automatizada en `paquetes/dominio/test/`.

### 6.1 Inventario

| Código | Regla | Estado |
|---|---|---|
| RN-INV-01 | Ningún lote se crea a partir de un ticket sin confirmación explícita del usuario en la pantalla de revisión. | [DIS] |
| RN-INV-02 | La cantidad disponible de un lote es igual a la cantidad inicial más la suma de deltas de sus movimientos. Se comprueba en cada transacción. | [DIS] |
| RN-INV-03 | Ninguna cantidad puede ser negativa. Un consumo mayor que la cantidad disponible del lote se rechaza con error `CONSUMO_SUPERA_DISPONIBLE`. | [PROTO] |
| RN-INV-04 | Consumo por fracción: `cantidad = fracción x referencia`, donde referencia es el tamaño de envase (por defecto) o la cantidad disponible (si el usuario elige "de lo que queda"). | [PROTO] |
| RN-INV-05 | Un lote cambia a `agotado` únicamente cuando su cantidad disponible es exactamente cero. | [PROTO] |
| RN-INV-06 | Si tras un consumo queda un residuo inferior al 2 % del tamaño de envase, se pregunta al usuario si desea marcarlo como agotado (movimiento `ajuste` con motivo `residuo`). No se hace automáticamente. | [PROTO] |
| RN-INV-07 | Consumir una porción descuenta el tamaño de porción configurado por el usuario para ese producto. Si no hay porción configurada, se pide la cantidad; no se usa una ración estándar silenciosa. | [PROTO] |
| RN-INV-08 | Los movimientos son inmutables. Una corrección genera un movimiento `correccion` que referencia al movimiento corregido. | [DIS] |
| RN-INV-09 | Dos compras del mismo producto crean lotes distintos. Solo se combinan a petición del usuario y solo si tienen la misma unidad base; la combinación genera un movimiento `transferencia_salida` y otro `transferencia_entrada` y conserva la caducidad más próxima. | [DIS] |
| RN-INV-10 | Orden de asignación por defecto entre lotes: primero lotes abiertos, después caducidad más próxima, después fecha de compra más antigua. Lotes sin fecha de caducidad van al final. | [PROTO] |
| RN-INV-11 | Estados de un lote: `disponible`, `abierto`, `proximo_a_caducar` (fecha dentro del umbral configurable, 3 días por defecto), `caducado` (fecha pasada), `agotado`, `descartado`. `caducado` y `proximo_a_caducar` son estados derivados de la fecha, no bloquean el consumo; solo muestran advertencia. | [PROTO] |
| RN-INV-12 | Fechas válidas: la fecha de compra no puede ser futura ni anterior a 2 años; la caducidad no puede ser anterior a la fecha de compra salvo confirmación explícita (producto comprado ya caducado o en oferta de fecha corta). | [PROTO] |
| RN-INV-13 | Un producto debe tener nombre no vacío tras recortar espacios. | [PROTO] |
| RN-INV-14 | La aplicación no afirma que un alimento es seguro o inseguro. Para `caducado` muestra: "La fecha indicada ha pasado. Revisa el producto antes de consumirlo." Distingue "Caducidad" de "Consumo preferente". | [DIS] |

### 6.2 Tickets

| Código | Regla | Estado |
|---|---|---|
| RN-TIC-01 | Cada línea conserva texto original, nombre normalizado propuesto, cantidad, unidad, precio unitario, importe, descuento aplicado, fecha de compra del ticket y confianza por campo. | [DIS] |
| RN-TIC-02 | Umbrales de confianza: alta >= 0,90 (prerrellenado), media 0,70–0,89 (resaltado para revisión), baja < 0,70 (requiere acción explícita: aceptar, corregir o descartar). | [DIS] |
| RN-TIC-03 | Las líneas de descuento (importe negativo, "DTO", "PROMO", "2ª UD") se asocian a la línea de producto precedente o a la que el texto referencia. Si la asociación es ambigua, se marca para revisión. | [PROTO] |
| RN-TIC-04 | Productos por peso: se extrae peso, precio por kilo e importe. Si `peso x precio_kg` difiere del importe en más de 0,02 unidades monetarias, la línea se marca como incoherente. | [PROTO] |
| RN-TIC-05 | Multiplicadores ("2 x 1,25"): la cantidad es el número de unidades; el tamaño del envase queda pendiente si no aparece. | [PROTO] |
| RN-TIC-06 | Reconciliación: si la suma de importes menos descuentos difiere del total impreso, se muestra la diferencia y se indica que puede haber líneas no leídas. | [DIS] |
| RN-TIC-07 | Duplicados: huella = tienda + fecha + hora + total. Si coincide con un ticket existente, se avisa antes de procesar. | [DIS] |
| RN-TIC-08 | Artículos no alimentarios (bolsas, droguería) se proponen como "No añadir a la despensa", editable. | [DIS] |
| RN-TIC-09 | La caducidad nunca se deduce del ticket. Queda "Pendiente" salvo que el usuario la introduzca o la lea del envase con la cámara. | [DIS] |
| RN-TIC-10 | Formatos de fecha: se interpreta según la configuración regional de la tienda detectada o del usuario; si es ambigua (por ejemplo 03/04/26), se muestra la interpretación y se pide confirmación. | [DIS] |

### 6.3 Nutrición y energía

| Código | Regla | Estado |
|---|---|---|
| RN-NUT-01 | Cada valor nutricional guarda su fuente (base de datos y registro, etiqueta del envase escaneada, introducido por usuario) y su base (por 100 g, por 100 ml, por unidad). | [DIS] |
| RN-NUT-02 | Coherencia por 100 g: proteínas + carbohidratos + grasas + fibra + agua <= 100 g con tolerancia de 2 g. Cualquier macronutriente negativo es inválido. | [PROTO] |
| RN-NUT-03 | Coherencia energética: `4 x proteínas + 4 x carbohidratos + 9 x grasas + 2 x fibra + 7 x alcohol` debe estar dentro de +-15 % de las kcal declaradas (o +-10 kcal para valores bajos). Si no, se marca para revisión. | [PROTO] |
| RN-NUT-04 | Si un producto no tiene datos nutricionales fiables, sus kcal se muestran como "Sin datos" y las recetas que lo usan indican "Cálculo incompleto" con el porcentaje de peso cubierto. | [DIS] |
| RN-NUT-05 | Objetivo calórico nunca inferior al metabolismo basal estimado. Si el ajuste solicitado lo llevaría por debajo, se limita y se explica. | [PROTO] |
| RN-NUT-06 | Si el usuario declara embarazo, lactancia, enfermedad relevante, medicación que afecte al peso o al apetito, o antecedentes de trastorno alimentario, no se calcula déficit ni superávit: se muestra una estimación de mantenimiento como referencia y la recomendación de consultar con un profesional sanitario. | [PROTO] |
| RN-NUT-07 | Recetas: una receta con un alérgeno declarado por el usuario nunca se sugiere. Las intolerancias también son filtro estricto salvo que el usuario marque tolerancia a trazas. | [PROTO] |

### 6.4 Consumo y diario

| Código | Regla | Estado |
|---|---|---|
| RN-CON-01 | Un consumo registra quién lo consume: usuario, otras personas o reparto. Solo la parte del usuario entra en su diario nutricional. | [DIS] |
| RN-CON-02 | Una receta cocinada registra raciones producidas y raciones consumidas por el usuario. Las raciones no consumidas pueden guardarse como lote de sobras con nutrientes por ración. | [DIS] |
| RN-CON-03 | Raciones incompatibles: si las raciones declaradas implican una porción por ración inferior a 1 g o el total de ingredientes asignados es cero, se rechaza. | [DIS] |
| RN-CON-04 | El desperdicio se registra como movimiento `desperdicio`, no cuenta en el diario y alimenta un informe de desperdicio. | [DIS] |

---

## 7. Arquitectura técnica

### 7.1 Vista general [DIS]

Decisiones de plataforma en `09-decisiones.md` (DEC-01 a DEC-08).

```
+---------------------------+          HTTPS (TLS)           +-----------------------------------------+
| App móvil                 | -----------------------------> | Supabase (región UE, Fráncfort)         |
| React Native + Expo (TS)  |                                |                                         |
| SQLite local + cola       | <----------------------------- |  Auth: correo, Apple, Google, JWT       |
| Paquete de dominio (TS)   |                                |  PostgreSQL + RLS + funciones RPC       |
+---------------------------+                                |    (inventario, cocinado, diario)       |
            |                                                |  Storage: imágenes de tickets cifradas  |
            | Subida con URL firmada                         |  Edge Functions (TypeScript):           |
            +----------------------------------------------> |    lectura de tickets, exportación,     |
                                                             |    eliminación, notificaciones          |
                                                             +------+-----------------+----------------+
                                                                    |                 |
                                                     imágenes sin   |                 | avisos sin datos
                                                     identificadores|                 | de salud
                                                                    v                 v
                                                  +-----------------------+   +--------------------+
                                                  | API de Anthropic      |   | Expo Push          |
                                                  | Claude Opus 5         |   | (FCM / APNs)       |
                                                  | salida estructurada   |   +--------------------+
                                                  +-----------------------+
                                                  +-----------------------+
                                                  | Open Food Facts API   |  (por código de barras)
                                                  +-----------------------+
```

### 7.2 Componentes

| Componente | Decisión | Justificación |
|---|---|---|
| Frontend móvil | React Native con Expo (TypeScript), `expo-router`, `expo-camera` con escáner de documentos nativo (ML Kit Document Scanner en Android, VisionKit en iOS), `expo-sqlite` para modo sin conexión, `expo-secure-store` para credenciales, EAS Build para publicar. | Una base de código; reutiliza el dominio TypeScript ya probado (DEC-01). |
| Backend | Supabase: funciones de PostgreSQL llamadas por RPC para toda operación de inventario (una transacción por operación) y Edge Functions en TypeScript para lectura de tickets, exportación, eliminación de cuenta y notificaciones. | Sin servidor propio que mantener; la lógica crítica vive junto a los datos (DEC-02). |
| Base de datos | PostgreSQL gestionado por Supabase, con RLS para el rol `authenticated`, privilegios mínimos (sin acceso anónimo ni vaciado de tablas), `pg_trgm` para búsqueda aproximada de productos y restricciones `CHECK` para cantidades. | Integridad transaccional del libro de movimientos; aislamiento por usuario comprobado en `supabase/pruebas/`. |
| Autenticación | Supabase Auth: correo y contraseña con verificación, Sign in with Apple y Google, rotación de tokens con detección de reutilización, bloqueo de contraseñas filtradas (plan Pro). | Sin criptografía de contraseñas propia (DEC-03). |
| Lectura de tickets | Edge Function que envía las imágenes a Claude Opus 5 (`claude-opus-5`) con salida estructurada por esquema JSON; el módulo de dominio `ticket.ts` verifica la aritmética de cada línea y la reconciliación con el total, y asigna la confianza. | Un único componente lee y propone; el código propio verifica (DEC-04). |
| Normalización | Alias aprendidos por usuario y cadena, diccionario de abreviaturas por cadena, búsqueda por trigramas sobre el catálogo; la interpretación del modelo es una propuesta más. | Ver `06-ocr-y-normalizacion.md`. |
| Datos nutricionales | Etiqueta del envase > Open Food Facts (código de barras) > CIQUAL > USDA FoodData Central. BEDCA excluida hasta autorización. | Licencias compatibles con uso comercial (DEC-05). |
| Motor de recetas | Catálogo curado con ingredientes estructurados; adaptación asistida por modelo en fase posterior, con validación determinista de alérgenos y nutrientes calculados por el sistema. | Ver `07-motor-de-recetas.md`. |
| Notificaciones | Tareas programadas de Supabase (`pg_cron`) que invocan una Edge Function; envío con Expo Push (FCM y APNs). | Resumen diario de caducidades a la hora del usuario. |
| Procesamiento asíncrono | Tabla de trabajos en PostgreSQL con reintentos, consumida por Edge Functions. | Sin infraestructura de colas adicional. |
| Observabilidad | Registros estructurados sin datos personales; métricas de lectura de tickets (tasa de corrección por campo, coste por ticket). | Mejora medible. |
| Integración continua | GitHub Actions: tipos y pruebas del dominio, pruebas del esquema SQL (DEC-10). | Evita integrar cambios que rompan reglas. |

### 7.3 Modo sin conexión [DIS]

- La despensa se replica en SQLite local. Las operaciones se encolan como comandos con clave de idempotencia (UUID generado en el dispositivo).
- Al sincronizar, el servidor aplica los comandos en orden. Si un consumo supera la cantidad disponible por un cambio concurrente, el comando se rechaza y el usuario resuelve el conflicto; nunca se deja una cantidad negativa.
- La lectura de tickets requiere conexión en la versión 1 (DEC-07); las fotos se guardan y se procesan al recuperar conexión.

### 7.4 Protección de datos y copias de seguridad [DIS]

- Copias diarias gestionadas por Supabase y recuperación a un punto en el tiempo (complemento de pago, obligatorio antes del lanzamiento), con retención configurada según la oferta del plan contratado [PEND: fijar la retención exacta al contratar].
- Prueba de restauración trimestral documentada.
- Las eliminaciones de cuenta se propagan a las copias por caducidad natural de su retención; se informa al usuario de ese plazo.

---

## 8. Seguridad y privacidad

### 8.1 Autenticación y sesiones [DIS]

| Aspecto | Diseño |
|---|---|
| Registro | Correo y contraseña (mínimo 12 caracteres; comprobación contra contraseñas filtradas con la protección de Supabase desde el plan Pro), Sign in with Apple o Google. Aceptación de términos y consentimiento específico para datos de salud. |
| Verificación de correo | Enlace de un solo uso con caducidad de 24 horas. |
| Inicio de sesión | Limitación de intentos por cuenta y por IP con retardo progresivo. Mensajes de error que no revelan si el correo existe. |
| Tokens | Token de acceso de 15 minutos; token de refresco rotatorio con detección de reutilización de Supabase Auth (si se reutiliza uno antiguo, se revoca toda la sesión). |
| Almacenamiento en dispositivo | Tokens en Keychain (iOS) y Keystore (Android) mediante `expo-secure-store`. Desbloqueo biométrico opcional. |
| Cierre de sesión | Revoca el token de refresco en servidor y borra la caché local de datos sensibles. Opción "Cerrar sesión en todos los dispositivos". |
| Recuperación de contraseña | Enlace de un solo uso, caducidad de 30 minutos, invalida sesiones abiertas tras el cambio. |
| Segundo factor | TOTP opcional [PEND para fase posterior]. |
| Eliminación de cuenta | Requiere reautenticación. Desactivación inmediata, borrado definitivo en 7 días (periodo de arrepentimiento), purga en copias de seguridad al caducar su retención. |
| Exportación | Archivo ZIP con JSON y CSV de todas las entidades del usuario y las imágenes de sus tickets. Generado de forma asíncrona, enlace de descarga firmado de 24 horas, notificación al completarse, registro en auditoría. |

### 8.2 Privacidad [DIS]

- Los datos de peso, medidas, condiciones médicas y alergias son datos relativos a la salud (categoría especial en el RGPD, art. 9). Base jurídica: consentimiento explícito, separado y revocable.
- Evaluación de impacto de protección de datos antes del lanzamiento [PEND].
- Residencia de datos en la Unión Europea (proyecto de Supabase en Fráncfort). Las imágenes de tickets enviadas a la API de Anthropic no llevan identificadores del usuario; si su procesamiento no puede fijarse en la UE, se declarará como transferencia internacional en la política de privacidad [PEND, DEC-04].
- Minimización: el sexo es opcional; la fecha de nacimiento se usa solo para calcular la edad.
- Las imágenes de tickets pueden contener datos de tarjeta parciales y datos de la tienda. Opción de borrar la imagen tras la confirmación manteniendo los datos estructurados. Retención por defecto de las imágenes: 90 días, configurable.
- Envío a proveedores externos (OCR, modelos de lenguaje): solo la imagen del ticket o el texto de la línea, sin identificadores del usuario; contratos de encargado del tratamiento; proveedores que no usen los datos para entrenamiento.
- Cifrado en tránsito (TLS 1.2 como mínimo, 1.3 preferente) y en reposo (AES-256). Cifrado adicional a nivel de campo para `dietary_restriction.notes` y `body_profile.medical_flags`.

### 8.3 Controles técnicos [DIS]

- RLS forzada en todas las tablas de usuario; las funciones RPC derivan el usuario del token y nunca lo reciben como parámetro (defensa en profundidad).
- Pruebas automáticas de aislamiento: para cada endpoint, un usuario B intenta leer y modificar recursos de un usuario A y debe recibir 404.
- Identificadores UUID no secuenciales.
- Registro de auditoría de exportaciones, eliminaciones, cambios de correo o contraseña y accesos de soporte.
- Análisis de dependencias y de secretos en integración continua.

---

## 9. Integraciones externas

| Integración | Uso | Datos enviados | Riesgo y mitigación | Estado |
|---|---|---|---|---|
| API de Anthropic (Claude Opus 5) | Lectura de tickets; adaptación de recetas en fase posterior | Imágenes del ticket sin identificadores del usuario | Interpretaciones erróneas: salida por esquema JSON, verificación aritmética propia y confirmación del usuario. Sin entrenamiento con datos de clientes; retención estándar de 30 días. Coste por ticket medido con el conjunto de evaluación | [DIS] |
| Open Food Facts | Datos nutricionales por código de barras | Código de barras | Calidad variable: validación RN-NUT-02/03. ODbL: atribución visible y datos guardados en tablas separadas | [DIS] |
| CIQUAL y USDA FoodData Central | Composición de alimentos genéricos | Ninguno (importación periódica al catálogo) | CIQUAL: Licencia Abierta de Etalab, citar fuente y fecha; nombres en francés traducidos. USDA: dominio público, citar fuente | [DIS] |
| BEDCA | No se usa en la versión 1 | — | Reutilización no permitida sin autorización de AESAN | [PEND] |
| Expo Push (FCM y APNs) | Notificaciones | Token del dispositivo y texto sin datos de salud | Texto genérico en pantalla bloqueada por defecto | [DIS] |
| Supabase Auth | Autenticación | Correo, credenciales | Región UE; configuración de DEC-03 | [DIS] |
| Correo transaccional (SMTP propio configurado en Supabase) | Verificación, recuperación, exportación | Correo | Plantillas sin datos de salud | [DIS] |

---

## 10. Casos límite

| Área | Caso | Tratamiento |
|---|---|---|
| Captura | Mala iluminación o desenfoque | Aviso en tiempo real; si la confianza media del OCR es < 0,60, se propone repetir la foto antes de procesar. |
| Captura | Ticket arrugado o curvado | Corrección de perspectiva del escáner nativo; líneas con baja confianza marcadas. |
| Captura | Ticket largo | Varias fotos solapadas; deduplicación de líneas por texto y posición relativa; el usuario ve el ticket unido. |
| Captura | Varios tickets en una foto o en una sesión | Detección de varias cabeceras o totales; se propone separarlos. Cada ticket se revisa por separado. |
| Ticket | Ticket de otro idioma o país | Detección de idioma y configuración regional; formatos decimales (coma o punto) y de fecha según la región; confirmación si es ambiguo. |
| Ticket | Línea con abreviatura irreconocible ("PAN RUST 4U") | Propuesta con confianza baja y alternativas; el usuario elige o escribe. |
| Ticket | Marca blanca sin descripción del producto | Categoría propuesta con confianza baja; tamaño de envase pendiente. |
| Ticket | Descuento global o cupón al final | Se reparte proporcionalmente al importe solo a efectos de precio; nunca modifica cantidades. |
| Ticket | Pack ("YOGUR NAT 6X125G") | 6 unidades de 125 g; lote con `package_count = 6`, `package_size = 125 g`, cantidad inicial 750 g, pero consumo por unidad disponible. |
| Ticket | Línea anulada o devolución | Importe negativo sin producto asociado: se propone como devolución y no crea lote. |
| Inventario | Consumo mayor que lo disponible en el lote | Error con opción de repartir entre lotes o ajustar la cantidad. |
| Inventario | Consumo mayor que la suma de todos los lotes | Error; se ofrece registrar un ajuste de inventario si el usuario indica que había más producto. |
| Inventario | Fracción de 1/3 de una unidad | Se redondea a 3 decimales (0,333 ud); el residuo se trata según RN-INV-06. |
| Inventario | Producto en unidades consumido en gramos sin peso por unidad conocido | Se solicita el peso por unidad; no se convierte en silencio. |
| Inventario | Producto congelado | Ubicación "Congelador"; la fecha de caducidad original se conserva y se permite anotar fecha de congelación. |
| Nutrición | Producto sin datos | "Sin datos"; cálculo de receta marcado como incompleto. |
| Nutrición | Datos incoherentes de una fuente | Marcados para revisión, no se usan en objetivos hasta confirmarse. |
| Perfil | Usuario no indica sexo | Se calcula con la media de ambas constantes de la fórmula y se amplía el rango de incertidumbre. |
| Perfil | Embarazo, enfermedad, medicación, antecedentes de trastorno alimentario | RN-NUT-06. |
| Perfil | Índice de masa corporal < 18,5 y objetivo de pérdida | No se calcula déficit; mensaje neutro y recomendación de consultar con un profesional sanitario. |
| Peso | Registro con variación > 3 kg respecto al día anterior | Se pide confirmación (posible error de tecleo o de unidad). |
| Sesión | Token robado reutilizado | Detección de reutilización y revocación de la familia de tokens. |
| Sincronización | Dos dispositivos consumen el mismo lote sin conexión | El segundo comando se rechaza si deja negativo; conflicto visible para el usuario. |

---

## 11. Criterios de aceptación

Criterios globales. Los criterios por funcionalidad están en `docs/02-requisitos-funcionales.md`.

| Código | Criterio | Verificación |
|---|---|---|
| CA-01 | Ningún lote existe sin un movimiento `entrada_compra`, `entrada_manual` o `entrada_sobras` asociado y confirmado por el usuario. | Consulta de integridad en pruebas de integración. |
| CA-02 | Para todo lote, `cantidad_disponible = cantidad_inicial + suma(deltas)` y `cantidad_disponible >= 0`. | Restricción en base de datos y prueba de propiedades. |
| CA-03 | Consumir 1/4 de un lote de 1000 g deja 750 g; 1/2 de 500 g deja 250 g; 3/4 de 1 ud deja 0,25 ud; una porción de 30 g de un lote de 500 g deja 470 g y el lote sigue `disponible`. | Pruebas unitarias en `paquetes/dominio/test/inventario.test.ts`. [PROTO] |
| CA-04 | Un usuario autenticado como B obtiene 404 al acceder a cualquier recurso de A por cualquier endpoint. | Batería de pruebas de aislamiento. |
| CA-05 | Una receta con un alérgeno declarado nunca aparece en sugerencias. | Pruebas del motor de recetas. [PROTO] |
| CA-06 | La pantalla de perfil energético muestra método, metabolismo basal, factor, gasto diario, ajuste, rango y advertencia. | Prueba de interfaz. |
| CA-07 | Precisión de lectura de tickets sobre un conjunto de 200 tickets reales de al menos 5 cadenas: >= 90 % de líneas con nombre correcto tras la propuesta automática y >= 98 % de importes correctos. | Evaluación offline antes del lanzamiento. [PEND: el conjunto no existe todavía] |
| CA-08 | Revisión de un ticket de 20 líneas en menos de 2 minutos por un usuario de prueba. | Prueba de usabilidad. |
| CA-09 | La exportación contiene todas las entidades del usuario y ninguna de otro. | Prueba de integración. |
| CA-10 | Tras la eliminación de cuenta, no quedan datos del usuario en la base de datos activa pasados 7 días. | Prueba automatizada del proceso de purga. |

---

## 12. Fases recomendadas de desarrollo

| Fase | Contenido | Entregable verificable | Dependencias |
|---|---|---|---|
| F0. Fundamentos | Monorepositorio (DEC-08), traslado del prototipo a `paquetes/dominio`, proyecto de Supabase en la UE, migración inicial del esquema adaptada a Supabase Auth, autenticación completa (registro, verificación, inicio y cierre de sesión, recuperación, Apple y Google), app Expo con navegación y sesión, pruebas de aislamiento. La integración continua ya está activa (DEC-10). | Usuario puede registrarse, verificar el correo, iniciar sesión y cerrarla; CA-04 en verde. | — |
| F1. Despensa manual | Alta manual de productos y lotes, ubicaciones, estados de caducidad, consumo parcial y total, desperdicio, correcciones, historial de movimientos. | CA-02 y CA-03 en integración real. | F0 |
| F2. Perfil y energía | Cuestionario, restricciones, cálculo energético con presentación completa, avisos sanitarios. | CA-06. | F0 |
| F3. Tickets | Captura, Edge Function de lectura con Claude Opus 5 y salida estructurada, verificación aritmética, normalización con alias, pantalla de revisión, reconciliación, duplicados, evaluación con los 200 tickets (DEC-06). | CA-01, CA-07, CA-08; coste por ticket medido. | F1 |
| F4. Nutrición | Catálogo nutricional, vinculación de productos, validaciones de coherencia, diario de ingesta. | Diario diario con totales y porcentaje de cobertura de datos. | F1, F2 |
| F5. Recetas | Catálogo curado, filtros estrictos, puntuación, clasificación de ingredientes, lista de compra, registro de cocinado y sobras. | CA-05; cocinar una receta descuenta los lotes correctos. | F1, F4 |
| F6. Seguimiento corporal y notificaciones | Registro de peso y medidas, tendencia, gráficos, avisos de caducidad y recordatorios. | Gráfico con tendencia; notificación de caducidad recibida en dispositivo. | F2 |
| F7. Privacidad completa | Exportación, eliminación con purga, gestión de consentimientos, auditoría, evaluación de impacto. | CA-09, CA-10. | Todas |
| F8. Mejoras | Recalibración energética con datos reales, escaneo de fechas en envases, lectura de tickets sin conexión, segundo factor de autenticación, despensa compartida con consentimiento. | Según alcance. | F1–F7 |

Orden recomendado para un producto mínimo viable: F0, F1, F2, F3, F4, F5, F7 (la privacidad completa es requisito previo al lanzamiento público), F6.
