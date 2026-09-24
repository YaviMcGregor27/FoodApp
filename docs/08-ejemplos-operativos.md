# Ejemplos operativos

Estado: ejemplo ilustrativo de cómo presenta la información la aplicación diseñada. No son datos reales de ningún usuario.

- Los cálculos de cantidades, energía y nutrientes se han obtenido ejecutando el prototipo (`prototipo/dominio/`).
- Los valores nutricionales por 100 g usados en la receta son valores de ejemplo aproximados, no verificados contra una fuente concreta. En la aplicación se obtendrían de la etiqueta del envase, Open Food Facts, CIQUAL o USDA FoodData Central (RN-NUT-01, DEC-05).
- Fecha de referencia del ejemplo: 24/09/2026.

---

## 1. Inventario tras confirmar un ticket y registrar consumos

Ticket de ejemplo del 24/09/2026 confirmado por el usuario. La línea "BOLSA 0,15" se excluyó como "No es alimento". Los lotes L-004, L-005 y L-006 proceden de compras anteriores.

| Producto | Categoría | Lote | Cantidad inicial | Cantidad disponible | Unidad | Fecha de compra | Caducidad | Estado | Confianza |
|---|---|---|---|---|---|---|---|---|---|
| Leche semidesnatada | Lácteos | L-001 (2 x 1000 ml) | 2000 | 1750 | ml | 24/09/2026 | Pendiente | Abierto | Alta (0,95) |
| Yogur natural | Lácteos | L-002 (6 x 125 g) | 750 | 625 | g | 24/09/2026 | 08/10/2026 (caducidad, introducida por el usuario) | Abierto | Media (0,80), confirmada |
| Plátano | Frutas | L-003 | 532 | 532 | g | 24/09/2026 | Sin fecha | Disponible | Alta (0,95) |
| Espinacas frescas | Verduras | L-004 | 300 | 150 | g | 22/09/2026 | 26/09/2026 (caducidad) | Abierto; próximo a caducar | Alta (alta manual) |
| Huevos | Huevos | L-005 | 12 | 8 | ud | 20/09/2026 | 10/10/2026 (consumo preferente) | Abierto | Alta (alta manual) |
| Arroz redondo | Cereales | L-006 | 1000 | 750 | g | 15/09/2026 | 01/06/2027 (consumo preferente) | Abierto | Alta (0,97) |
| Arroz redondo | Cereales | L-007 | 1000 | 1000 | g | 24/09/2026 | Pendiente | Disponible | Alta (0,97) |
| Pan rústico | Panadería | L-008 | 4 | 4 | ud | 24/09/2026 | Pendiente | Disponible | Baja (0,62), corregida por el usuario |
| Queso fresco | Lácteos | L-009 | 250 | 250 | g | 24/09/2026 | 30/09/2026 (caducidad) | Disponible | Alta (0,93) |
| Champiñones laminados | Verduras | L-010 | 250 | 250 | g | 24/09/2026 | 28/09/2026 (caducidad) | Disponible | Media (0,78), confirmada |

Observaciones:

- L-006 y L-007 son el mismo producto en lotes separados: fechas y apertura distintas (regla 18). Un consumo de arroz se asignará primero a L-006 (abierto).
- L-008: el texto leído era "PAN RUST 4U" con confianza baja; el usuario confirmó "Pan rústico, 4 unidades". El peso por unidad está pendiente, por lo que no se puede usar en recetas expresadas en gramos sin confirmarlo.
- Las caducidades "Pendiente" no se han inventado: el ticket no las contiene.

## 2. Registro de consumos

