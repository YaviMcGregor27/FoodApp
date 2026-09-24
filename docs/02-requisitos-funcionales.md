# Requisitos funcionales

Estado de todo el documento: [REQ] requisito funcional. El diseño correspondiente está en `01-especificacion-tecnica.md`. Ninguno está implementado.

Índice:

- RF-01 Cuenta de usuario y autenticación
- RF-02 Cuestionario inicial y perfil corporal
- RF-03 Captura de ticket
- RF-04 Revisión y confirmación de ticket
- RF-05 Alta manual de productos y lotes
- RF-06 Consumo parcial y total
- RF-07 Desperdicio, caducidad y correcciones
- RF-08 Historial de movimientos
- RF-09 Sugerencia de recetas
- RF-10 Registro de cocinado y sobras
- RF-11 Lista de compra
- RF-12 Datos nutricionales de productos y recetas
- RF-13 Estimación energética y objetivos
- RF-14 Diario nutricional
- RF-15 Registro de peso e indicadores corporales
- RF-16 Tendencias y evolución
- RF-17 Notificaciones
- RF-18 Exportación de datos y eliminación de cuenta

---

## RF-01 Cuenta de usuario y autenticación

1. **Nombre de la funcionalidad.** Cuenta de usuario y autenticación.
2. **Objetivo.** Permitir crear, usar y cerrar una cuenta personal con datos aislados y sesiones seguras.
3. **Flujo principal de usuario.**
   1. El usuario elige "Crear cuenta", introduce correo, contraseña y fecha de nacimiento; acepta términos y, por separado, el tratamiento de datos de salud.
   2. Recibe un correo de verificación y pulsa el enlace.
   3. Inicia sesión; la aplicación guarda los tokens en el almacenamiento seguro del dispositivo.
   4. Puede cerrar sesión en el dispositivo actual o en todos.
   5. Si olvida la contraseña, solicita un enlace de recuperación y define una nueva.
4. **Datos de entrada.** Correo, contraseña, fecha de nacimiento, consentimientos (términos, datos de salud, notificaciones), proveedor federado opcional.
5. **Reglas de negocio.**
   - Edad mínima 18 años.
   - Contraseña de al menos 12 caracteres y no presente en listas de contraseñas filtradas.
   - Sin consentimiento de datos de salud, el usuario puede usar despensa y recetas, pero no perfil corporal, energía ni peso.
   - Mensajes de error de inicio de sesión y recuperación que no revelan si el correo existe.
   - Cambio de contraseña invalida todas las sesiones salvo la actual.
6. **Resultado esperado.** Cuenta creada y verificada; sesión activa con token de acceso de 15 minutos y token de refresco rotatorio.
7. **Casos límite.** Enlace de verificación caducado (se permite reenviar, máximo 5 por hora); correo ya registrado (mismo mensaje que el registro correcto, con aviso por correo al titular); cuenta federada que intenta recuperar contraseña (se le indica su proveedor); reutilización de token de refresco (revocación de todas las sesiones).
8. **Criterios de aceptación.**
   - Un usuario sin verificar no puede exportar datos.
   - Tras cerrar sesión, el token de refresco anterior devuelve 401.
   - Tras 10 intentos fallidos en 15 minutos, los siguientes intentos se retrasan de forma progresiva.
   - Un usuario menor de 18 años no puede completar el registro.

---

## RF-02 Cuestionario inicial y perfil corporal

1. **Nombre de la funcionalidad.** Cuestionario inicial y perfil corporal.
2. **Objetivo.** Recoger los datos mínimos para estimar necesidades energéticas y filtrar recetas de forma segura.
3. **Flujo principal de usuario.**
   1. Tras el registro, la aplicación presenta el cuestionario por pasos con indicador de progreso. Se puede guardar y continuar después.
   2. Pasos: datos básicos, actividad y entrenamiento, objetivos, alimentación (restricciones, alergias, intolerancias, preferencias, comidas al día), situaciones que requieren atención profesional, resumen.
   3. Al finalizar se muestra el perfil energético (RF-13).
