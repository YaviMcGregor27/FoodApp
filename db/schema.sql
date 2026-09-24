-- FoodApp: esquema de referencia para PostgreSQL 16.
-- Estado: Diseño propuesto. Validado sintácticamente y con pruebas de aislamiento
-- en `db/test_rls.sql`; no desplegado en ningún entorno.
--
-- Convenciones:
--   * Cantidades en unidad base: g (masa), ml (volumen), ud (unidades), racion (sobras).
--   * NUMERIC(12,3) para cantidades; NUMERIC(12,2) para importes.
--   * Toda tabla con datos personales tiene user_id y política RLS aplicada a todos
--     los roles (FORCE ROW LEVEL SECURITY), incluido el propietario. Los procesos
--     internos (OCR, notificaciones, purga) también fijan app.user_id y actúan en
--     nombre de un único usuario. Solo un superusuario (migraciones) la omite.
--   * El usuario autenticado se obtiene de app.current_user_id(), que el backend
--     fija por transacción con: SET LOCAL app.user_id = '<uuid del token>'.
--     Con un proveedor que exponga auth.uid() (por ejemplo Supabase) se sustituye
--     el cuerpo de la función.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

-- Rol con el que se conecta el backend en nombre de usuarios finales.
-- No es propietario de las tablas, por lo que RLS siempre se aplica.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user_role') THEN
    CREATE ROLE app_user_role NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA app TO app_user_role;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO app_user_role;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

CREATE TYPE base_unit AS ENUM ('g', 'ml', 'ud', 'racion');

CREATE TYPE sex_option AS ENUM ('mujer', 'hombre', 'no_indicado');

CREATE TYPE activity_level AS ENUM ('sedentario', 'ligero', 'moderado', 'alto', 'muy_alto');

CREATE TYPE weight_goal AS ENUM ('perder', 'mantener', 'ganar');

CREATE TYPE secondary_goal AS ENUM ('ganar_musculo', 'mantener_musculo', 'rendimiento', 'ninguno', 'otro');

CREATE TYPE restriction_kind AS ENUM ('alergia', 'intolerancia', 'dieta', 'rechazo', 'preferencia');

CREATE TYPE receipt_status AS ENUM ('capturado', 'procesando', 'pendiente_revision', 'confirmado', 'descartado', 'error');

CREATE TYPE line_decision AS ENUM ('pendiente', 'aceptada', 'corregida', 'excluida_no_alimento', 'descartada', 'devolucion');

CREATE TYPE date_kind AS ENUM ('caducidad', 'consumo_preferente', 'sin_fecha', 'pendiente');

CREATE TYPE storage_location AS ENUM ('despensa', 'frigorifico', 'congelador', 'otra');

CREATE TYPE lot_status AS ENUM ('disponible', 'abierto', 'agotado', 'descartado');

CREATE TYPE movement_kind AS ENUM (
  'entrada_compra', 'entrada_manual', 'entrada_sobras',
  'consumo_parcial', 'consumo_total', 'desperdicio',
  'correccion', 'ajuste', 'caducidad',
  'transferencia_entrada', 'transferencia_salida'
);

CREATE TYPE consumer_kind AS ENUM ('usuario', 'otros', 'reparto');

CREATE TYPE consumption_kind AS ENUM ('individual', 'cocinado', 'desperdicio', 'ajuste');

CREATE TYPE nutrient_source AS ENUM ('etiqueta', 'open_food_facts', 'bedca', 'usda_fdc', 'ciqual', 'usuario', 'calculado');

CREATE TYPE nutrient_basis AS ENUM ('100g', '100ml', 'unidad', 'racion');

-- ---------------------------------------------------------------------------
-- Cuenta y perfil
-- ---------------------------------------------------------------------------