| Fecha | Producto o receta | Cantidad consumida | Unidad | Cantidad restante | Tipo de operación | Notas |
|---|---|---|---|---|---|---|
| 22/09/2026 | Espinacas frescas (L-004) | 150 | g | 150 | Consumo parcial | Cantidad exacta. Consumidor: usuario. |
| 23/09/2026 | Huevos (L-005) | 4 | ud | 8 | Consumo parcial | Consumidor: reparto 1 de 2; al diario del usuario van 2 ud. |
| 23/09/2026 | Arroz redondo (L-006) | 250 | g | 750 | Consumo parcial | Fracción 1/4 del envase de 1000 g. |
| 24/09/2026 | Leche semidesnatada (L-001) | 250 | ml | 1750 | Consumo parcial | Fracción 1/4 de un envase de 1000 ml; el lote tenía 2000 ml. |
| 24/09/2026 | Yogur natural (L-002) | 125 | g | 625 | Consumo parcial | 1 porción configurada de 125 g (1 unidad del pack). |
| 24/09/2026 | Tortilla de espinacas y champiñones (receta) | Ver sección 4 | — | — | Cocinado | 2 raciones; 1 consumida por el usuario, 1 por otra persona. |
| 24/09/2026 | Espinacas frescas (L-004) | 150 | g | 0 | Consumo total | Parte del cocinado; el lote pasa a agotado. |
| 24/09/2026 | Huevos (L-005) | 4 | ud | 4 | Consumo parcial | Parte del cocinado. |
| 24/09/2026 | Champiñones laminados (L-010) | 125 | g | 125 | Consumo parcial | Parte del cocinado; fracción 1/2 del envase. |
| 24/09/2026 | Queso fresco (L-009) | 80 | g | 170 | Consumo parcial | Parte del cocinado. |

Ejemplo de validación: si el usuario intenta consumir 200 g de espinacas del lote L-004 con 150 g disponibles, la aplicación muestra "La cantidad supera lo disponible (150 g)" y no registra nada.

## 3. Perfil energético

**Datos introducidos**

| Dato | Valor |
|---|---|
| Edad | 34 años |
| Sexo | Mujer |
| Altura | 168 cm |
| Peso actual | 68 kg |
| Actividad diaria | Trabajo sentado |
| Entrenamiento | Fuerza, 3 sesiones por semana de 60 minutos |
| Nivel de actividad | Moderado (propuesto por la aplicación, confirmado por el usuario) |
| Objetivo | Perder peso, ritmo conservador |
| Objetivo adicional | Mantener masa muscular |
| Comidas al día | 4 |
| Restricciones | Ninguna declarada |
| Situaciones relevantes | Ninguna |

**Método de cálculo**

Mifflin-St Jeor: `TMB = 10 x 68 + 6,25 x 168 - 5 x 34 - 161`.

**Metabolismo basal estimado**

1.399 kcal/día.

**Gasto energético diario estimado**

1.399 x 1,55 (moderado: ejercicio moderado 3 a 5 días por semana) = 2.168 kcal/día. Margen de incertidumbre +-10 %: entre 1.952 y 2.385 kcal/día.

**Objetivo seleccionado**

Perder peso con ritmo conservador: ajuste del -10 % sobre el gasto estimado, conservando la masa muscular.

**Rango calórico recomendado**

Objetivo 1.952 kcal/día; rango 1.854–2.049 kcal/día. El límite inferior no baja del metabolismo basal estimado.

**Objetivo aproximado de macronutrientes**

| Macronutriente | Cantidad diaria | Criterio |
|---|---|---|
| Proteínas | 109–150 g (referencia media 129 g, aproximadamente 26 % de la energía) | 1,6–2,2 g/kg por objetivo de pérdida y mantenimiento muscular |
| Grasas | 54 g (25 % de la energía) | 25 % del objetivo, mínimo 0,6 g/kg |
| Carbohidratos | 238 g (aproximadamente 49 % de la energía) | Resto de la energía |

Por comida (4 al día): unas 490 kcal y unos 32 g de proteína, como orientación.

**Advertencias y limitaciones**

- Estos valores son estimaciones basadas en fórmulas poblacionales, no una medición. El gasto real puede diferir en torno a un 10 % o más.
- No sustituyen la valoración de un profesional sanitario.
- Tras al menos 21 días de registros de peso e ingesta, la aplicación podrá proponer una recalibración con los datos observados, que el usuario decidirá si acepta.

## 4. Receta sugerida

Motivos mostrados: "Usa 1 producto con fecha próxima: Espinacas frescas", "Aprovecha 2 productos abiertos", "4 de 5 ingredientes principales disponibles".