4. **Datos de entrada.**
   - Edad (derivada de la fecha de nacimiento).
   - Sexo: mujer, hombre, prefiero no indicarlo.
   - Altura en cm (100–250).
   - Peso actual en kg (30–300).
   - Porcentaje de grasa corporal y método de medición (opcional).
   - Actividad diaria fuera del entrenamiento: trabajo sentado, de pie, trabajo físico.
   - Entrenamiento: sesiones por semana (0–14), tipo (fuerza, resistencia, mixto, deportes de equipo, otro), duración media en minutos.
   - Nivel habitual de actividad física: sedentario, ligero, moderado, alto, muy alto, con descripción de cada nivel. La aplicación propone un nivel a partir de los dos datos anteriores (ver `05-motor-energetico-y-nutricional.md`, sección 2) y el usuario lo confirma o lo cambia.
   - Objetivo principal: perder peso, mantener, ganar peso.
   - Objetivo adicional: ganar músculo, mantener masa muscular, rendimiento deportivo, ninguno, otro (texto).
   - Ritmo deseado (solo si pierde o gana): conservador, moderado.
   - Alergias (lista de los 14 alérgenos de declaración obligatoria en la UE más texto libre) con severidad.
   - Intolerancias (lactosa, fructosa, sorbitol, otra) con tolerancia a trazas sí o no.
   - Dietas: omnívora, vegetariana, vegana, pescetariana, sin gluten por celiaquía, halal, kosher, otra.
   - Alimentos que no le gustan y alimentos preferidos.
   - Comidas por día (1–8).
   - Situaciones relevantes: embarazo, lactancia, enfermedad crónica relevante para la alimentación, medicación que afecta al peso o al apetito, antecedentes de trastorno de la conducta alimentaria, ninguna, prefiero no responder.
   - Tiempo habitual disponible para cocinar y número habitual de comensales.
5. **Reglas de negocio.**
   - Todos los campos numéricos se validan en rango; fuera de rango se muestra el valor permitido.
   - Si se marca cualquier situación relevante, se aplica RN-NUT-06 y se muestra: "Con la información indicada, te recomendamos consultar con un profesional sanitario antes de fijar un objetivo de pérdida o ganancia de peso. Mostramos una estimación de mantenimiento solo como referencia."
   - "Prefiero no responder" en situaciones relevantes se trata igual que "ninguna" a efectos de cálculo, pero se muestra una advertencia general.
   - La celiaquía se trata como restricción estricta equivalente a alergia.
   - La aplicación no pregunta por diagnósticos más allá de lo necesario ni emite valoraciones.
6. **Resultado esperado.** Perfil guardado con fecha de versión; cálculo energético inicial (RF-13); restricciones activas en el motor de recetas.
7. **Casos límite.** Usuario que abandona a mitad (se guarda borrador); cambio posterior de objetivo (genera nueva versión del perfil y nuevo cálculo); altura en pies y pulgadas o peso en libras (conversión por preferencia de unidades); IMC < 18,5 con objetivo de pérdida (no se calcula déficit).
8. **Criterios de aceptación.**
   - No se puede finalizar sin edad, altura, peso, actividad y objetivo.
   - Una alergia declarada aparece inmediatamente como filtro en recetas.
   - Marcar embarazo impide mostrar un objetivo de déficit.

---

## RF-03 Captura de ticket

1. **Nombre de la funcionalidad.** Captura de ticket.
2. **Objetivo.** Obtener imágenes de tickets con calidad suficiente para su lectura.
3. **Flujo principal de usuario.**
   1. El usuario pulsa "Escanear ticket".
   2. La cámara muestra una guía de encuadre y detecta los bordes del ticket.
   3. La aplicación indica en tiempo real: "Poca luz", "Imagen movida", "Acerca el ticket" o "Listo".
   4. El usuario captura; si el ticket es largo, pulsa "Añadir otra parte" y captura la continuación con solapamiento.
   5. Revisa las miniaturas, reordena o elimina, y pulsa "Procesar".
   6. Alternativa: importar imagen o PDF desde la galería o archivos.
4. **Datos de entrada.** Una o varias imágenes (JPEG o HEIC) o un PDF; zona horaria y configuración regional del dispositivo.
5. **Reglas de negocio.**
   - Máximo 10 imágenes por ticket y 20 MB en total.
   - Las imágenes se corrigen de perspectiva y se comprimen en el dispositivo antes de subirse.
   - Se calcula una huella perceptual para avisar si la misma imagen ya se procesó.
