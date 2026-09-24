# Diseño de pantallas

Estado: [DIS] diseño propuesto. No existen maquetas gráficas ni código de interfaz.

Navegación principal: barra inferior con cinco pestañas: Hoy, Despensa, Escanear (acción central), Recetas, Progreso. Perfil y ajustes se abren desde el icono de cuenta en la cabecera.

Convenciones de interfaz:

- Textos concisos, sin emojis ni símbolos decorativos.
- Los datos estimados llevan la etiqueta "Estimado"; los pendientes, "Pendiente"; los de baja confianza, "Revisar".
- La confianza se muestra con texto ("Alta", "Media", "Baja") además de color, para no depender solo del color.
- Tamaños táctiles mínimos de 44 x 44 puntos; compatibilidad con tamaño de texto dinámico y lectores de pantalla.

---

## P-01 Bienvenida, registro e inicio de sesión

1. **Nombre de la pantalla.** Bienvenida, registro e inicio de sesión.
2. **Objetivo.** Acceder a la aplicación o crear una cuenta.
3. **Componentes visuales.** Nombre de la aplicación y una frase de propósito; botones "Crear cuenta", "Iniciar sesión", "Continuar con Apple" y "Continuar con Google"; formularios de correo y contraseña con indicador de requisitos; casillas de consentimiento separadas (términos, datos de salud); enlace "He olvidado mi contraseña".
4. **Acciones disponibles.** Registrarse, iniciar sesión, iniciar sesión federada, recuperar contraseña, reenviar verificación.
5. **Estados.**
   - Normal: formulario vacío.
   - Carga: botón en estado de progreso, formulario bloqueado.
   - Error: mensaje bajo el campo o en cabecera ("Correo o contraseña incorrectos").
   - Pendiente de verificación: "Te hemos enviado un enlace a tu correo. Ábrelo para verificar la cuenta." con "Reenviar" (desactivado 60 s).
6. **Navegación relacionada.** Tras el registro, P-02; tras iniciar sesión con perfil completo, P-03.
7. **Validaciones y mensajes.** "Introduce un correo válido." "La contraseña debe tener al menos 12 caracteres." "Esta contraseña aparece en filtraciones conocidas. Elige otra." "Debes tener al menos 18 años para usar la aplicación." "Demasiados intentos. Vuelve a intentarlo en 5 minutos."

---

## P-02 Cuestionario inicial

1. **Nombre de la pantalla.** Cuestionario inicial.
2. **Objetivo.** Recoger el perfil corporal y alimentario (RF-02).
3. **Componentes visuales.** Barra de progreso por pasos (6 pasos); una pregunta o grupo corto por vista; selectores con descripción para niveles de actividad; lista de alérgenos con casillas y selector de severidad; campo libre para otros; resumen final editable.
4. **Acciones disponibles.** Siguiente, Atrás, Guardar y continuar más tarde, Editar desde el resumen, Finalizar.
5. **Estados.**
   - Normal: paso actual.
   - Vacío: no aplica.
   - Carga: al finalizar, "Calculando tu estimación".
   - Error: campo fuera de rango resaltado; error de red con "Reintentar" y datos conservados.
   - Aviso sanitario: si se marca una situación relevante, bloque informativo con el texto de RN-NUT-06.
6. **Navegación relacionada.** Al finalizar, P-14 (perfil energético); después, P-03.
7. **Validaciones y mensajes.** "La altura debe estar entre 100 y 250 cm." "El peso debe estar entre 30 y 300 kg." "Selecciona tu nivel de actividad." Texto de actividad: "Sedentario: trabajo sentado y menos de 5.000 pasos al día aproximadamente."

---

## P-03 Hoy (inicio)

1. **Nombre de la pantalla.** Hoy.
2. **Objetivo.** Resumen accionable del día.
3. **Componentes visuales.** Tarjeta de energía: kcal consumidas, rango objetivo, restante; barras de proteínas, carbohidratos y grasas; tarjeta "Caducan pronto" (hasta 3 productos y "Ver todos"); tarjeta "Tickets pendientes de revisar"; lista de comidas del día con sus entradas; accesos rápidos "Registrar consumo" y "Registrar peso".
4. **Acciones disponibles.** Abrir diario de una comida, añadir entrada, ir a productos por caducar, revisar ticket, registrar peso.
5. **Estados.**
   - Normal: datos del día.
   - Vacío: "Todavía no has registrado nada hoy." con botones de registro.
   - Carga: esqueletos de tarjeta.
   - Error: "No se han podido cargar los datos. Mostrando la última versión guardada." (datos locales).
