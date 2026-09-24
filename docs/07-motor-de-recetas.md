# Motor de recetas y recomendaciones

Estado: [DIS] diseño propuesto. El filtro de seguridad, la clasificación de ingredientes y la puntuación existen como [PROTO] en `paquetes/dominio/src/recetas.ts` con pruebas en `paquetes/dominio/test/recetas.test.ts`. El catálogo de recetas, la generación asistida y la interfaz no están implementados.

## 1. Fuentes de recetas

| Fuente | Uso | Garantías |
|---|---|---|
| Catálogo curado | Principal | Ingredientes estructurados (alimento, cantidad, unidad, opcional, sustitutos, alérgenos), pasos, tiempo, dificultad, dietas. Revisado por el equipo. |
| Recetas del usuario | Platos habituales del usuario | Mismo formato; privadas. |
| Adaptación asistida [DIS, fase posterior] | Variar una receta curada para usar un producto de la despensa | El modelo de lenguaje solo propone cambios de ingredientes y pasos; la aplicación recalcula nutrientes con su propia base de datos, vuelve a aplicar el filtro de seguridad de forma determinista y marca la receta como "Adaptada automáticamente". |

## 2. Canal de recomendación

1. **Filtro de seguridad (estricto).** Se descartan recetas con ingredientes no opcionales que contengan un alérgeno declarado, una intolerancia (incluidas trazas si el usuario no las tolera) o que no cumplan una dieta declarada. Los opcionales conflictivos se retiran de la receta. No hay forma de relajar este filtro desde la interfaz.
2. **Filtros de contexto.** Tiempo máximo, dificultad máxima y tipo de comida. Se pueden relajar.
3. **Clasificación de ingredientes** para el número de raciones pedido:
   - Disponible: la despensa cubre la cantidad.
   - Parcialmente disponible: hay algo, pero no suficiente; se indica la cantidad que falta.
   - Falta: no hay existencias; se indica qué comprar y, si existen, sustitutos disponibles en la despensa.
   - Opcional o sustituible: se muestra aparte, con su disponibilidad.
   - Básico declarado: sal, aceite, especias u otros que el usuario ha declarado tener siempre; no se controla su cantidad y se muestra como tal.
   - Unidades distintas (por ejemplo, receta en gramos y despensa en unidades sin peso por unidad): se muestra como parcial con la nota "confirma si la cantidad disponible es suficiente".
4. **Puntuación** (0–100), ver sección 3.
5. **Presentación** con motivos legibles y datos por ración.

## 3. Puntuación

| Componente | Peso máximo | Cálculo |
|---|---|---|
| Caducidad próxima | 30 | 10 puntos por ingrediente usado cuya fecha más próxima está entre hoy y 3 días. Los productos con fecha ya pasada no suman: la aplicación no promueve su consumo. |
| Productos abiertos | 15 | 7,5 puntos por ingrediente usado con un lote abierto. |
| Cobertura de despensa | 25 | 25 x (disponibles + 0,5 x parciales) / ingredientes principales. |
| Ajuste nutricional | 20 | 20 x max(0, 1 - desviación relativa entre kcal por ración y kcal objetivo de la comida). Sin objetivo, 10 puntos neutros. |
| Preferencias | 10 | 5 base + 2,5 por ingrediente preferido - 5 por ingrediente rechazado no opcional, limitado a 0–10. |

`kcal objetivo de la comida = kcal restantes del día / comidas restantes del día` según el número habitual de comidas del perfil.

Adaptación por objetivo corporal [DIS, no incluida en el prototipo] (se aplica al conjunto de recetas y a los textos, no altera el filtro de seguridad):

| Objetivo | Criterio adicional |
|---|---|
| Pérdida de peso | Se prefieren recetas con proteína por ración >= 25 % del objetivo diario dividido entre comidas y con menor densidad calórica (kcal por 100 g de plato); se sugieren guarniciones de verdura. |
| Mantenimiento | Ajuste al rango y reparto equilibrado de macronutrientes. |
| Ganancia de peso | Se prefieren recetas con mayor densidad energética; se sugieren añadidos (frutos secos, aceite, lácteos) si no hay restricciones. |
| Ganancia muscular | Proteína por ración suficiente; en días de entrenamiento se priorizan comidas con carbohidratos. |
| Mantenimiento muscular | Proteína suficiente; se evitan sugerencias muy por debajo del rango. |

## 4. Registro de cocinado y actualización de la despensa

1. Para cada ingrediente disponible o parcial, se propone el reparto entre lotes con el orden de asignación RN-INV-10 (abiertos, caducidad próxima, compra antigua).
2. El usuario ajusta cantidades reales antes de confirmar.
3. Se crean movimientos `consumo_parcial` o `consumo_total` agrupados en un `consumption_event` de tipo `cocinado`.
4. Nutrientes por ración = total de ingredientes usados / raciones producidas.
5. Solo las raciones que come el usuario entran en su diario.
6. Las raciones sobrantes que se guardan crean un lote nuevo con unidad "racion", nutrientes por ración y caducidad pendiente de confirmar.

## 5. Sustituciones

Cada ingrediente puede declarar sustitutos con ratio de cantidad y nota. Criterios del catálogo curado:

- Mismo papel culinario (proteína, grasa, espesante, aromático).
- Sin introducir alérgenos del usuario (se filtran en tiempo de sugerencia).
- Ratio explícito (por ejemplo, 100 g de queso fresco por 100 g de tofu firme).
- Si la sustitución cambia significativamente las kcal por ración (más de un 15 %), se muestra el nuevo valor.

## 6. Casos límite

| Caso | Tratamiento |
|---|---|
| Despensa vacía | Recetas sencillas con todos los ingredientes en "Faltan" y aviso. |
| Ninguna receta pasa los filtros | Se indica el filtro de contexto más restrictivo; los filtros de seguridad no se ofrecen para relajar. |
| Ingrediente sin datos nutricionales | "Cálculo incompleto" con porcentaje de peso cubierto. |
| Producto caducado en la despensa | No suma en la puntuación; si la receta lo usaría, se muestra la advertencia de fecha pasada. |
| Receta para más comensales que la despensa permite | Los ingredientes pasan a parciales con la cantidad que falta. |

## 7. Plantilla de presentación de una receta

```
## Nombre de la receta

- Objetivo nutricional:
- Tiempo:
- Dificultad:
- Raciones:
- Kilocalorías por ración:
- Proteínas:
- Carbohidratos:
- Grasas:

### Ingredientes disponibles
### Ingredientes que faltan
### Sustituciones
### Preparación
### Actualización de la despensa
```

Ejemplo completo en `08-ejemplos-operativos.md`.