CREATE TABLE app_user (
  id                uuid PRIMARY KEY,             -- identificador del proveedor OIDC
  email             text NOT NULL UNIQUE,
  email_verified_at timestamptz,
  locale            text NOT NULL DEFAULT 'es-ES',
  time_zone         text NOT NULL DEFAULT 'Europe/Madrid',
  unit_system       text NOT NULL DEFAULT 'metrico' CHECK (unit_system IN ('metrico', 'imperial')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  deletion_requested_at timestamptz,
  deleted_at        timestamptz
);

CREATE TABLE consent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('terminos', 'datos_salud', 'notificaciones', 'acceso_soporte')),
  text_version text NOT NULL,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE body_profile (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  version              integer NOT NULL,
  birth_date           date NOT NULL,
  sex                  sex_option NOT NULL DEFAULT 'no_indicado',
  height_cm            numeric(5,1) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  weight_kg            numeric(5,2) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  body_fat_pct         numeric(4,1) CHECK (body_fat_pct BETWEEN 3 AND 70),
  body_fat_method      text,
  activity             activity_level NOT NULL,
  training_sessions_per_week smallint NOT NULL DEFAULT 0 CHECK (training_sessions_per_week BETWEEN 0 AND 14),
  training_types       text[] NOT NULL DEFAULT '{}',
  training_minutes_avg smallint CHECK (training_minutes_avg BETWEEN 0 AND 600),
  goal                 weight_goal NOT NULL,
  goal_secondary       secondary_goal NOT NULL DEFAULT 'ninguno',
  goal_secondary_other text,
  goal_pace            text CHECK (goal_pace IN ('conservador', 'moderado')),
  meals_per_day        smallint NOT NULL CHECK (meals_per_day BETWEEN 1 AND 8),
  cooking_time_min     smallint CHECK (cooking_time_min BETWEEN 0 AND 480),
  usual_diners         smallint CHECK (usual_diners BETWEEN 1 AND 20),
  -- Situaciones que requieren atención profesional (RN-NUT-06). Cifrado a nivel de campo en la aplicación.
  medical_flags        text[] NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, version),
  CHECK (birth_date >= date '1900-01-01')  -- mayoría de edad validada en el backend (depende de la fecha actual)
);

CREATE TABLE dietary_restriction (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind            restriction_kind NOT NULL,
  code            text NOT NULL,           -- p. ej. 'gluten', 'frutos_de_cascara', 'lactosa', 'vegana'
  severity        text CHECK (severity IN ('leve', 'moderada', 'grave')),
  tolerates_traces boolean NOT NULL DEFAULT false,
  notes           text,                    -- cifrado a nivel de campo
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, code)
);

CREATE TABLE declared_staple (
  user_id  uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  food_code text NOT NULL,                 -- p. ej. 'sal', 'aceite_oliva', 'pimienta'
  PRIMARY KEY (user_id, food_code)
);

CREATE TABLE energy_estimate (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  body_profile_id  uuid NOT NULL REFERENCES body_profile(id) ON DELETE CASCADE,
  method           text NOT NULL,          -- 'mifflin_st_jeor' | 'katch_mcardle' | 'recalibrado'
  method_version   text NOT NULL,
  bmr_kcal         integer NOT NULL CHECK (bmr_kcal > 0),
  activity_factor  numeric(4,3) NOT NULL CHECK (activity_factor BETWEEN 1.0 AND 2.5),
  tdee_kcal        integer NOT NULL CHECK (tdee_kcal > 0),
  adjustment_pct   numeric(5,2) NOT NULL,
  target_kcal_min  integer NOT NULL,
  target_kcal_max  integer NOT NULL,
  protein_g_min    integer NOT NULL,
  protein_g_max    integer NOT NULL,
  fat_g_min        integer NOT NULL,
  carbs_g          integer NOT NULL,
  reference_only   boolean NOT NULL DEFAULT false,
  warnings         text[] NOT NULL DEFAULT '{}',
  inputs           jsonb NOT NULL,
  accepted_by_user boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (target_kcal_min <= target_kcal_max),
  CHECK (target_kcal_min >= bmr_kcal)
);