6. **Navegación relacionada.** P-06, P-05, P-13, P-15.
7. **Validaciones y mensajes.** Si faltan datos nutricionales: "2 entradas sin datos nutricionales. Los totales pueden ser inferiores a la realidad."

---

## P-04 Captura de ticket

1. **Nombre de la pantalla.** Captura de ticket.
2. **Objetivo.** Obtener imágenes legibles (RF-03).
3. **Componentes visuales.** Vista de cámara con guía de encuadre y contorno detectado; indicador de calidad en texto; botón de captura; "Añadir otra parte"; tira de miniaturas; botón de linterna; "Importar de galería".
4. **Acciones disponibles.** Capturar, repetir, añadir parte, reordenar, eliminar parte, importar, procesar.
5. **Estados.**
   - Normal: cámara activa.
   - Vacío: sin capturas, botón "Procesar" desactivado.
   - Carga: "Subiendo 2 de 3 imágenes".
   - Error: sin permiso de cámara ("Necesitamos acceso a la cámara para fotografiar tickets. Puedes concederlo en Ajustes o importar una imagen."); subida fallida ("Se procesará cuando haya conexión.").
6. **Navegación relacionada.** Tras procesar, vuelve a la pantalla de origen con aviso "Procesando ticket"; la notificación lleva a P-05.
7. **Validaciones y mensajes.** "Poca luz. Activa la linterna o busca más iluminación." "Imagen movida. Mantén el teléfono quieto." "Este ticket parece ya procesado el 12/09/2026. ¿Quieres continuar?"

---

## P-05 Revisión de ticket

1. **Nombre de la pantalla.** Revisión de ticket.
2. **Objetivo.** Validar y corregir la lectura antes de añadir a la despensa (RF-04).
3. **Componentes visuales.**
   - Cabecera: tienda, fecha, hora, total, confianza de cada campo, botón "Ver imagen".
   - Banda de reconciliación: "Suma de líneas 43,20 / Total 43,20: coincide" o "Diferencia de 1,35: puede haber líneas no leídas".
   - Contador: "18 líneas: 14 listas, 3 para revisar, 1 requiere acción".
   - Lista de líneas. Cada línea: texto original en tipografía monoespaciada; interpretación (nombre, categoría, cantidad y unidad, tamaño de envase, importe, descuento); etiqueta de confianza; campos de caducidad y ubicación; menú de acciones.
   - Filtro: Todas, Requieren acción, Revisar, Listas, Excluidas.
   - Botón fijo inferior "Añadir 15 productos a la despensa".
4. **Acciones disponibles.** Aceptar, editar, elegir alternativa, dividir, combinar, excluir ("No es alimento"), descartar, recortar zona de imagen de la línea, escanear fecha del envase, aplicar ubicación a varias líneas, confirmar.
5. **Estados.**
   - Normal: lista de líneas.
   - Vacío: "No se ha detectado ninguna línea de producto. Repite la foto o añade los productos manualmente."
   - Carga: "Leyendo ticket" con progreso por etapas (texto, líneas, productos).
   - Error: OCR fallido ("No se ha podido leer el ticket. Prueba con más luz y el ticket estirado.") con "Repetir foto" y "Añadir manualmente".
   - Confirmación: resumen modal antes de crear lotes.
6. **Navegación relacionada.** Desde P-03, P-04 o notificación; al confirmar, P-06 filtrada por "Añadidos hoy".
7. **Validaciones y mensajes.**
   - Línea de baja confianza: "No hemos identificado este producto con seguridad. Texto leído: 'PAN RUST 4U'. Propuesta: Pan rústico, 4 unidades. Confirma o corrige."
   - Fecha ambigua: "La fecha 03/04/26 puede ser 3 de abril o 4 de marzo. Hemos supuesto 3 de abril de 2026 según la configuración de la tienda. Confírmala."
   - Producto a peso incoherente: "Peso 0,532 kg por 2,19 €/kg da 1,17, pero el importe leído es 1,71. Revisa el peso o el importe."
   - Botón de confirmar desactivado: "Quedan 1 línea que requiere acción."
   - Caducidad: "Sin fecha de caducidad. Quedará como pendiente."

---

## P-06 Despensa

