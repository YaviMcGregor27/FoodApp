# Modelo de datos

Estado: fase F0. El esquema está en la migración `supabase/migrations/20260925000000_esquema_inicial.sql` y se prueba en integración continua sobre PostgreSQL 17 con `supabase/pruebas/` (alta de cuentas y edad mínima, consentimientos, aislamiento entre usuarios, privilegios, consumo parcial, rechazo de consumos superiores a lo disponible, control de concurrencia, inmutabilidad de movimientos, purga de cuenta). Todavía no está desplegado en un proyecto de Supabase.

## 1. Diagrama de relaciones

```
app_user 1---1 body_profile (versionado) 1---N energy_estimate
app_user 1---N dietary_restriction
app_user 1---N declared_staple
app_user 1---N body_measurement
app_user 1---N consent
app_user 1---N receipt 1---N receipt_line 0..1---0..1 pantry_lot
app_user 1---N user_product N---0..1 food 1---N food_nutrient
user_product 1---N product_alias
user_product 1---N pantry_lot 1---N inventory_movement N---0..1 consumption_event
consumption_event 1---0..1 cooking_log N---0..1 recipe 1---N recipe_ingredient
consumption_event 1---N intake_entry
app_user 1---N shopping_list_item
app_user 1---N notification
app_user 1---N audit_log
```

## 2. Decisiones de diseño

| Decisión | Motivo |
|---|---|
| Separar `food` (catálogo compartido) de `user_product` (cómo lo conoce el usuario). | El usuario puede llamar "Arroz del Mercadona" a un producto vinculado al genérico "Arroz blanco crudo". Sus correcciones no contaminan el catálogo de otros usuarios. |
| Lotes (`pantry_lot`) independientes por compra. | Diferentes caducidades, tamaños y precios (regla 18). |
| Libro de movimientos inmutable con `quantity_before` y `quantity_after`. | Trazabilidad completa y detección de conflictos de concurrencia: si `quantity_before` no coincide con la cantidad actual, el movimiento se rechaza (`CANTIDAD_DESACTUALIZADA`). |
| `available_quantity` materializada en el lote y actualizada solo por disparador al insertar un movimiento. | Lecturas rápidas de la despensa sin sumar el historial, manteniendo la invariante `disponible = inicial + suma(deltas)`. |
| Claves foráneas compuestas `(user_id, id)`. | Impiden por construcción que un lote de un usuario apunte a un producto o línea de ticket de otro, incluso ante un error del backend. |
| Políticas RLS para el rol `authenticated` basadas en `auth.uid()`, sin acceso para `anon` y privilegios mínimos. | Supabase concede por defecto todos los privilegios sobre tablas nuevas, incluido `TRUNCATE`, que no respeta RLS; la migración los retira y concede solo lo necesario. Las funciones del sistema (alta de cuenta, purga) se ejecutan con `SECURITY DEFINER` en el esquema `app`, que la API no expone. |
| Consumo y diario separados (`consumption_event` frente a `intake_entry`). | Lo que sale de la despensa no es necesariamente lo que come el usuario (regla de consumidor). |
| `energy_estimate` como instantánea con `inputs` en JSON. | Reproducibilidad: se puede explicar cualquier objetivo pasado con los datos y la versión del método usados. |
| Confianza por campo en `receipt_line.confidence` (JSON). | Cada campo (nombre, cantidad, importe) tiene su propia fiabilidad. |
| `raw_text` nunca se sobrescribe. | Requisito de conservar el texto original detectado. |
| Importes separados de cantidades. | El precio no se usa nunca para inferir cantidades. |

## 3. Diccionario de datos resumido

### 3.1 `pantry_lot`

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `unit` | `base_unit` | g, ml, ud o racion | Igual a la unidad del producto |
| `package_count` | entero | Número de envases del lote | > 0 |
| `package_size` | numeric | Tamaño de un envase en unidad base | > 0 o nulo (granel o desconocido) |
| `initial_quantity` | numeric | Cantidad comprada total | = `package_count x package_size` si ambos existen |
| `available_quantity` | numeric | Cantidad disponible | >= 0; solo la modifica un movimiento |
| `purchased_on` | date | Fecha de compra | No futura ni anterior a 2 años (validación de backend) |
| `date_kind` | enum | caducidad, consumo_preferente, sin_fecha, pendiente | `date_value` obligatorio solo en los dos primeros |
| `date_origin` | text | usuario, envase_escaneado, estimacion_aceptada | Nunca se rellena sin acción del usuario |
| `opened_at` | timestamptz | Momento de apertura | Se fija en el primer consumo |
| `status` | enum | disponible, abierto, agotado, descartado | `agotado` si y solo si `available_quantity = 0` (salvo `descartado`) |
| `version` | entero | Bloqueo optimista | Se incrementa en cada movimiento |