## Tortilla de espinacas y champiñones con queso fresco

- Objetivo nutricional: comida principal compatible con pérdida de peso y mantenimiento muscular; aporte proteico ligeramente inferior a la orientación por comida (28,5 g frente a unos 32 g).
- Tiempo: 20 minutos.
- Dificultad: baja.
- Raciones: 2.
- Kilocalorías por ración: 445 kcal (297 kcal sin el pan).
- Proteínas: 28,5 g por ración (22,7 g sin el pan).
- Carbohidratos: 27,8 g por ración (3,2 g sin el pan).
- Grasas: 22,9 g por ración (20,9 g sin el pan).

Cálculo completo: 100 % del peso de ingredientes con datos nutricionales (valores de ejemplo, ver nota inicial). El peso por huevo (55 g) debe estar confirmado por el usuario en el producto; si no lo está, la aplicación lo pide antes de calcular.

### Ingredientes disponibles

| Ingrediente | Cantidad para 2 raciones | Lote | Disponible antes |
|---|---|---|---|
| Huevos | 4 ud (220 g) | L-005 | 8 ud |
| Espinacas frescas | 150 g | L-004 | 150 g |
| Champiñones laminados | 125 g | L-010 | 250 g |
| Queso fresco | 80 g | L-009 | 250 g |
| Aceite de oliva | 10 ml | Básico declarado | Sin control de cantidad |
| Sal y pimienta | Al gusto | Básico declarado | Sin control de cantidad |

### Ingredientes que faltan

| Ingrediente | Cantidad | Tipo |
|---|---|---|
| Pan integral | 120 g | Acompañamiento; sustituible (ver sustituciones) |
| Cebollino fresco | 5 g | Opcional |

### Sustituciones

- Pan integral: se puede usar el pan rústico de la despensa (L-008). Su peso por unidad está pendiente; indica cuánto pesa una unidad para recalcular las kcal. Si se prescinde del pan, la ración baja a 297 kcal.
- Queso fresco: tofu firme en la misma cantidad (si no hay restricción a la soja).
- Champiñones: calabacín en dados en la misma cantidad.

### Preparación

1. Lavar las espinacas y escurrirlas bien.
2. Calentar el aceite en una sartén antiadherente de 24 cm a fuego medio y saltear los champiñones 4 minutos.
3. Añadir las espinacas y cocinar 2 minutos hasta que reduzcan su volumen. Salpimentar.
4. Batir los huevos con una pizca de sal y añadir el queso fresco desmenuzado.
5. Verter el huevo sobre la verdura, bajar el fuego y cuajar 4 minutos con la sartén tapada.
6. Dar la vuelta con ayuda de un plato y cocinar 2 minutos más.
7. Cortar en 2 raciones iguales y servir con el pan, si se usa.

### Actualización de la despensa

Propuesta que el usuario confirma o ajusta en "Confirmar cocinado":

| Lote | Producto | Antes | Descuento | Después | Movimiento | Estado del lote |
|---|---|---|---|---|---|---|
| L-005 | Huevos | 8 ud | 4 ud | 4 ud | Consumo parcial | Abierto |
| L-004 | Espinacas frescas | 150 g | 150 g | 0 g | Consumo total | Agotado |
| L-010 | Champiñones laminados | 250 g | 125 g | 125 g | Consumo parcial | Abierto |
| L-009 | Queso fresco | 250 g | 80 g | 170 g | Consumo parcial | Abierto |
| — | Aceite de oliva | — | — | — | Sin movimiento (básico declarado) | — |

Permanecen disponibles: huevos (4 ud), champiñones (125 g, caducidad 28/09/2026), queso fresco (170 g, caducidad 30/09/2026) y el resto de la despensa sin cambios.

Registro de raciones: 2 producidas, 2 comensales, 1 ración consumida por el usuario. Al diario del usuario se añade 1 ración (445 kcal con pan o 297 kcal sin pan, según lo que indique). No quedan sobras, por lo que no se crea lote de sobras.
