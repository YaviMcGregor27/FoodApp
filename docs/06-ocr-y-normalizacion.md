# Lectura de tickets y normalización de productos

Estado: [DIS] diseño propuesto. El analizador de líneas (etapa 4) existe como [PROTO] en `prototipo/dominio/ticket.ts` con pruebas en `prototipo/test/ticket.test.ts`. La captura, el OCR, la normalización y el aprendizaje de alias no están implementados.

Principio: el sistema propone, el usuario confirma. Ninguna salida de este módulo crea existencias por sí misma (RN-INV-01).

## 1. Canal de procesamiento

| Etapa | Dónde | Entrada | Salida | Tratamiento de errores |
|---|---|---|---|---|
| 1. Captura | Dispositivo | Cámara | Imágenes corregidas de perspectiva | Avisos de luz, movimiento y encuadre en tiempo real |
| 2. Preprocesado | Dispositivo | Imágenes | Imágenes en escala de grises, enderezadas, contraste normalizado, comprimidas | Si la nitidez estimada es baja, se propone repetir |
| 3. OCR | Servicio OCR | Imágenes | Texto por línea con coordenadas y confianza por palabra | Si la confianza media < 0,60, estado `error` con sugerencia de repetir |
| 4. Análisis de líneas | Backend | Líneas de texto | Tipo de línea, nombre leído, cantidad, unidad, envase, precio, importe, descuentos, avisos | Líneas no reconocidas: se envían a la etapa 4b |
| 4b. Interpretación asistida | Modelo multimodal de lenguaje | Líneas no resueltas y su recorte de imagen, sin datos del usuario | Propuesta estructurada validada por esquema JSON | Si la salida no valida el esquema, la línea queda como "Requiere acción" |
| 5. Cabecera y totales | Backend | Líneas | Tienda, cadena, fecha, hora, total, configuración regional | Fecha ambigua: se marca y se pide confirmación |
| 6. Normalización | Backend | Nombre leído + cadena | Producto propuesto, categoría, alternativas, confianza | Sin coincidencia: propuesta genérica con confianza baja |
| 7. Reconciliación | Backend | Importes, descuentos, total | Diferencia y estado | Diferencia visible; no bloquea |
| 8. Revisión | Dispositivo | Todo lo anterior | Decisiones del usuario | Ver RF-04 |
| 9. Aprendizaje | Backend | Correcciones | Alias por usuario y cadena | — |

## 2. Tickets largos y múltiples

- Tickets largos: el usuario captura varias partes con solapamiento. Las líneas del solapamiento se detectan por coincidencia de texto normalizado en las últimas líneas de una parte y las primeras de la siguiente (se exige coincidencia de al menos 2 líneas consecutivas). Si no se detecta solapamiento, se avisa: "No hemos podido unir las partes 2 y 3. Revisa que no falten ni se repitan líneas."
- Varios tickets en una sesión: se detectan por la aparición de una nueva cabecera (nombre de tienda, NIF) tras un total. Se proponen tickets separados.

## 3. Reglas del analizador de líneas [PROTO]

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
3. Diccionario de abreviaturas por cadena mantenido por el equipo (por ejemplo `SEMID` = semidesnatada, `HDO` = hacendado como marca, `NAT` = natural, `RUST` = rústico, `P.` = pack). Se expande el texto y se continúa.
4. Búsqueda en el catálogo por similitud de trigramas y por similitud semántica sobre el nombre expandido. Confianza = puntuación combinada, con máximo 0,89 (nunca alta sin confirmación previa del usuario).
5. Clasificador de categoría (lácteos, frutas, carnes, droguería, etc.) sobre el texto. Detecta artículos no alimentarios.
6. Si nada supera 0,50, la línea se propone como "Producto no identificado" con el texto original como nombre provisional, confianza baja, y requiere acción.

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

- Las imágenes se envían al servicio OCR sin identificadores de usuario; el recorte que se envía al modelo de lenguaje contiene solo las líneas no resueltas.
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