Estados derivados (no almacenados): `proximo_a_caducar` y `caducado`, calculados con la fecha actual en la zona horaria del usuario y el umbral configurado.

### 3.2 `inventory_movement`

| Campo | Descripción |
|---|---|
| `kind` | Tipo de movimiento (ver RF-08). El signo de `delta` está restringido por tipo. |
| `delta` | Variación en unidad base, distinta de cero. |
| `quantity_before`, `quantity_after` | Cantidades antes y después; `after = before + delta` y `after >= 0`. |
| `consumption_event_id` | Evento que agrupa varios movimientos (por ejemplo, una receta). |
| `receipt_line_id` | Línea de ticket de origen de una entrada por compra. |
| `reverses_movement_id` | Obligatorio en `correccion`. |
| `reason` | Motivo libre o codificado (residuo, error de lectura, caducado). |
| `actor` | usuario o sistema. |

Restricciones adicionales: `consumo_total` exige `quantity_after = 0`; `consumo_parcial` exige `quantity_after > 0`. Así, un lote no puede quedar a cero mediante un consumo marcado como parcial, ni marcarse como consumido totalmente si queda producto.

### 3.3 `receipt_line`

Conserva: `raw_text`, `proposed_name`, `proposed_category`, `quantity`, `unit`, `package_count`, `package_size`, `unit_price`, `price_per_kg`, `amount`, `discount`, `discount_raw_text`, `confidence` por campo, `alternatives`, `flags` y la `decision` del usuario. La fecha de compra se hereda de `receipt.purchased_at` junto con su confianza y el indicador `purchased_at_assumed`.

### 3.4 `body_profile` y `energy_estimate`

`body_profile` es versionado: cada cambio crea una nueva versión y un nuevo `energy_estimate`. `energy_estimate` guarda método, versión del método, metabolismo basal, factor, gasto diario, ajuste, rango objetivo, macronutrientes, advertencias, si es solo de referencia (RN-NUT-06) y si el usuario lo aceptó.

## 4. Operaciones transaccionales clave

Implementadas en la fase F1 como funciones de la base de datos (`supabase/migrations/20260927000000_despensa.sql`), que son la única vía para cambiar cantidades:

| Función | Qué hace |
|---|---|
| `alta_lote` | Crea el producto si no existe (mismo nombre y unidad se reutiliza), el lote y su movimiento `entrada_manual`. Valida nombre, cantidades y fechas. |
| `registrar_salida` | Consumo o desperdicio de una cantidad en unidad base, repartida entre lotes (abiertos, fecha más próxima, compra más antigua) o de un lote concreto. Idempotente. Señala residuos inferiores al 2 % del envase. |
| `ajustar_cantidad` | Corrección de la cantidad de un lote con motivo; con 0 y motivo «residuo» marca un resto como agotado. |
| `deshacer_evento` | Revierte un consumo, desperdicio o ajuste con movimientos `correccion` que referencian a los originales. No se puede deshacer dos veces ni si la cantidad ya se ha consumido después. |

Los movimientos y eventos guardan la hora exacta de registro (`clock_timestamp()`), para que el historial conserve el orden de los movimientos de una misma operación.

### 4.1 Confirmar ticket

```
BEGIN
  para cada línea aceptada o corregida:
    upsert user_product (si es nuevo)
    upsert product_alias (texto normalizado + cadena -> producto)
    insert pantry_lot (available = initial)
    insert inventory_movement (entrada_compra, before 0, after initial)
  update receipt set status = 'confirmado', confirmed_at = now()
COMMIT  (todo o nada)
```

### 4.2 Consumo repartido entre lotes

```
BEGIN
  insert consumption_event (idempotency_key del dispositivo)
  para cada lote en el orden de asignación:
    select available_quantity ... for update (lo hace el disparador)
    insert inventory_movement (consumo_parcial o consumo_total)
  si consumidor incluye al usuario: insert intake_entry con la parte del usuario
COMMIT
```

Si el `idempotency_key` ya existe, la operación devuelve el resultado anterior sin repetir el descuento.

## 5. Retención

| Dato | Retención |
|---|---|
| Imágenes de tickets | 90 días por defecto, configurable (0 = borrar al confirmar). |
| Movimientos, lotes, diario, medidas | Mientras la cuenta exista. |
| Cuenta eliminada | Purga en 7 días (`app.purge_user`); en las copias de seguridad, al caducar la retención del plan contratado. |
| `audit_log` | 2 años; tras la purga solo queda el registro `cuenta_purgada` sin datos personales. |