6. **Resultado esperado.** Ticket en estado `procesando`, visible en la lista de tickets con indicador de progreso. Notificación cuando esté listo para revisar.
7. **Casos límite.** Sin conexión (se guarda y se procesa al reconectar); permiso de cámara denegado (explicación y acceso a importar desde galería); varias partes fuera de orden (el sistema reordena por solapamiento y lo indica).
8. **Criterios de aceptación.**
   - Un ticket de 60 cm capturado en 3 partes se procesa como un único ticket sin líneas duplicadas.
   - Con permiso de cámara denegado, la importación desde galería sigue disponible.

---

## RF-04 Revisión y confirmación de ticket

1. **Nombre de la funcionalidad.** Revisión y confirmación de ticket.
2. **Objetivo.** Permitir al usuario validar y corregir la interpretación automática antes de incorporar productos a la despensa.
3. **Flujo principal de usuario.**
   1. El usuario abre un ticket en estado `pendiente_revision`.
   2. Ve la cabecera (tienda, fecha, hora, total) con su confianza, y la reconciliación ("Suma de líneas: 43,20. Total del ticket: 43,20. Coincide.").
   3. Ve cada línea con el texto original y la interpretación propuesta: nombre normalizado, categoría, cantidad, unidad, tamaño de envase, precio, descuento y confianza. Las líneas de confianza media están resaltadas; las de baja confianza requieren acción.
   4. Por cada línea puede: aceptar, editar, elegir entre alternativas propuestas, dividir (una línea que contiene dos productos), combinar (dos líneas del mismo producto), marcar como "No es alimento" o descartar.
   5. Completa caducidad (fecha manual, lectura del envase con cámara o "Sin fecha") y ubicación (despensa, frigorífico, congelador u otra).
   6. Pulsa "Añadir a la despensa". Un resumen indica cuántos lotes se crearán y cuántas líneas quedan sin añadir.
4. **Datos de entrada.** Resultado del OCR y la normalización; correcciones del usuario.
5. **Reglas de negocio.** RN-INV-01, RN-TIC-01 a RN-TIC-10, RN-INV-12, RN-INV-13.
   - No se puede confirmar mientras quede alguna línea de confianza baja sin acción.
   - Las líneas aceptadas sin caducidad quedan con caducidad "Pendiente" y aparecen en el filtro "Datos pendientes" de la despensa.
   - Cada corrección de nombre crea o actualiza un alias `texto_original + cadena -> producto` del usuario.
6. **Resultado esperado.** Lotes creados con movimiento `entrada_compra`, vínculo a la línea de ticket y ticket en estado `confirmado`.
7. **Casos límite.** Reconciliación no cuadra (se permite confirmar, con aviso visible y registro de la diferencia); fecha de ticket ilegible (se propone la fecha de captura, marcada como supuesta, y se pide confirmación); línea de producto a granel sin peso (cantidad pendiente obligatoria); el usuario abandona la revisión (se conserva el progreso).
8. **Criterios de aceptación.**
   - Ningún lote se crea antes de pulsar "Añadir a la despensa".
   - La confirmación es atómica: o se crean todos los lotes aceptados o ninguno.
   - Un segundo ticket de la misma cadena con el mismo texto de línea propone el producto corregido previamente con confianza alta.

---

## RF-05 Alta manual de productos y lotes

1. **Nombre de la funcionalidad.** Alta manual de productos y lotes.
2. **Objetivo.** Incorporar existencias sin ticket (regalos, productos de huerta, compras sin ticket, inventario inicial).
3. **Flujo principal de usuario.** Pulsar "Añadir producto", buscar en el catálogo o escribir nombre libre, indicar cantidad y unidad, tamaño de envase, número de envases, fecha de compra (por defecto hoy), caducidad y tipo de fecha, ubicación. Opcional: escanear código de barras para autocompletar nombre, tamaño y datos nutricionales.
4. **Datos de entrada.** Nombre, categoría, cantidad, unidad, tamaño y número de envases, fechas, ubicación, estado abierto o cerrado, código de barras opcional.
5. **Reglas de negocio.** RN-INV-12, RN-INV-13, RN-INV-03. Movimiento `entrada_manual`. Si el producto ya existe, se crea un nuevo lote, no se suma al existente.
6. **Resultado esperado.** Lote nuevo visible en la despensa.
7. **Casos límite.** Producto sin tamaño de envase conocido (se admite; el consumo por fracción del envase queda deshabilitado hasta que se indique); inventario inicial de muchos productos (modo de alta rápida en lista).
8. **Criterios de aceptación.** Guardar un producto sin nombre muestra "El nombre del producto es obligatorio" y no crea nada; una cantidad 0 o negativa se rechaza.

