# Lectura de tickets y normalización de productos

Estado: [DIS] diseño propuesto con el enfoque decidido en DEC-04 (`09-decisiones.md`). Las reglas de verificación de líneas (sección 3) existen como [PROTO] en `paquetes/dominio/src/ticket.ts` con pruebas en `paquetes/dominio/test/ticket.test.ts`. La captura, la llamada al modelo, la normalización y el aprendizaje de alias no están implementados.

Principio: el sistema propone, el usuario confirma. Ninguna salida de este módulo crea existencias por sí misma (RN-INV-01). La lectura la hace un modelo multimodal; la aritmética y la confianza las decide el código propio.

## 1. Canal de procesamiento

| Etapa | Dónde | Entrada | Salida | Tratamiento de errores |
|---|---|---|---|---|
| 1. Captura | App | Cámara con escáner de documentos nativo | Imágenes corregidas de perspectiva | Avisos de luz, movimiento y encuadre en tiempo real |
| 2. Preprocesado | App | Imágenes | Imágenes enderezadas y comprimidas (lado mayor de 2000 px como máximo), sin metadatos de ubicación | Si la nitidez estimada es baja, se propone repetir |
| 3. Subida | App a Supabase Storage | Imágenes | Rutas con prefijo del usuario; ticket en estado `procesando` | Sin conexión: se guarda y se reintenta |
| 4. Lectura | Edge Function a la API de Anthropic (Claude Opus 5) | Todas las imágenes del ticket en una sola petición, sin datos del usuario | JSON validado por esquema: cabecera (tienda, fecha, hora, total, moneda), líneas con `texto_literal`, tipo, nombre interpretado, cantidad, unidad, envase, precio unitario, precio por kilo, importe, descuento y legibilidad declarada | Respuesta no válida, rechazo o error: un reintento; después, estado `error` con opción de repetir la foto o añadir manualmente |
| 5. Verificación | Edge Function con el dominio (`ticket.ts`) | JSON de la etapa 4 | Confianza por campo, avisos (`PESO_INCOHERENTE`, `MULTIPLICADOR_INCOHERENTE`, descuento sin asociar), reconciliación con el total | Una línea que no cuadra baja a confianza baja y requiere acción |
| 6. Normalización | PostgreSQL | Nombre interpretado + texto literal + cadena | Producto propuesto, categoría, alternativas | Los alias del usuario prevalecen sobre la interpretación del modelo |
| 7. Duplicados | PostgreSQL | Tienda + fecha + hora + total | Aviso si ya existe | No bloquea; el usuario decide |
| 8. Revisión | App | Todo lo anterior | Decisiones del usuario | Ver RF-04 |
| 9. Aprendizaje | PostgreSQL | Correcciones | Alias por usuario y cadena | — |

Reglas de la llamada al modelo:

- `texto_literal` es la transcripción exacta de la línea tal como aparece impresa y es lo que se guarda como `receipt_line.raw_text`; la interpretación va en campos separados.
- Instrucción explícita de no inventar: si un dato no es legible o no aparece (por ejemplo, el tamaño del envase o la fecha), el campo se devuelve vacío y la línea se marca con legibilidad baja.
- La caducidad nunca se pide al modelo (RN-TIC-09).
- Se registran por ticket el número de tokens y el coste para vigilar el gasto.

Cálculo de la confianza (sustituye a la confianza del OCR clásico):

| Situación de la línea | Confianza de cantidad e importe |
|---|---|
| Comprobación aritmética correcta (peso por precio, unidades por precio) y legibilidad alta | 0,95 |
| Línea simple sin comprobación posible | 0,80 (cantidad 1 supuesta) |
| Legibilidad baja declarada por el modelo | Máximo 0,60 |
| Comprobación aritmética fallida | 0,50 a 0,60 |

La confianza del nombre la fija la normalización (sección 4). Los umbrales se recalibran con el conjunto de evaluación (DEC-06).

## 2. Tickets largos y múltiples

- Tickets largos: el usuario captura varias partes con solapamiento. Las líneas del solapamiento se detectan por coincidencia de texto normalizado en las últimas líneas de una parte y las primeras de la siguiente (se exige coincidencia de al menos 2 líneas consecutivas). Si no se detecta solapamiento, se avisa: "No hemos podido unir las partes 2 y 3. Revisa que no falten ni se repitan líneas."
- Varios tickets en una sesión: se detectan por la aparición de una nueva cabecera (nombre de tienda, NIF) tras un total. Se proponen tickets separados.

## 3. Reglas de verificación de líneas [PROTO]

El prototipo actual analiza texto plano de línea; en la fase F3 se adaptará para recibir los campos estructurados del modelo y aplicar las mismas comprobaciones. Patrones y comprobaciones:

| Patrón | Ejemplo | Interpretación | Comprobación |
|---|---|---|---|
| Producto a peso | `PLATANO CANARIAS 0,532 kg x 2,19 €/kg 1,17` | 532 g, 2,19 €/kg, importe 1,17 | `peso x precio_kg` = importe +-0,02; si no, confianza 0,5 y aviso `PESO_INCOHERENTE` |
| Multiplicador delante | `2 LECHE SEMIDESNATADA 1L 0,89 1,78` | 2 envases de 1000 ml, 0,89 cada uno | `n x precio` = importe; si no, confianza 0,6 y aviso |
| Multiplicador detrás | `TOMATE TRITURADO 400G 3 x 0,65 1,95` | 3 envases de 400 g | Igual |
| Línea simple | `YOGUR NATURAL 6X125G 1,45` | 1 pack de 6 x 125 g | Cantidad 1 supuesta: confianza 0,8, se resalta |
| Descuento | `DTO 2ª UD -0,45`, `PROMO -1,00`, `CUPON ...` | Descuento de 0,45 | Se asocia a la línea de producto anterior si su importe no es mayor que el de esa línea; si no, queda "Sin asociar" |
| Total | `TOTAL 4,10` | Total impreso | Reconciliación |
| Ignoradas | `IVA`, `SUBTOTAL`, `TARJETA`, `ENTREGADO`, `CAMBIO`, `NIF` | No son productos | — |