CREATE TABLE body_measurement (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  measured_at  timestamptz NOT NULL,
  weight_kg    numeric(5,2) CHECK (weight_kg BETWEEN 30 AND 300),
  waist_cm     numeric(5,1) CHECK (waist_cm BETWEEN 30 AND 250),
  hip_cm       numeric(5,1) CHECK (hip_cm BETWEEN 30 AND 250),
  body_fat_pct numeric(4,1) CHECK (body_fat_pct BETWEEN 3 AND 70),
  fasted       boolean,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (coalesce(weight_kg, waist_cm, hip_cm, body_fat_pct) IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- Catálogo compartido (solo lectura para usuarios)
-- ---------------------------------------------------------------------------

CREATE TABLE food (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  category      text NOT NULL,
  barcode       text,
  brand         text,
  allergens     text[] NOT NULL DEFAULT '{}',
  trace_allergens text[] NOT NULL DEFAULT '{}',
  diet_flags    text[] NOT NULL DEFAULT '{}',   -- 'vegano', 'vegetariano', 'sin_gluten'...
  density_g_per_ml numeric(6,3) CHECK (density_g_per_ml > 0),
  source        nutrient_source NOT NULL,
  source_ref    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_name_trgm ON food USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX food_barcode_uq ON food (barcode) WHERE barcode IS NOT NULL;

CREATE TABLE food_nutrient (
  food_id      uuid NOT NULL REFERENCES food(id) ON DELETE CASCADE,
  basis        nutrient_basis NOT NULL,
  energy_kcal  numeric(7,2) NOT NULL CHECK (energy_kcal >= 0),
  protein_g    numeric(6,2) NOT NULL CHECK (protein_g >= 0),
  carbs_g      numeric(6,2) NOT NULL CHECK (carbs_g >= 0),
  sugars_g     numeric(6,2) CHECK (sugars_g >= 0),
  fat_g        numeric(6,2) NOT NULL CHECK (fat_g >= 0),
  saturated_g  numeric(6,2) CHECK (saturated_g >= 0),
  fiber_g      numeric(6,2) CHECK (fiber_g >= 0),
  salt_g       numeric(6,2) CHECK (salt_g >= 0),
  needs_review boolean NOT NULL DEFAULT false,  -- resultado de RN-NUT-02/03
  PRIMARY KEY (food_id, basis),
  CHECK (sugars_g IS NULL OR sugars_g <= carbs_g),
  CHECK (saturated_g IS NULL OR saturated_g <= fat_g),
  CHECK (basis NOT IN ('100g', '100ml') OR protein_g + carbs_g + fat_g + coalesce(fiber_g, 0) <= 102)
);

-- ---------------------------------------------------------------------------
-- Productos del usuario y normalización
-- ---------------------------------------------------------------------------

CREATE TABLE user_product (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  food_id         uuid REFERENCES food(id),
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  category        text NOT NULL,
  unit            base_unit NOT NULL,
  default_package_size numeric(12,3) CHECK (default_package_size > 0),
  grams_per_unit  numeric(12,3) CHECK (grams_per_unit > 0),   -- solo si confirmado
  portion_size    numeric(12,3) CHECK (portion_size > 0),     -- configurado por el usuario
  -- Datos nutricionales propios (etiqueta) cuando no se usa el catálogo.
  own_nutrients   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id)
);
CREATE INDEX user_product_name_trgm ON user_product USING gin (name gin_trgm_ops);

CREATE TABLE product_alias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  store_chain     text NOT NULL DEFAULT '*',
  raw_text_norm   text NOT NULL,          -- texto de ticket en mayúsculas, sin dobles espacios
  user_product_id uuid NOT NULL,
  times_confirmed integer NOT NULL DEFAULT 1 CHECK (times_confirmed > 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_chain, raw_text_norm),
  FOREIGN KEY (user_id, user_product_id) REFERENCES user_product(user_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

CREATE TABLE receipt (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status           receipt_status NOT NULL DEFAULT 'capturado',
  store_name       text,
  store_chain      text,
  purchased_at     timestamptz,
  purchased_at_confidence numeric(3,2) CHECK (purchased_at_confidence BETWEEN 0 AND 1),
  purchased_at_assumed boolean NOT NULL DEFAULT false,
  currency         char(3) NOT NULL DEFAULT 'EUR',
  printed_total    numeric(12,2),
  lines_total      numeric(12,2),
  reconciliation_diff numeric(12,2),
  locale_detected  text,
  image_keys       text[] NOT NULL DEFAULT '{}',   -- rutas con prefijo user_id en el almacenamiento
  image_delete_after date,
  fingerprint      text,                   -- tienda + fecha + hora + total
  ocr_provider     text,
  ocr_mean_confidence numeric(3,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz,
  UNIQUE (user_id, id),
  CHECK (status <> 'confirmado' OR confirmed_at IS NOT NULL)
);
CREATE INDEX receipt_fingerprint ON receipt (user_id, fingerprint);

CREATE TABLE receipt_line (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  receipt_id        uuid NOT NULL,
  position          integer NOT NULL,
  raw_text          text NOT NULL,          -- texto original detectado, nunca se sobrescribe
  proposed_name     text,
  proposed_category text,
  quantity          numeric(12,3) CHECK (quantity > 0),
  unit              base_unit,
  package_count     integer CHECK (package_count > 0),
  package_size      numeric(12,3) CHECK (package_size > 0),
  unit_price        numeric(12,4),
  price_per_kg      numeric(12,4),
  amount            numeric(12,2),
  discount          numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  discount_raw_text text,
  confidence        jsonb NOT NULL DEFAULT '{}',   -- {"name":0.93,"quantity":0.71,...}
  alternatives      jsonb NOT NULL DEFAULT '[]',
  flags             text[] NOT NULL DEFAULT '{}',  -- 'peso_incoherente', 'descuento_ambiguo', 'no_alimento'...
  decision          line_decision NOT NULL DEFAULT 'pendiente',
  user_product_id   uuid,
  decided_at        timestamptz,
  UNIQUE (user_id, id),
  UNIQUE (receipt_id, position),
  FOREIGN KEY (user_id, receipt_id) REFERENCES receipt(user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, user_product_id) REFERENCES user_product(user_id, id)
);

-- ---------------------------------------------------------------------------
-- Inventario
-- ---------------------------------------------------------------------------

CREATE TABLE pantry_lot (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  user_product_id    uuid NOT NULL,
  receipt_line_id    uuid,
  unit               base_unit NOT NULL,
  package_count      integer NOT NULL DEFAULT 1 CHECK (package_count > 0),
  package_size       numeric(12,3) CHECK (package_size > 0),
  initial_quantity   numeric(12,3) NOT NULL CHECK (initial_quantity > 0),
  available_quantity numeric(12,3) NOT NULL CHECK (available_quantity >= 0),
  purchased_on       date NOT NULL,
  date_value         date,
  date_kind          date_kind NOT NULL DEFAULT 'pendiente',
  date_origin        text CHECK (date_origin IN ('usuario', 'envase_escaneado', 'estimacion_aceptada')),
  opened_at          timestamptz,
  frozen_on          date,
  location           storage_location NOT NULL DEFAULT 'despensa',
  status             lot_status NOT NULL DEFAULT 'disponible',
  price_paid         numeric(12,2),
  nutrients_per_ration jsonb,              -- solo para lotes de sobras
  version            integer NOT NULL DEFAULT 1,   -- bloqueo optimista
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  FOREIGN KEY (user_id, user_product_id) REFERENCES user_product(user_id, id),
  FOREIGN KEY (user_id, receipt_line_id) REFERENCES receipt_line(user_id, id),
  CHECK ((status = 'agotado') = (available_quantity = 0) OR status = 'descartado'),
  CHECK ((date_kind IN ('caducidad', 'consumo_preferente')) = (date_value IS NOT NULL)),
  CHECK (package_size IS NULL OR package_size * package_count = initial_quantity OR unit = 'racion')
);
CREATE INDEX pantry_lot_active ON pantry_lot (user_id, user_product_id) WHERE status IN ('disponible', 'abierto');
CREATE INDEX pantry_lot_expiry ON pantry_lot (user_id, date_value) WHERE status IN ('disponible', 'abierto');

CREATE TABLE consumption_event (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind         consumption_kind NOT NULL,
  consumer     consumer_kind NOT NULL DEFAULT 'usuario',
  user_share   numeric(5,4) NOT NULL DEFAULT 1 CHECK (user_share BETWEEN 0 AND 1),
  meal         text CHECK (meal IN ('desayuno', 'comida', 'cena', 'merienda', 'otra')),
  occurred_at  timestamptz NOT NULL,
  idempotency_key uuid NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, id),
  UNIQUE (user_id, idempotency_key),
  CHECK (consumer <> 'otros' OR user_share = 0),
  CHECK (consumer <> 'usuario' OR user_share = 1)
);

-- Libro de movimientos: solo inserciones (ver disparador más abajo).
CREATE TABLE inventory_movement (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  lot_id             uuid NOT NULL,
  kind               movement_kind NOT NULL,
  delta              numeric(12,3) NOT NULL CHECK (delta <> 0),
  quantity_before    numeric(12,3) NOT NULL CHECK (quantity_before >= 0),
  quantity_after     numeric(12,3) NOT NULL CHECK (quantity_after >= 0),
  consumption_event_id uuid,
  receipt_line_id    uuid,
  reverses_movement_id uuid REFERENCES inventory_movement(id),
  reason             text,
  actor              text NOT NULL DEFAULT 'usuario' CHECK (actor IN ('usuario', 'sistema')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, lot_id) REFERENCES pantry_lot(user_id, id),
  FOREIGN KEY (user_id, consumption_event_id) REFERENCES consumption_event(user_id, id),
  FOREIGN KEY (user_id, receipt_line_id) REFERENCES receipt_line(user_id, id),
  CHECK (quantity_after = quantity_before + delta),
  CHECK (kind NOT IN ('entrada_compra', 'entrada_manual', 'entrada_sobras', 'transferencia_entrada') OR delta > 0),
  CHECK (kind NOT IN ('consumo_parcial', 'consumo_total', 'desperdicio', 'caducidad', 'transferencia_salida') OR delta < 0),
  CHECK (kind <> 'consumo_total' OR quantity_after = 0),
  CHECK (kind <> 'consumo_parcial' OR quantity_after > 0),
  CHECK (kind <> 'correccion' OR reverses_movement_id IS NOT NULL)
);
CREATE INDEX inventory_movement_lot ON inventory_movement (lot_id, created_at);

CREATE OR REPLACE FUNCTION app.forbid_movement_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'MOVIMIENTO_INMUTABLE: los movimientos no se modifican ni se borran; registra una correccion';
END $$;

CREATE TRIGGER inventory_movement_immutable
  BEFORE UPDATE OR DELETE ON inventory_movement
  FOR EACH ROW
  WHEN (current_setting('app.purging_user', true) IS DISTINCT FROM 'on')
  EXECUTE FUNCTION app.forbid_movement_changes();

-- Aplica el movimiento sobre el lote y comprueba la coherencia (RN-INV-02, RN-INV-03, RN-INV-05).
CREATE OR REPLACE FUNCTION app.apply_movement() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  current_qty numeric(12,3);
BEGIN
  SELECT available_quantity INTO current_qty
  FROM pantry_lot WHERE id = NEW.lot_id AND user_id = NEW.user_id
  FOR UPDATE;

  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'LOTE_NO_ENCONTRADO';
  END IF;

  -- La entrada inicial del lote parte de 0 (el lote se crea con available = initial).
  IF NEW.kind IN ('entrada_compra', 'entrada_manual', 'entrada_sobras')
     AND NOT EXISTS (SELECT 1 FROM inventory_movement WHERE lot_id = NEW.lot_id) THEN
    IF NEW.quantity_before <> 0 OR NEW.quantity_after <> current_qty THEN
      RAISE EXCEPTION 'ENTRADA_INICIAL_INCOHERENTE';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.quantity_before <> current_qty THEN
    RAISE EXCEPTION 'CANTIDAD_DESACTUALIZADA: esperado %, recibido %', current_qty, NEW.quantity_before;
  END IF;

  IF NEW.quantity_after < 0 THEN
    RAISE EXCEPTION 'CONSUMO_SUPERA_DISPONIBLE';
  END IF;

  UPDATE pantry_lot
     SET available_quantity = NEW.quantity_after,
         status = CASE
                    WHEN NEW.quantity_after = 0 AND status <> 'descartado' THEN 'agotado'::lot_status
                    WHEN NEW.quantity_after > 0 AND status = 'agotado' THEN
                      CASE WHEN opened_at IS NULL THEN 'disponible'::lot_status ELSE 'abierto'::lot_status END
                    WHEN NEW.quantity_after > 0 AND NEW.delta < 0 AND status = 'disponible'
                         AND NEW.kind IN ('consumo_parcial') THEN 'abierto'::lot_status
                    ELSE status
                  END,
         opened_at = CASE WHEN NEW.delta < 0 AND NEW.kind IN ('consumo_parcial', 'consumo_total')
                          THEN coalesce(opened_at, now()) ELSE opened_at END,
         version = version + 1
   WHERE id = NEW.lot_id AND user_id = NEW.user_id;

  RETURN NEW;
END $$;

CREATE TRIGGER inventory_movement_apply
  BEFORE INSERT ON inventory_movement
  FOR EACH ROW EXECUTE FUNCTION app.apply_movement();

-- ---------------------------------------------------------------------------
-- Recetas, cocinado, diario, lista de compra
-- ---------------------------------------------------------------------------

CREATE TABLE recipe (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,   -- NULL = catálogo curado
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  servings      smallint NOT NULL CHECK (servings BETWEEN 1 AND 50),
  time_min      smallint NOT NULL CHECK (time_min > 0),
  difficulty    smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  meal_types    text[] NOT NULL DEFAULT '{}',
  steps         text[] NOT NULL,
  origin        text NOT NULL CHECK (origin IN ('curada', 'usuario', 'generada_validada')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipe_ingredient (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
  food_id     uuid REFERENCES food(id),
  display_name text NOT NULL,
  quantity    numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit        base_unit NOT NULL,
  optional    boolean NOT NULL DEFAULT false,
  substitutes jsonb NOT NULL DEFAULT '[]',   -- [{"food_id":..., "ratio":1.0, "note":"..."}]
  is_staple   boolean NOT NULL DEFAULT false
);

CREATE TABLE cooking_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  consumption_event_id uuid NOT NULL,
  recipe_id           uuid REFERENCES recipe(id),
  servings_made       numeric(6,2) NOT NULL CHECK (servings_made > 0),
  diners              smallint NOT NULL CHECK (diners >= 1),
  servings_eaten_by_user numeric(6,2) NOT NULL CHECK (servings_eaten_by_user >= 0),
  leftovers_lot_id    uuid,
  nutrients_total     jsonb NOT NULL,
  nutrients_coverage_pct numeric(5,2) NOT NULL CHECK (nutrients_coverage_pct BETWEEN 0 AND 100),
  created_at          timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, consumption_event_id) REFERENCES consumption_event(user_id, id),
  FOREIGN KEY (user_id, leftovers_lot_id) REFERENCES pantry_lot(user_id, id),
  CHECK (servings_eaten_by_user <= servings_made)
);

CREATE TABLE intake_entry (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  consumed_on          date NOT NULL,
  meal                 text NOT NULL CHECK (meal IN ('desayuno', 'comida', 'cena', 'merienda', 'otra')),
  description          text NOT NULL,
  quantity             numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit                 base_unit NOT NULL,
  energy_kcal          numeric(8,2) CHECK (energy_kcal >= 0),   -- NULL = sin datos
  protein_g            numeric(7,2) CHECK (protein_g >= 0),
  carbs_g              numeric(7,2) CHECK (carbs_g >= 0),
  fat_g                numeric(7,2) CHECK (fat_g >= 0),
  consumption_event_id uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, consumption_event_id) REFERENCES consumption_event(user_id, id)
);
CREATE INDEX intake_entry_day ON intake_entry (user_id, consumed_on);

CREATE TABLE shopping_list_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  user_product_id uuid,
  quantity        numeric(12,3) CHECK (quantity > 0),
  unit            base_unit,
  origin          text NOT NULL CHECK (origin IN ('receta', 'reposicion', 'manual')),
  origin_recipe_id uuid REFERENCES recipe(id),
  done_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, user_product_id) REFERENCES user_product(user_id, id)
);