1. **Nombre de la pantalla.** Despensa.
2. **Objetivo.** Consultar y gestionar existencias.
3. **Componentes visuales.** Buscador; segmentos por ubicación (Todo, Despensa, Frigorífico, Congelador); filtros (Caducan pronto, Caducados, Abiertos, Datos pendientes, Agotados); lista agrupada por categoría o por caducidad. Cada fila: nombre, cantidad disponible con unidad y proporción del envase ("375 g de 500 g"), número de lotes, fecha más próxima con tipo ("Cad. 26/09" o "C. pref. 30/10"), etiquetas de estado.
4. **Acciones disponibles.** Abrir detalle, consumir (deslizar o botón), añadir producto, escanear ticket, ordenar.
5. **Estados.**
   - Normal: lista.
   - Vacío: "Tu despensa está vacía. Escanea un ticket o añade productos manualmente."
   - Carga: esqueletos.
   - Error: datos locales con aviso de sincronización pendiente.
   - Sin resultados de búsqueda: "No hay productos que coincidan con 'arroz'."
6. **Navegación relacionada.** P-07, P-08, P-04, alta manual.
7. **Validaciones y mensajes.** Etiqueta en productos caducados: "Fecha pasada. Revísalo antes de consumirlo." En próximos a caducar: "Caduca en 2 días".

---

## P-07 Detalle de producto y lotes

1. **Nombre de la pantalla.** Detalle de producto.
2. **Objetivo.** Ver y gestionar lotes, datos nutricionales e historial de un producto.
3. **Componentes visuales.** Cabecera con nombre, categoría, total disponible; lista de lotes (cantidad inicial, disponible, fecha de compra, caducidad, ubicación, abierto, origen: ticket o manual); tamaño de envase y porción configurada; datos nutricionales con fuente; historial de movimientos del producto.
4. **Acciones disponibles.** Consumir, desechar, corregir cantidad, mover, combinar lotes, editar caducidad, configurar porción, editar datos nutricionales, ver ticket de origen, añadir a lista de compra.
5. **Estados.**
   - Normal.
   - Vacío (todos los lotes agotados): "Sin existencias. Último lote agotado el 20/09/2026." con "Añadir a la lista de compra".
   - Carga, Error: como en P-06.
6. **Navegación relacionada.** P-08, P-05 (ticket de origen), historial.
7. **Validaciones y mensajes.** Porción: "La porción debe ser mayor que 0 y no superar el tamaño del envase." Datos nutricionales: "La suma de macronutrientes supera 100 g por 100 g. Revisa los valores."

---

## P-08 Registrar consumo

1. **Nombre de la pantalla.** Registrar consumo (hoja modal).
2. **Objetivo.** Descontar una cantidad consumida (RF-06).
3. **Componentes visuales.** Selector de modo (Fracción, Cantidad, Porciones, Todo); botones 1/4, 1/2, 3/4, Otra; selector de referencia ("del envase de 1 kg" o "de lo que queda: 600 g"); vista previa "Se descontarán 250 g. Quedarán 750 g."; selector de lote con orden propuesto; selector de consumidor (Yo, Otras personas, Reparto); comida del día; fecha y hora.
4. **Acciones disponibles.** Elegir modo y valor, cambiar lote, cambiar consumidor, confirmar, cancelar.
5. **Estados.**
   - Normal.
   - Carga: botón en progreso.
   - Error de validación en línea.
   - Residuo: tras confirmar, si queda menos del 2 %: "Quedan 8 g. ¿Marcar el producto como agotado?" con "Mantener" y "Marcar como agotado".
6. **Navegación relacionada.** Vuelve a la pantalla de origen con aviso "Consumo registrado. Deshacer" durante 10 s.
7. **Validaciones y mensajes.** "La cantidad supera lo disponible (500 g)." "Este producto no tiene tamaño de envase. Indícalo o usa 'de lo que queda'." "No hay porción configurada para este producto. Indica la cantidad." "Introduce una cantidad mayor que 0."

---

## P-09 Recetas sugeridas