---

## RF-06 Consumo parcial y total

1. **Nombre de la funcionalidad.** Consumo parcial y total.
2. **Objetivo.** Descontar del inventario la cantidad realmente consumida, manteniendo el producto con la cantidad restante.
3. **Flujo principal de usuario.**
   1. En la despensa, el usuario pulsa "Consumir" sobre un producto.
   2. Elige el modo: fracción (1/4, 1/2, 3/4, otra fracción), cantidad exacta (g, ml, ud), porciones configuradas o "Todo".
   3. Si es fracción, elige referencia: "del envase" o "de lo que queda".
   4. La aplicación muestra: "Se descontarán 250 g. Quedarán 750 g." y el lote de origen.
   5. Indica quién lo consume: "Yo", "Otras personas" o "Reparto" (por ejemplo, 1 de 3 partes).
   6. Confirma.
4. **Datos de entrada.** Producto o lote, modo, valor, referencia de fracción, consumidor, fecha y hora (por defecto ahora), comida del día (desayuno, comida, cena, otra).
5. **Reglas de negocio.** RN-INV-03 a RN-INV-07, RN-INV-10, RN-CON-01. El primer consumo de un lote cerrado lo marca como `abierto` y permite indicar una nueva fecha de consumo tras apertura.
6. **Resultado esperado.** Movimiento `consumo_parcial` si queda cantidad o `consumo_total` si llega a cero; entrada en el diario si el consumidor es el usuario.
7. **Casos límite.** Fracción de un producto sin tamaño de envase con referencia "del envase" (se pide el tamaño o se cambia a "de lo que queda"); consumo que abarca varios lotes (se reparte en orden RN-INV-10 y se muestra el reparto); residuo menor del 2 % (RN-INV-06); consumo registrado con fecha pasada (permitido hasta 7 días atrás, sin afectar a movimientos posteriores de forma inconsistente).
8. **Criterios de aceptación.**
   - 1/4 de 1 kg deja 750 g; 1/2 de 500 g deja 250 g; 3/4 de 1 ud deja 0,25 ud.
   - Una porción de 30 g sobre 500 g deja 470 g y el producto sigue en la despensa.
   - "Todo" deja 0 y el lote pasa a `agotado`.
   - Intentar consumir 600 g de un lote de 500 g sin otros lotes muestra "La cantidad supera lo disponible (500 g)".

---

## RF-07 Desperdicio, caducidad y correcciones

1. **Nombre de la funcionalidad.** Desperdicio, caducidad y correcciones.
2. **Objetivo.** Registrar salidas que no son consumo y corregir errores sin perder trazabilidad.
3. **Flujo principal de usuario.** Sobre un lote: "Desechar" (cantidad o todo, motivo: caducado, en mal estado, sobrante, otro); "Corregir cantidad" (nueva cantidad disponible y motivo); "Deshacer movimiento" sobre un movimiento del historial; "Combinar lotes" sobre dos lotes del mismo producto; "Mover" a otra ubicación.
4. **Datos de entrada.** Lote, cantidad, motivo, nota opcional.
5. **Reglas de negocio.** RN-INV-08, RN-INV-09, RN-CON-04. Un deshacer genera un movimiento compensatorio y solo es posible si no deja ningún lote en negativo. La corrección de cantidad genera un movimiento `ajuste` con el delta calculado.
6. **Resultado esperado.** Movimientos correspondientes e informe de desperdicio actualizado.
7. **Casos límite.** Deshacer un consumo cuyo lote ya fue combinado (se deshace sobre el lote resultante con aviso); corregir al alza un lote agotado (vuelve a `disponible`).
8. **Criterios de aceptación.** El historial muestra el movimiento original y el compensatorio; la suma de movimientos coincide con la cantidad disponible.

---

## RF-08 Historial de movimientos

1. **Nombre de la funcionalidad.** Historial de movimientos.
2. **Objetivo.** Ofrecer una traza auditable de todas las modificaciones del inventario.
3. **Flujo principal de usuario.** Desde un lote o desde la sección "Historial", ver movimientos filtrables por producto, tipo, fecha y origen.
4. **Datos de entrada.** Filtros.
5. **Reglas de negocio.** Tipos: `entrada_compra`, `entrada_manual`, `entrada_sobras`, `consumo_parcial`, `consumo_total`, `desperdicio`, `correccion`, `ajuste`, `caducidad` (baja por caducidad), `transferencia_entrada`, `transferencia_salida`. Cada movimiento muestra fecha, cantidad antes, delta, cantidad después, origen (ticket, receta, manual) y autor (usuario o proceso).
6. **Resultado esperado.** Lista paginada y exportable.
7. **Casos límite.** Lotes eliminados de la vista por estar agotados siguen teniendo historial consultable.
8. **Criterios de aceptación.** Para cualquier lote, el último `cantidad después` del historial coincide con la cantidad disponible mostrada.