CREATE TABLE notification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('caducidad', 'ticket_listo', 'recordatorio_peso', 'exportacion_lista')),
  scheduled_for timestamptz NOT NULL,
  sent_at     timestamptz,
  payload     jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL,
  action     text NOT NULL,       -- 'exportacion', 'eliminacion_solicitada', 'cambio_password', 'acceso_soporte'...
  actor      text NOT NULL,
  details    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'consent', 'body_profile', 'dietary_restriction', 'declared_staple', 'energy_estimate',
    'body_measurement', 'user_product', 'product_alias', 'receipt', 'receipt_line',
    'pantry_lot', 'consumption_event', 'inventory_movement', 'cooking_log',
    'intake_entry', 'shopping_list_item', 'notification'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL
         USING (user_id = app.current_user_id())
         WITH CHECK (user_id = app.current_user_id())',
      t || '_owner', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user_role', t);
  END LOOP;
END $$;

-- El libro de movimientos no admite UPDATE ni DELETE para usuarios.
REVOKE UPDATE, DELETE ON inventory_movement FROM app_user_role;

-- app_user: cada usuario ve y edita solo su fila.
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
CREATE POLICY app_user_self ON app_user FOR ALL
  USING (id = app.current_user_id()) WITH CHECK (id = app.current_user_id());
