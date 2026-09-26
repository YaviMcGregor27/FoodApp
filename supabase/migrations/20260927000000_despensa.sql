-- FoodApp, fase F1: despensa.
--
-- Todas las escrituras de inventario pasan por estas funciones, que registran cada cambio
-- como movimiento (RN-INV-02, RN-INV-08). El usuario ya no puede insertar ni modificar
-- directamente lotes, movimientos ni eventos: solo leerlos y cambiar datos descriptivos
-- (ubicación y fechas del lote; nombre, categoría y porción del producto).
--
-- Las funciones son SECURITY DEFINER: se ejecutan con permisos del propietario, así que
-- cada consulta filtra explícitamente por auth.uid().

-- ---------------------------------------------------------------------------
-- Privilegios
-- ---------------------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE ON pantry_lot, inventory_movement, consumption_event, user_product FROM authenticated;
GRANT UPDATE (location, date_kind, date_value, date_origin, frozen_on) ON pantry_lot TO authenticated;
GRANT UPDATE (name, category, portion_size, default_package_size, grams_per_unit) ON user_product TO authenticated;

-- Hora exacta de cada movimiento y evento (no la del inicio de la transacción), para que el
-- historial conserve el orden aunque una operación registre varios movimientos a la vez.
ALTER TABLE inventory_movement ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE consumption_event ALTER COLUMN created_at SET DEFAULT clock_timestamp();

-- ---------------------------------------------------------------------------
-- Alta manual de un lote (RF-05)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.alta_lote(
  p_nombre text,
  p_categoria text,
  p_unidad base_unit,
  p_fecha_compra date,
  p_ubicacion storage_location,
  p_tipo_fecha date_kind,
  p_fecha date DEFAULT NULL,
  p_envases integer DEFAULT 1,
  p_tamano_envase numeric DEFAULT NULL,
  p_cantidad numeric DEFAULT NULL,
  p_porcion numeric DEFAULT NULL,
  p_producto_id uuid DEFAULT NULL,
  p_abierto boolean DEFAULT false,
  p_confirma_fecha_anterior boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  yo uuid := auth.uid();
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_categoria text := coalesce(nullif(btrim(coalesce(p_categoria, '')), ''), 'Otros');
  v_producto uuid;
  v_inicial numeric(12,3);
  v_lote uuid;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO'; END IF;
  IF v_nombre = '' THEN RAISE EXCEPTION 'NOMBRE_OBLIGATORIO'; END IF;
  IF length(v_nombre) > 120 THEN RAISE EXCEPTION 'NOMBRE_DEMASIADO_LARGO'; END IF;
  IF p_unidad IS NULL OR p_unidad = 'racion' THEN RAISE EXCEPTION 'UNIDAD_NO_PERMITIDA'; END IF;
  IF p_ubicacion IS NULL THEN RAISE EXCEPTION 'UBICACION_OBLIGATORIA'; END IF;

  -- Un día de margen por la diferencia horaria entre el servidor (UTC) y el usuario.
  IF p_fecha_compra IS NULL OR p_fecha_compra > current_date + 1 THEN
    RAISE EXCEPTION 'FECHA_COMPRA_FUTURA';
  END IF;
  IF p_fecha_compra < current_date - 730 THEN
    RAISE EXCEPTION 'FECHA_COMPRA_DEMASIADO_ANTIGUA';
  END IF;
  IF p_tipo_fecha IS NULL OR (p_tipo_fecha IN ('caducidad', 'consumo_preferente')) <> (p_fecha IS NOT NULL) THEN
    RAISE EXCEPTION 'FECHA_INCOHERENTE';
  END IF;
  IF p_fecha IS NOT NULL AND p_fecha < p_fecha_compra AND NOT coalesce(p_confirma_fecha_anterior, false) THEN
    RAISE EXCEPTION 'CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR';
  END IF;

  IF p_tamano_envase IS NOT NULL THEN
    IF p_tamano_envase <= 0 OR coalesce(p_envases, 0) < 1 THEN RAISE EXCEPTION 'CANTIDAD_NO_POSITIVA'; END IF;
    v_inicial := p_tamano_envase * p_envases;
  ELSE
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'CANTIDAD_NO_POSITIVA'; END IF;
    v_inicial := p_cantidad;
  END IF;
  IF v_inicial >= 1000000000 THEN RAISE EXCEPTION 'CANTIDAD_DEMASIADO_GRANDE'; END IF;
  IF p_porcion IS NOT NULL AND p_porcion <= 0 THEN RAISE EXCEPTION 'PORCION_NO_VALIDA'; END IF;

  IF p_producto_id IS NOT NULL THEN
    SELECT id INTO v_producto FROM user_product
     WHERE id = p_producto_id AND user_id = yo AND unit = p_unidad;
    IF v_producto IS NULL THEN RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO'; END IF;
  ELSE
    -- El mismo producto con la misma unidad se reutiliza: una compra nueva es un lote nuevo (RN-INV-09).
    SELECT id INTO v_producto FROM user_product
     WHERE user_id = yo AND lower(name) = lower(v_nombre) AND unit = p_unidad
     ORDER BY created_at LIMIT 1;
    IF v_producto IS NULL THEN
      INSERT INTO user_product (user_id, name, category, unit, default_package_size, portion_size)
      VALUES (yo, v_nombre, v_categoria, p_unidad, p_tamano_envase, p_porcion)
      RETURNING id INTO v_producto;
    END IF;
  END IF;
  IF p_porcion IS NOT NULL THEN
    UPDATE user_product SET portion_size = p_porcion WHERE id = v_producto AND user_id = yo;
  END IF;

  INSERT INTO pantry_lot (
    user_id, user_product_id, unit, package_count, package_size, initial_quantity, available_quantity,
    purchased_on, date_value, date_kind, date_origin, opened_at, location, status
  ) VALUES (
    yo, v_producto, p_unidad,
    CASE WHEN p_tamano_envase IS NULL THEN 1 ELSE p_envases END,
    p_tamano_envase, v_inicial, v_inicial,
    p_fecha_compra, p_fecha, p_tipo_fecha,
    CASE WHEN p_fecha IS NOT NULL THEN 'usuario' END,
    CASE WHEN p_abierto THEN now() END,
    p_ubicacion,
    CASE WHEN p_abierto THEN 'abierto' ELSE 'disponible' END::lot_status
  ) RETURNING id INTO v_lote;

  INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after, actor)
  VALUES (yo, v_lote, 'entrada_manual', v_inicial, 0, v_inicial, 'usuario');

  RETURN v_lote;