---

## RF-09 Sugerencia de recetas

1. **Nombre de la funcionalidad.** Sugerencia de recetas.
2. **Objetivo.** Proponer recetas útiles que aprovechen la despensa y se ajusten al objetivo y las restricciones del usuario.
3. **Flujo principal de usuario.**
   1. El usuario abre "Recetas". Puede indicar comida del día, tiempo disponible, dificultad máxima y comensales.
   2. La aplicación muestra una lista ordenada con, por receta: kcal y macronutrientes por ración, tiempo, dificultad, porcentaje de ingredientes disponibles y número de ingredientes a comprar.
   3. Etiquetas de motivo: "Usa 2 productos que caducan en 2 días", "Aprovecha 1 producto abierto", "Encaja en lo que te queda hoy".
   4. Al abrir una receta se ven los ingredientes en cuatro grupos: disponibles, parcialmente disponibles (con cantidad que falta), que faltan y opcionales o sustituibles.
4. **Datos de entrada.** Despensa, perfil, restricciones, diario del día, filtros.
5. **Reglas de negocio.** RN-NUT-07; prioridades del motor (ver `07-motor-de-recetas.md`); los básicos declarados por el usuario (sal, aceite, especias) se muestran como "Básico declarado", no como disponibles con cantidad.
6. **Resultado esperado.** Lista de recetas seguras y ordenadas por utilidad.
7. **Casos límite.** Despensa vacía (se muestran recetas sencillas con todos los ingredientes a comprar y el aviso correspondiente); ninguna receta pasa los filtros (mensaje con los filtros que más restringen y opción de relajarlos, nunca los de alergias); datos nutricionales incompletos (aviso "Cálculo incompleto").
8. **Criterios de aceptación.** Ninguna receta sugerida contiene alérgenos del usuario; una receta que usa un producto que caduca mañana aparece por encima de otra equivalente que no lo usa.

---

## RF-10 Registro de cocinado y sobras

1. **Nombre de la funcionalidad.** Registro de cocinado y sobras.
2. **Objetivo.** Descontar los ingredientes realmente usados, registrar lo que come el usuario y conservar las raciones sobrantes.
3. **Flujo principal de usuario.**
   1. En una receta, el usuario pulsa "He cocinado esto" (o "Registrar plato propio" para platos sin receta).
   2. La aplicación propone, por ingrediente, lote y cantidad a descontar. El usuario ajusta cantidades reales.
   3. Indica raciones producidas, comensales y raciones que come él.
   4. Para las raciones sobrantes elige: guardar en la despensa (ubicación y caducidad), desechar o consumidas por otros.
4. **Datos de entrada.** Receta o lista de ingredientes, cantidades, lotes, raciones, comensales, raciones del usuario, destino de sobras.
5. **Reglas de negocio.** RN-CON-02, RN-CON-03, RN-INV-03, RN-INV-10. Nutrientes por ración = nutrientes totales de ingredientes usados / raciones producidas. El lote de sobras tiene unidad "ración" con nutrientes por ración y caducidad pendiente de confirmar.
6. **Resultado esperado.** Un `consumption_event` de tipo `cocinado` con sus movimientos, un `cooking_log`, una entrada de diario del usuario y, en su caso, un lote de sobras con movimiento `entrada_sobras`.
7. **Casos límite.** Ingrediente usado que no estaba en la despensa (se registra en la receta para nutrientes, sin movimiento); cantidad usada mayor que la disponible (se limita y se ofrece ajuste de inventario); 0 raciones producidas (rechazado).
8. **Criterios de aceptación.** Tras cocinar 4 raciones y comer 1, el diario suma 1 ración y la despensa contiene un lote de sobras de 3 raciones.

---

## RF-11 Lista de compra