GRANT SELECT, UPDATE ON app_user TO app_user_role;

-- audit_log: el usuario puede leer su auditoría, no escribirla.
-- Sin FORCE: los procesos internos (propietario) registran auditoría; el usuario solo lee.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_read ON audit_log FOR SELECT
  USING (user_id = app.current_user_id());
GRANT SELECT ON audit_log TO app_user_role;

-- Catálogo: lectura para todos; recetas propias solo para su dueño.
GRANT SELECT ON food, food_nutrient, recipe_ingredient TO app_user_role;
ALTER TABLE recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_read ON recipe FOR SELECT
  USING (owner_user_id IS NULL OR owner_user_id = app.current_user_id());
CREATE POLICY recipe_write ON recipe FOR ALL
  USING (owner_user_id = app.current_user_id())
  WITH CHECK (owner_user_id = app.current_user_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe TO app_user_role;

-- Los ingredientes de recetas propias solo son visibles si la receta lo es.
ALTER TABLE recipe_ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredient FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_ingredient_read ON recipe_ingredient FOR SELECT
  USING (EXISTS (SELECT 1 FROM recipe r WHERE r.id = recipe_id));
CREATE POLICY recipe_ingredient_write ON recipe_ingredient FOR ALL
  USING (EXISTS (SELECT 1 FROM recipe r WHERE r.id = recipe_id AND r.owner_user_id = app.current_user_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM recipe r WHERE r.id = recipe_id AND r.owner_user_id = app.current_user_id()));
GRANT INSERT, UPDATE, DELETE ON recipe_ingredient TO app_user_role;

-- ---------------------------------------------------------------------------
-- Purga de cuenta (RF-18). La ejecuta el proceso interno de eliminación, nunca
-- el rol de usuario final. Borra en orden de dependencias dentro de una única
-- transacción y deja un registro de auditoría sin datos personales.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.purge_user(target uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.user_id', target::text, true);
  PERFORM set_config('app.purging_user', 'on', true);
  DELETE FROM intake_entry       WHERE user_id = target;
  DELETE FROM cooking_log        WHERE user_id = target;
  DELETE FROM inventory_movement WHERE user_id = target;
  DELETE FROM pantry_lot         WHERE user_id = target;
  DELETE FROM consumption_event  WHERE user_id = target;
  DELETE FROM shopping_list_item WHERE user_id = target;
  DELETE FROM product_alias      WHERE user_id = target;
  DELETE FROM receipt_line       WHERE user_id = target;
  DELETE FROM receipt            WHERE user_id = target;
  DELETE FROM user_product       WHERE user_id = target;
  DELETE FROM recipe             WHERE owner_user_id = target;
  DELETE FROM energy_estimate    WHERE user_id = target;
  DELETE FROM body_profile       WHERE user_id = target;
  DELETE FROM body_measurement   WHERE user_id = target;
  DELETE FROM dietary_restriction WHERE user_id = target;
  DELETE FROM declared_staple    WHERE user_id = target;
  DELETE FROM consent            WHERE user_id = target;
  DELETE FROM notification       WHERE user_id = target;
  DELETE FROM app_user           WHERE id = target;
  INSERT INTO audit_log (user_id, action, actor) VALUES (target, 'cuenta_purgada', 'sistema');
  PERFORM set_config('app.purging_user', 'off', true);
END $$;

REVOKE ALL ON FUNCTION app.purge_user(uuid) FROM PUBLIC;