END $$;

-- ---------------------------------------------------------------------------
-- Consumo y desperdicio (RF-06, RF-07)
--
-- La cantidad llega ya calculada en unidad base (la app convierte fracciones y porciones con
-- el paquete de dominio y muestra el resultado antes de confirmar). Se reparte entre lotes:
-- abiertos primero, después la fecha más próxima y la compra más antigua (RN-INV-10).
-- Es idempotente por p_idempotencia: repetir la misma petición no descuenta dos veces.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_salida(
  p_producto_id uuid,
  p_cantidad numeric,
  p_idempotencia uuid,
  p_tipo text DEFAULT 'consumo',
  p_lote_id uuid DEFAULT NULL,
  p_consumidor consumer_kind DEFAULT 'usuario',
  p_parte_usuario numeric DEFAULT NULL,
  p_comida text DEFAULT NULL,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  yo uuid := auth.uid();
  v_evento uuid;
  v_total numeric(12,3);
  v_pendiente numeric(12,3) := p_cantidad;
  v_parte numeric(12,3);
  v_despues numeric(12,3);
  v_consumidor consumer_kind;
  v_share numeric(5,4);
  v_tipo_mov movement_kind;
  v_resultado jsonb := '[]'::jsonb;
  r record;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO'; END IF;
  IF p_idempotencia IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCIA_OBLIGATORIA'; END IF;
  IF p_tipo NOT IN ('consumo', 'desperdicio') THEN RAISE EXCEPTION 'TIPO_NO_VALIDO'; END IF;

  -- Petición repetida: se devuelve el resultado original.
  SELECT id INTO v_evento FROM consumption_event WHERE user_id = yo AND idempotency_key = p_idempotencia;
  IF v_evento IS NOT NULL THEN
    RETURN jsonb_build_object('evento_id', v_evento, 'repetido', true, 'movimientos', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'lote_id', m.lot_id, 'antes', m.quantity_before, 'despues', m.quantity_after, 'residuo', false)
        ORDER BY m.created_at), '[]'::jsonb)
      FROM inventory_movement m WHERE m.consumption_event_id = v_evento AND m.user_id = yo));
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'CANTIDAD_NO_POSITIVA'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_product WHERE id = p_producto_id AND user_id = yo) THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO';
  END IF;
  IF p_lote_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pantry_lot WHERE id = p_lote_id AND user_id = yo AND user_product_id = p_producto_id
  ) THEN
    RAISE EXCEPTION 'LOTE_NO_ENCONTRADO';
  END IF;

  IF p_tipo = 'desperdicio' THEN
    v_consumidor := 'otros';
    v_share := 0;
  ELSE
    v_consumidor := coalesce(p_consumidor, 'usuario');
    v_share := CASE v_consumidor
                 WHEN 'usuario' THEN 1
                 WHEN 'otros' THEN 0
                 ELSE p_parte_usuario
               END;
    IF v_consumidor = 'reparto' AND (v_share IS NULL OR v_share <= 0 OR v_share >= 1) THEN
      RAISE EXCEPTION 'PARTE_USUARIO_NO_VALIDA';
    END IF;
  END IF;
  IF p_comida IS NOT NULL AND p_comida NOT IN ('desayuno', 'comida', 'cena', 'merienda', 'otra') THEN
    RAISE EXCEPTION 'COMIDA_NO_VALIDA';
  END IF;

  -- Bloqueo de los lotes implicados para evitar consumos simultáneos incoherentes.
  PERFORM 1 FROM pantry_lot
   WHERE user_id = yo AND user_product_id = p_producto_id
     AND status IN ('disponible', 'abierto') AND available_quantity > 0
     AND (p_lote_id IS NULL OR id = p_lote_id)
   FOR UPDATE;

  SELECT coalesce(sum(available_quantity), 0) INTO v_total FROM pantry_lot
   WHERE user_id = yo AND user_product_id = p_producto_id
     AND status IN ('disponible', 'abierto') AND available_quantity > 0
     AND (p_lote_id IS NULL OR id = p_lote_id);

  IF p_cantidad > v_total THEN
    RAISE EXCEPTION 'CONSUMO_SUPERA_DISPONIBLE' USING DETAIL = v_total::text;
  END IF;

  INSERT INTO consumption_event (user_id, kind, consumer, user_share, meal, occurred_at, idempotency_key, notes)
  VALUES (yo, CASE WHEN p_tipo = 'desperdicio' THEN 'desperdicio' ELSE 'individual' END::consumption_kind,
          v_consumidor, v_share, p_comida, now(), p_idempotencia, nullif(btrim(coalesce(p_motivo, '')), ''))
  RETURNING id INTO v_evento;

  FOR r IN
    SELECT id, available_quantity, package_size, initial_quantity FROM pantry_lot
     WHERE user_id = yo AND user_product_id = p_producto_id
       AND status IN ('disponible', 'abierto') AND available_quantity > 0
       AND (p_lote_id IS NULL OR id = p_lote_id)
     ORDER BY (opened_at IS NOT NULL) DESC, date_value ASC NULLS LAST, purchased_on ASC, created_at ASC
  LOOP
    EXIT WHEN v_pendiente <= 0;
    v_parte := least(v_pendiente, r.available_quantity);
    v_despues := r.available_quantity - v_parte;
    v_tipo_mov := CASE
                    WHEN p_tipo = 'desperdicio' THEN 'desperdicio'
                    WHEN v_despues = 0 THEN 'consumo_total'
                    ELSE 'consumo_parcial'
                  END;
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after,
                                    consumption_event_id, reason, actor)
    VALUES (yo, r.id, v_tipo_mov, -v_parte, r.available_quantity, v_despues,
            v_evento, nullif(btrim(coalesce(p_motivo, '')), ''), 'usuario');
    v_resultado := v_resultado || jsonb_build_object(
      'lote_id', r.id, 'antes', r.available_quantity, 'despues', v_despues,
      -- RN-INV-06: resto inferior al 2 % del envase; la app pregunta si marcarlo como agotado.
      'residuo', v_despues > 0 AND v_despues < coalesce(r.package_size, r.initial_quantity) * 0.02);
    v_pendiente := v_pendiente - v_parte;
  END LOOP;

  RETURN jsonb_build_object('evento_id', v_evento, 'repetido', false, 'movimientos', v_resultado);