1. **Nombre de la funcionalidad.** Lista de compra.
2. **Objetivo.** Reunir lo que hay que comprar a partir de recetas, productos agotados y entradas manuales.
3. **Flujo principal de usuario.** Añadir desde una receta ("Añadir los que faltan"), desde un lote agotado ("Reponer") o manualmente. Marcar como comprado. Al confirmar un ticket, se proponen como comprados los artículos coincidentes.
4. **Datos de entrada.** Producto, cantidad opcional, origen.
5. **Reglas de negocio.** Artículos duplicados del mismo producto se agrupan sumando cantidades si la unidad es compatible. Los opcionales de una receta se añaden solo si el usuario los marca.
6. **Resultado esperado.** Lista agrupada por categoría.
7. **Casos límite.** Unidades incompatibles del mismo producto (se mantienen como líneas separadas).
8. **Criterios de aceptación.** Un ticket que contiene "Leche" marca como comprada la leche de la lista, pendiente de confirmación del usuario.

---

## RF-12 Datos nutricionales de productos y recetas

1. **Nombre de la funcionalidad.** Datos nutricionales de productos y recetas.
2. **Objetivo.** Asociar a cada producto datos nutricionales identificados por fuente y calcular los de las recetas.
3. **Flujo principal de usuario.** En el detalle de un producto, ver datos nutricionales con su fuente; cambiar la fuente o introducir los de la etiqueta (manual o por foto de la tabla nutricional).
4. **Datos de entrada.** Energía (kcal), proteínas, carbohidratos, de los cuales azúcares, grasas, de las cuales saturadas, fibra, sal; base (100 g, 100 ml, unidad).
5. **Reglas de negocio.** RN-NUT-01 a RN-NUT-04. Para convertir de 100 ml a gramos se requiere densidad conocida.
6. **Resultado esperado.** Producto con datos o marcado "Sin datos".
7. **Casos límite.** Varias fuentes discrepantes (se prioriza la etiqueta del envase y se muestran las demás); producto cocinado frente a crudo (se registra el estado; el peso cocinado no se usa con datos de crudo sin factor de rendimiento).
8. **Criterios de aceptación.** Un valor con proteínas 30 g, carbohidratos 50 g y grasas 30 g por 100 g se rechaza por superar 100 g.

---

## RF-13 Estimación energética y objetivos

1. **Nombre de la funcionalidad.** Estimación energética y objetivos.
2. **Objetivo.** Proporcionar un rango calórico y de macronutrientes orientativo, transparente en su método.
3. **Flujo principal de usuario.** Al terminar el cuestionario, o desde "Perfil > Energía", ver el cálculo detallado y aceptarlo o ajustarlo manualmente dentro de límites.
4. **Datos de entrada.** Perfil (RF-02).
5. **Reglas de negocio.** Ver `05-motor-energetico-y-nutricional.md`. RN-NUT-05 y RN-NUT-06. Cada cálculo se guarda como instantánea con entradas y versión del método.
6. **Resultado esperado.** Pantalla con datos introducidos, método, metabolismo basal, gasto diario, objetivo, rango, macronutrientes y advertencias.
7. **Casos límite.** Sexo no indicado; porcentaje graso aportado; objetivo de pérdida con IMC bajo; usuario que fija manualmente un objetivo inferior al metabolismo basal (se rechaza con explicación).
8. **Criterios de aceptación.** Para mujer, 30 años, 165 cm, 60 kg: metabolismo basal 1320 kcal (Mifflin-St Jeor); con actividad moderada (1,55), gasto diario 2046 kcal.

---

## RF-14 Diario nutricional

1. **Nombre de la funcionalidad.** Diario nutricional.
2. **Objetivo.** Mostrar lo que el usuario ha ingerido y su relación con el objetivo.
3. **Flujo principal de usuario.** Pantalla "Hoy" con kcal y macronutrientes consumidos frente a objetivo, desglosados por comida. Añadir entradas desde consumos de despensa, recetas cocinadas o entradas libres (comida fuera de casa).
4. **Datos de entrada.** Entradas de consumo del usuario.
5. **Reglas de negocio.** RN-CON-01. Las entradas sin datos nutricionales se cuentan y se indica el porcentaje de entradas sin datos. Sin valoraciones morales ("bien", "mal"); se muestran cifras y diferencias.
6. **Resultado esperado.** Totales diarios y semanales.
7. **Casos límite.** Día sin registros (se muestra vacío, sin inferencias); entradas en otro huso horario (se asignan al día local del usuario).
8. **Criterios de aceptación.** Un consumo marcado como "Otras personas" no aparece en el diario.