1. **Nombre de la pantalla.** Recetas sugeridas.
2. **Objetivo.** Elegir una receta adecuada (RF-09).
3. **Componentes visuales.** Filtros rápidos (comida del día, tiempo, dificultad, comensales); lista de tarjetas con nombre, kcal y proteínas por ración, tiempo, dificultad, "7 de 9 ingredientes disponibles", "Faltan 2", motivos ("Usa espinacas que caducan mañana").
4. **Acciones disponibles.** Abrir receta, cambiar filtros, guardar receta, ocultar receta.
5. **Estados.**
   - Normal.
   - Vacío por filtros: "Ninguna receta cumple los filtros actuales. El filtro más restrictivo es 'menos de 15 minutos'." con "Quitar filtro".
   - Vacío por despensa: "Tu despensa tiene pocos productos. Estas recetas requieren comprar la mayoría de ingredientes."
   - Carga, Error estándar.
6. **Navegación relacionada.** P-10.
7. **Validaciones y mensajes.** Aviso fijo cuando hay restricciones activas: "Filtrando por: sin gluten, alergia a frutos secos."

---

## P-10 Detalle de receta

1. **Nombre de la pantalla.** Detalle de receta.
2. **Objetivo.** Ver la receta, su encaje nutricional y qué hay que comprar.
3. **Componentes visuales.** Datos por ración (kcal, proteínas, carbohidratos, grasas) con indicador de cálculo completo o incompleto; selector de raciones; cuatro bloques de ingredientes (Disponibles, Parcialmente disponibles, Faltan, Opcionales o sustituibles), cada ingrediente con cantidad necesaria y, si procede, cantidad disponible y faltante; sustituciones; pasos numerados; bloque "Actualización de la despensa" con previsión de descuentos por lote.
4. **Acciones disponibles.** Cambiar raciones, aplicar sustitución, añadir faltantes a la lista de compra, "He cocinado esto".
5. **Estados.** Normal; Carga; Error; Cálculo incompleto ("No hay datos nutricionales de 1 ingrediente (40 g de 620 g). Valores calculados sobre el 94 % del peso.").
6. **Navegación relacionada.** P-11, P-12.
7. **Validaciones y mensajes.** Al cambiar a más raciones que las permitidas por la despensa: "Para 4 raciones faltan 200 g de pechuga de pollo."

---

## P-11 Confirmar cocinado

1. **Nombre de la pantalla.** Confirmar cocinado.
2. **Objetivo.** Registrar lo usado, lo comido y las sobras (RF-10).
3. **Componentes visuales.** Lista de ingredientes con lote propuesto y cantidad editable; campos raciones producidas, comensales, raciones que comes tú; destino de sobras (Guardar, Desechar, Consumidas por otros) con ubicación y caducidad; resumen de movimientos.
4. **Acciones disponibles.** Editar cantidades y lotes, confirmar, cancelar.
5. **Estados.** Normal; Carga; Error de validación; Confirmado ("Registrado. 3 raciones guardadas en el frigorífico.").
6. **Navegación relacionada.** Vuelve a P-10 o P-03.
7. **Validaciones y mensajes.** "Las raciones producidas deben ser al menos 1." "Las raciones que comes no pueden superar las producidas." "La cantidad de arroz supera lo disponible (150 g). Ajusta la cantidad o registra un ajuste de inventario."

---

## P-12 Lista de compra

1. **Nombre de la pantalla.** Lista de compra.
2. **Objetivo.** Gestionar lo que hay que comprar (RF-11).
3. **Componentes visuales.** Lista agrupada por categoría con casilla, nombre, cantidad y origen ("Receta: lentejas estofadas"); campo de alta rápida.
4. **Acciones disponibles.** Añadir, marcar comprado, editar, eliminar, compartir como texto.
5. **Estados.** Normal; Vacío ("No hay nada en la lista."); Carga; Error.
6. **Navegación relacionada.** P-10, P-06.
7. **Validaciones y mensajes.** "Este producto ya está en la lista. Se ha sumado la cantidad."

---

## P-13 Diario nutricional

1. **Nombre de la pantalla.** Diario.
2. **Objetivo.** Consultar y editar la ingesta del día (RF-14).
3. **Componentes visuales.** Selector de fecha; totales frente a rango objetivo; secciones por comida con entradas (nombre, cantidad, kcal, macronutrientes, origen); indicador de entradas sin datos.
4. **Acciones disponibles.** Añadir entrada, editar cantidad, eliminar entrada (si procede de un consumo de despensa, pregunta si también se revierte el movimiento), copiar comida de otro día.
5. **Estados.** Normal; Vacío ("Sin registros este día."); Carga; Error.
6. **Navegación relacionada.** P-03, P-08.
7. **Validaciones y mensajes.** "Esta entrada procede de un consumo de la despensa. ¿Quieres devolver también la cantidad a la despensa?"