END $$;

-- ---------------------------------------------------------------------------
-- Corrección de la cantidad de un lote (RF-07). También sirve para marcar un residuo
-- como agotado (nueva cantidad 0, motivo "residuo").
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ajustar_cantidad(
  p_lote_id uuid,
  p_nueva_cantidad numeric,
  p_motivo text,
  p_idempotencia uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  yo uuid := auth.uid();
  v_actual numeric(12,3);
  v_evento uuid;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO'; END IF;
  IF p_idempotencia IS NULL THEN RAISE EXCEPTION 'IDEMPOTENCIA_OBLIGATORIA'; END IF;
  IF v_motivo IS NULL THEN RAISE EXCEPTION 'MOTIVO_OBLIGATORIO'; END IF;

  SELECT id INTO v_evento FROM consumption_event WHERE user_id = yo AND idempotency_key = p_idempotencia;
  IF v_evento IS NOT NULL THEN
    RETURN jsonb_build_object('evento_id', v_evento, 'repetido', true);
  END IF;

  IF p_nueva_cantidad IS NULL OR p_nueva_cantidad < 0 THEN RAISE EXCEPTION 'CANTIDAD_NEGATIVA'; END IF;
  IF p_nueva_cantidad >= 1000000000 THEN RAISE EXCEPTION 'CANTIDAD_DEMASIADO_GRANDE'; END IF;

  SELECT available_quantity INTO v_actual FROM pantry_lot
   WHERE id = p_lote_id AND user_id = yo AND status <> 'descartado'
   FOR UPDATE;
  IF v_actual IS NULL THEN RAISE EXCEPTION 'LOTE_NO_ENCONTRADO'; END IF;
  IF v_actual = p_nueva_cantidad THEN RAISE EXCEPTION 'SIN_CAMBIOS'; END IF;

  INSERT INTO consumption_event (user_id, kind, consumer, user_share, occurred_at, idempotency_key, notes)
  VALUES (yo, 'ajuste', 'otros', 0, now(), p_idempotencia, v_motivo)
  RETURNING id INTO v_evento;

  INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after,
                                  consumption_event_id, reason, actor)
  VALUES (yo, p_lote_id, 'ajuste', p_nueva_cantidad - v_actual, v_actual, p_nueva_cantidad,
          v_evento, v_motivo, 'usuario');

  RETURN jsonb_build_object('evento_id', v_evento, 'repetido', false, 'antes', v_actual, 'despues', p_nueva_cantidad);