---

## RF-15 Registro de peso e indicadores corporales

1. **Nombre de la funcionalidad.** Registro de peso e indicadores corporales.
2. **Objetivo.** Registrar la evolución corporal.
3. **Flujo principal de usuario.** Pulsar "Registrar peso", introducir valor, fecha y hora (por defecto ahora) y, opcionalmente, cintura, cadera, porcentaje graso, notas y condiciones de la medición (en ayunas, tras entrenar).
4. **Datos de entrada.** Peso (kg o lb), indicadores opcionales.
5. **Reglas de negocio.** Peso entre 30 y 300 kg; variación mayor de 3 kg respecto al registro anterior pide confirmación; varios registros en un día se conservan todos y la tendencia usa el primero de la mañana si está marcado, o la media del día.
6. **Resultado esperado.** Registro guardado y tendencia actualizada.
7. **Casos límite.** Registro retroactivo; eliminación de un registro erróneo (permitida, con auditoría).
8. **Criterios de aceptación.** Un peso de 700 kg se rechaza; un salto de 75 a 80 kg pide confirmación.

---

## RF-16 Tendencias y evolución

1. **Nombre de la funcionalidad.** Tendencias y evolución.
2. **Objetivo.** Mostrar la evolución de forma comprensible y sin sobreinterpretar fluctuaciones diarias.
3. **Flujo principal de usuario.** Pantalla "Progreso" con selector de periodo (4 semanas, 3 meses, 1 año, todo): gráfico de peso diario y tendencia, ritmo semanal, ingesta media frente a objetivo, desperdicio de alimentos.
4. **Datos de entrada.** Registros de peso, diario, movimientos.
5. **Reglas de negocio.** Tendencia por media móvil exponencial con factor 0,1 por día. El ritmo semanal se calcula con al menos 14 días de datos; antes se muestra "Datos insuficientes para calcular el ritmo". Resumen textual neutro: "Tendencia: -0,4 kg por semana en las últimas 4 semanas. Tu objetivo planteaba entre -0,3 y -0,6 kg por semana."
6. **Resultado esperado.** Gráficos y resumen.
7. **Casos límite.** Huecos de más de 7 días (la línea de tendencia se interrumpe); pocos registros.
8. **Criterios de aceptación.** Con menos de 14 días de datos no se muestra ritmo semanal.

---

## RF-17 Notificaciones

1. **Nombre de la funcionalidad.** Notificaciones.
2. **Objetivo.** Avisar de caducidades, tickets procesados y recordatorios configurados.
3. **Flujo principal de usuario.** Configurar en ajustes: avisos de caducidad (umbral en días, hora), recordatorio de registro de peso, aviso de ticket listo.
4. **Datos de entrada.** Preferencias, zona horaria.
5. **Reglas de negocio.** Un único resumen diario de caducidades a la hora elegida (no una notificación por producto). Texto en pantalla bloqueada sin datos de salud. Horario de silencio respetado.
6. **Resultado esperado.** Notificación "3 productos caducan en los próximos 2 días" que abre la despensa filtrada.
7. **Casos límite.** Permiso denegado (se muestran avisos dentro de la aplicación); cambio de zona horaria.
8. **Criterios de aceptación.** Con 5 productos próximos a caducar se recibe una sola notificación diaria.

---

## RF-18 Exportación de datos y eliminación de cuenta

1. **Nombre de la funcionalidad.** Exportación de datos y eliminación de cuenta.
2. **Objetivo.** Garantizar el control del usuario sobre sus datos.
3. **Flujo principal de usuario.**
   - Exportar: "Cuenta > Exportar mis datos"; se genera un archivo y se notifica con enlace de descarga.
   - Eliminar: "Cuenta > Eliminar cuenta"; reautenticación, explicación de plazos, confirmación escribiendo "ELIMINAR".
4. **Datos de entrada.** Reautenticación.
5. **Reglas de negocio.** Ver 8.1 de la especificación técnica. Durante los 7 días de gracia la cuenta está desactivada; iniciar sesión permite cancelar la eliminación.
6. **Resultado esperado.** Archivo ZIP con JSON y CSV por entidad e imágenes; cuenta purgada tras el plazo.
7. **Casos límite.** Exportación muy grande (se divide en partes); solicitud de eliminación con exportación en curso (se completa la exportación primero y se avisa).
8. **Criterios de aceptación.** CA-09 y CA-10 de la especificación técnica.
