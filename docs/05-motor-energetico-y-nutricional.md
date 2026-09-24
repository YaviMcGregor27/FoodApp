# Motor energético y nutricional

Estado: [DIS] diseño propuesto; los cálculos descritos están implementados como [PROTO] en `paquetes/dominio/src/energia.ts` y `paquetes/dominio/src/nutricion.ts`, con pruebas en `paquetes/dominio/test/energia.test.ts`. Versión del método: `2026.1`.

Todos los resultados de este módulo son estimaciones poblacionales. No son una medición médica ni sustituyen la valoración de un profesional sanitario.

## 1. Metabolismo basal

| Método | Cuándo se usa | Fórmula |
|---|---|---|
| Mifflin-St Jeor | Por defecto | `TMB = 10 x peso (kg) + 6,25 x altura (cm) - 5 x edad + s`, con `s = +5` (hombre), `-161` (mujer), `-78` (sexo no indicado: punto medio de ambas constantes) |
| Katch-McArdle | Si el usuario aporta un porcentaje de grasa medido e indica el método de medición | `TMB = 370 + 21,6 x masa magra (kg)`, con `masa magra = peso x (1 - grasa / 100)` |

Motivo de la elección: Mifflin-St Jeor es la ecuación predictiva con mejor exactitud documentada en adultos no hospitalizados entre las de uso habitual, con errores individuales que en una fracción relevante de personas superan el 10 %. Katch-McArdle depende de la calidad de la medición de grasa; las básculas de bioimpedancia domésticas tienen errores notables, por lo que la aplicación indica el método de medición junto al resultado.

## 2. Nivel de actividad

| Nivel | Factor | Descripción mostrada |
|---|---|---|
| Sedentario | 1,2 | Trabajo sentado y poco o ningún ejercicio. |
| Ligero | 1,375 | Ejercicio ligero 1 a 3 días por semana o trabajo de pie. |
| Moderado | 1,55 | Ejercicio moderado 3 a 5 días por semana. |
| Alto | 1,725 | Ejercicio intenso 6 a 7 días por semana. |
| Muy alto | 1,9 | Ejercicio muy intenso a diario o trabajo físico exigente más entrenamiento. |

Propuesta automática (el usuario la confirma o la cambia): se parte de la actividad diaria (sentado = 0, de pie = 1, trabajo físico = 2) y se suma según minutos semanales de entrenamiento (< 60: 0; 60–179: 1; 180–299: 2; >= 300: 3). El resultado, limitado a 4, indexa la tabla anterior. Ejemplo: trabajo sentado y 3 sesiones de 60 minutos (180 min) = nivel 2, moderado.

## 3. Gasto energético diario

`GET = TMB x factor de actividad`.

Margen de incertidumbre mostrado: +-10 % (+-15 % si el sexo no se indica y se usa Mifflin-St Jeor).

## 4. Ajuste según objetivo

| Objetivo | Ritmo conservador (por defecto) | Ritmo moderado |
|---|---|---|
| Perder peso | -10 % del GET | -20 % del GET |
| Mantener | 0 % | 0 % |
| Ganar peso | +5 % del GET | +10 % del GET |

Rango recomendado: objetivo +-5 %, con límite inferior en el metabolismo basal estimado (RN-NUT-05).

El objetivo secundario no cambia las kcal en esta versión; modifica la proteína (sección 5) y el texto de recomendaciones:

| Objetivo secundario | Efecto |
|---|---|
| Ganar músculo | Proteína alta; con objetivo "mantener" se explica que el progreso será más lento que con un superávit ligero. |
| Mantener masa muscular | Proteína alta; se desaconsejan ritmos de pérdida superiores al moderado. |
| Rendimiento u otro | Sin cambios numéricos; se recomienda valoración profesional si hay competición. |

## 5. Macronutrientes

| Macronutriente | Criterio |
|---|---|
| Proteína | 1,6–2,2 g/kg si el objetivo es perder peso o el objetivo secundario es ganar o mantener músculo; 1,2–1,6 g/kg en los demás casos. Con IMC > 30 se usa como referencia el peso correspondiente a IMC 25 para no sobrestimar la necesidad. |
| Grasa | 25 % de las kcal objetivo, con un mínimo de 0,6 g/kg de peso de referencia. |
| Carbohidratos | Resto de la energía tras restar la proteína (valor medio del rango) y la grasa. Si resultan menos de 50 g, se muestra una advertencia. |

## 6. Situaciones que desactivan el déficit o superávit (RN-NUT-06)

Si el usuario declara embarazo, lactancia, enfermedad crónica relevante para la alimentación, medicación que afecte al peso o al apetito o antecedentes de trastorno de la conducta alimentaria, o si su IMC es inferior a 18,5 y el objetivo es perder peso:

- El ajuste se fija en 0 %.
- El resultado se marca como "Solo referencia".
- Se muestra: "Con la información indicada, te recomendamos consultar con un profesional sanitario antes de fijar un objetivo de pérdida o ganancia de peso. Mostramos una estimación de mantenimiento solo como referencia."
- La aplicación no hace diagnósticos ni valoraciones clínicas.

## 7. Recalibración con datos reales [DIS]

Tras al menos 21 días con registro de peso en al menos 14 de ellos y registro de ingesta con cobertura de datos nutricionales superior al 80 % en al menos 14 de ellos:

`GET observado = ingesta media diaria - (cambio de tendencia de peso en kg x 7700) / días`

- El factor de 7700 kcal/kg es una aproximación; se muestra como tal.
- Si el GET observado difiere del estimado en más de un 10 %, se propone al usuario actualizar el objetivo. Nunca se aplica automáticamente.
- Si la ingesta registrada es incompleta, el resultado se descarta y se indica el motivo.

## 8. Tendencia de peso

Media móvil exponencial con factor 0,1 por día sobre el peso diario (primer registro de la mañana si está marcado, o media del día). El ritmo semanal se calcula como la pendiente de la tendencia en las últimas 4 semanas, con un mínimo de 14 días de datos.

## 9. Datos nutricionales

| Regla | Detalle |
|---|---|
| Fuente | Cada valor guarda su fuente y su base (100 g, 100 ml, unidad, ración). |
| Prioridad | Etiqueta del envase > Open Food Facts (por código de barras) > CIQUAL > USDA FoodData Central > introducido por el usuario sin etiqueta. BEDCA no se usa sin autorización de AESAN (DEC-05). |
| Coherencia de masa | Proteínas + carbohidratos + grasas + fibra + alcohol <= 102 g por 100 g. Azúcares <= carbohidratos. Saturadas <= grasas. |
| Coherencia energética | `4P + 4C + 9G + 2 fibra + 7 alcohol` dentro de +-15 % (o +-10 kcal) de las kcal declaradas; si no, se marca para revisión. |
| Sin datos | Se muestra "Sin datos"; los totales indican el porcentaje del peso cubierto. |
| Estado de cocción | Los valores de crudo no se aplican a pesos cocinados sin un factor de rendimiento confirmado. |
| Volumen a masa | Solo con densidad conocida. |

## 10. Plantilla de presentación del perfil energético

La pantalla P-14 y cualquier respuesta sobre el perfil energético siguen este orden:

- Datos introducidos.
- Método de cálculo.
- Metabolismo basal estimado.
- Gasto energético diario estimado.
- Objetivo seleccionado.
- Rango calórico recomendado.
- Objetivo aproximado de macronutrientes.
- Advertencias y limitaciones.

Un ejemplo completo calculado con el prototipo está en `08-ejemplos-operativos.md`.