---

## P-14 Perfil energético

1. **Nombre de la pantalla.** Perfil energético.
2. **Objetivo.** Mostrar la estimación con total transparencia (RF-13).
3. **Componentes visuales.** Bloques en orden: Datos introducidos; Método de cálculo con fórmula; Metabolismo basal estimado; Factor de actividad aplicado y su descripción; Gasto energético diario estimado; Objetivo seleccionado y ajuste aplicado; Rango calórico recomendado; Macronutrientes (g y porcentaje) con criterio; Advertencias y limitaciones; fecha del cálculo.
4. **Acciones disponibles.** Editar datos, recalcular, ajustar objetivo manualmente dentro de límites, ver historial de cálculos, aceptar recalibración propuesta.
5. **Estados.** Normal; Perfil incompleto ("Completa altura y peso para calcular la estimación."); Carga; Error; Modo solo referencia (RN-NUT-06).
6. **Navegación relacionada.** P-02, P-16.
7. **Validaciones y mensajes.** Texto fijo: "Estos valores son estimaciones basadas en fórmulas poblacionales, no una medición. Tu gasto real puede diferir en torno a un 10 % o más. No sustituyen la valoración de un profesional sanitario." "El objetivo no puede ser inferior a tu metabolismo basal estimado (1.320 kcal)."

---

## P-15 Registrar peso

1. **Nombre de la pantalla.** Registrar peso (hoja modal).
2. **Objetivo.** Registrar peso e indicadores (RF-15).
3. **Componentes visuales.** Campo numérico grande con unidad; fecha y hora; condiciones (en ayunas, tras despertar); indicadores opcionales desplegables.
4. **Acciones disponibles.** Guardar, cancelar.
5. **Estados.** Normal; Carga; Error; Confirmación de variación grande.
6. **Navegación relacionada.** P-16.
7. **Validaciones y mensajes.** "El peso debe estar entre 30 y 300 kg." "Este valor es 5,0 kg distinto del último registro (75,0 kg). ¿Es correcto?"

---

## P-16 Progreso

1. **Nombre de la pantalla.** Progreso.
2. **Objetivo.** Mostrar la evolución corporal y nutricional (RF-16).
3. **Componentes visuales.** Selector de periodo; gráfico de peso (puntos diarios y línea de tendencia); tarjeta de ritmo semanal frente al esperado; gráfico de ingesta media frente a objetivo; otros indicadores (cintura, porcentaje graso); tarjeta de desperdicio (cantidad e importe estimado).
4. **Acciones disponibles.** Cambiar periodo, ver registros, exportar CSV.
5. **Estados.** Normal; Vacío ("Registra tu peso para ver la evolución."); Datos insuficientes ("Se necesitan al menos 14 días de registros para calcular el ritmo semanal."); Carga; Error.
6. **Navegación relacionada.** P-15, P-14.
7. **Validaciones y mensajes.** Resumen neutro sin valoraciones: "Tendencia: -0,4 kg por semana en las últimas 4 semanas."

---

## P-17 Cuenta, privacidad y ajustes

1. **Nombre de la pantalla.** Cuenta y ajustes.
2. **Objetivo.** Gestionar cuenta, seguridad, privacidad y preferencias.
3. **Componentes visuales.** Datos de la cuenta; cambiar correo y contraseña; sesiones activas por dispositivo; consentimientos; unidades (métrico o imperial); formato de fecha; notificaciones; básicos declarados (sal, aceite, etc.); retención de imágenes de tickets; exportar datos; eliminar cuenta; cerrar sesión.
4. **Acciones disponibles.** Todas las indicadas.
5. **Estados.** Normal; Carga; Error; Exportación en curso ("Estamos preparando tus datos. Te avisaremos cuando estén listos."); Eliminación programada ("Tu cuenta se eliminará el 01/10/2026. Puedes cancelarlo hasta entonces.").
6. **Navegación relacionada.** Perfil (P-02 en modo edición), P-14.
7. **Validaciones y mensajes.** "Para eliminar la cuenta, vuelve a introducir tu contraseña." "Escribe ELIMINAR para confirmar." "Retirar el consentimiento de datos de salud desactivará el perfil energético y el seguimiento de peso. Tus registros se eliminarán en 30 días salvo que lo vuelvas a otorgar."