END $$;

-- ---------------------------------------------------------------------------
-- Deshacer un evento completo (consumo, desperdicio o ajuste) con movimientos de
-- corrección que referencian a los originales (RN-INV-08). No borra nada.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deshacer_evento(p_evento_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  yo uuid := auth.uid();
  v_actual numeric(12,3);
  v_nueva numeric(12,3);
  n integer := 0;
  m record;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'NO_AUTENTICADO'; END IF;
  IF NOT EXISTS (SELECT 1 FROM consumption_event WHERE id = p_evento_id AND user_id = yo) THEN
    RAISE EXCEPTION 'EVENTO_NO_ENCONTRADO';
  END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_movement c
      JOIN inventory_movement o ON o.id = c.reverses_movement_id
     WHERE o.consumption_event_id = p_evento_id AND c.user_id = yo
  ) THEN
    RAISE EXCEPTION 'YA_DESHECHO';
  END IF;

  FOR m IN
    SELECT id, lot_id, delta FROM inventory_movement
     WHERE consumption_event_id = p_evento_id AND user_id = yo
       AND kind IN ('consumo_parcial', 'consumo_total', 'desperdicio', 'ajuste')
     ORDER BY created_at DESC
  LOOP
    SELECT available_quantity INTO v_actual FROM pantry_lot WHERE id = m.lot_id AND user_id = yo FOR UPDATE;
    v_nueva := v_actual - m.delta;
    IF v_nueva < 0 THEN
      -- Ocurre si, después del evento, se consumió lo que se quiere devolver.
      RAISE EXCEPTION 'NO_REVERSIBLE';
    END IF;
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after,
                                    reverses_movement_id, reason, actor)
    VALUES (yo, m.lot_id, 'correccion', -m.delta, v_actual, v_nueva, m.id, 'deshacer', 'usuario');
    n := n + 1;
  END LOOP;

  IF n = 0 THEN RAISE EXCEPTION 'NO_REVERSIBLE'; END IF;
  RETURN jsonb_build_object('movimientos_corregidos', n);
END $$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.alta_lote(text, text, base_unit, date, storage_location, date_kind, date, integer, numeric, numeric, numeric, uuid, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_salida(uuid, numeric, uuid, text, uuid, consumer_kind, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ajustar_cantidad(uuid, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deshacer_evento(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.alta_lote(text, text, base_unit, date, storage_location, date_kind, date, integer, numeric, numeric, numeric, uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_salida(uuid, numeric, uuid, text, uuid, consumer_kind, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajustar_cantidad(uuid, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deshacer_evento(uuid) TO authenticated;