Extracción del envase desde el nombre: `6X125G` (6 unidades de 125 g), `1L`, `1,5 L`, `500G`, `250 ML`, `1KG`, `33CL`. Si el nombre no incluye tamaño, el tamaño queda pendiente; nunca se deduce del precio.

Importes en céntimos enteros; decimales con coma o punto según la configuración regional detectada.

## 4. Normalización de productos [DIS]

Orden de resolución para cada nombre leído:

1. Alias del usuario para esa cadena (`product_alias` con `store_chain` exacto). Confianza 0,97 si se confirmó 2 o más veces; 0,92 si una.
2. Alias del usuario para cualquier cadena (`store_chain = '*'`). Confianza 0,85.
3. Interpretación propuesta por el modelo en la lectura: se busca en el catálogo; si coincide con un producto, confianza 0,85 como máximo; si no coincide, se conserva como propuesta de nombre con confianza 0,70 como máximo.
4. Diccionario de abreviaturas por cadena mantenido por el equipo (por ejemplo `SEMID` = semidesnatada, `HDO` = hacendado como marca, `NAT` = natural, `RUST` = rústico, `P.` = pack). Se expande el texto y se continúa.
5. Búsqueda en el catálogo por similitud de trigramas y por similitud semántica sobre el nombre expandido. Confianza = puntuación combinada, con máximo 0,89 (nunca alta sin confirmación previa del usuario).
6. Clasificador de categoría (lácteos, frutas, carnes, droguería, etc.) sobre el texto. Detecta artículos no alimentarios.
7. Si nada supera 0,50, la línea se propone como "Producto no identificado" con el texto original como nombre provisional, confianza baja, y requiere acción.

Se proponen hasta 3 alternativas ordenadas por confianza.

Marcas blancas: el nombre de marca se trata como atributo, no como producto; "HACENDADO LECHE SEMI" se normaliza como "Leche semidesnatada" con marca "Hacendado".

## 5. Confianza

Cada línea tiene confianza por campo (nombre, cantidad, unidad, importe, descuento). La confianza mostrada de la línea es la mínima de sus campos.

| Nivel | Umbral | Presentación | Acción requerida |
|---|---|---|---|
| Alta | >= 0,90 | Prerrellenada | Ninguna individual; confirmación global del ticket |
| Media | 0,70–0,89 | Resaltada "Revisar" | Ninguna obligatoria, visible en el filtro |
| Baja | < 0,70 | "Requiere acción" | Aceptar, corregir o descartar antes de confirmar |

Los umbrales se recalibrarán con el conjunto de evaluación (CA-07) para que "Alta" corresponda a una tasa de corrección del usuario inferior al 5 %. [PEND]

## 6. Fechas y configuración regional

- Formatos admitidos: `dd/mm/aaaa`, `dd/mm/aa`, `dd-mm-aaaa`, `aaaa-mm-dd`, `mm/dd/aaaa` (solo con configuración regional de EE. UU.).
- Si día y mes son ambos <= 12 y la configuración regional no es concluyente, se muestra la interpretación elegida y se pide confirmación.
- Si no se lee fecha: se propone la fecha de captura marcada como "Supuesta".
- Fechas futuras o anteriores a 2 años: se rechazan como lectura y se piden al usuario.

## 7. Caducidad

La caducidad no aparece en los tickets y nunca se deduce de ellos (RN-TIC-09). Opciones para el usuario en la revisión:

1. Introducir fecha manualmente, indicando si es "Caducidad" o "Consumo preferente".
2. Escanear la fecha impresa en el envase con la cámara (OCR sobre la etiqueta, con confirmación).
3. Dejarla pendiente.
4. [DIS, opcional] Ver un plazo orientativo de una tabla de referencia con fuente citada; solo se guarda si el usuario lo acepta explícitamente, con `date_origin = 'estimacion_aceptada'` y etiqueta visible "Estimada".

## 8. Seguridad y privacidad del canal

- Las imágenes se envían a la API de Anthropic sin identificadores del usuario. Las condiciones comerciales de Anthropic prohíben entrenar con el contenido de los clientes; la retención estándar es de 30 días.
- Los proveedores deben garantizar por contrato que no usan los datos para entrenamiento.
- Los últimos dígitos de tarjeta u otros datos de pago detectados se enmascaran en el texto almacenado.

## 9. Métricas de calidad

| Métrica | Definición | Objetivo inicial |
|---|---|---|
| Precisión de nombre | Líneas cuyo producto propuesto acepta el usuario sin cambio | >= 90 % |
| Precisión de importe | Importes leídos iguales al impreso | >= 98 % |
| Tasa de reconciliación | Tickets con diferencia 0 | >= 85 % |
| Tiempo de revisión | Mediana por ticket de 20 líneas | < 2 minutos |
| Tasa de repetición de foto | Tickets con nueva captura solicitada | < 10 % |
