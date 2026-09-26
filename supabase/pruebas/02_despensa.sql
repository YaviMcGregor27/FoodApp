-- Pruebas de la despensa (fase F1): alta de lotes, consumo parcial y total repartido entre
-- lotes, idempotencia, residuos, desperdicio, ajustes, deshacer, validaciones y aislamiento.

\set ON_ERROR_STOP 1

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'c@example.com', now(),
   '{"fecha_nacimiento": "1988-02-02", "version_terminos": "2026-09"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@example.com', now(),
   '{"fecha_nacimiento": "1979-07-07", "version_terminos": "2026-09"}');

-- ---------------------------------------------------------------------------
-- Usuario C
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

DO $$
DECLARE
  lote_nuevo uuid;
  lote_viejo uuid;
  producto uuid;
  r jsonb;
  n integer;
BEGIN
  -- Alta: dos compras del mismo producto crean dos lotes de un único producto (RN-INV-09).
  lote_nuevo := public.alta_lote('Arroz redondo', 'Cereales y legumbres', 'g', current_date, 'despensa',
                                 'consumo_preferente', current_date + 300, 1, 1000);
  lote_viejo := public.alta_lote('arroz redondo', 'Cereales y legumbres', 'g', current_date - 10, 'despensa',
                                 'consumo_preferente', current_date + 30, 1, 1000);
  SELECT count(DISTINCT user_product_id), min(user_product_id::text)::uuid INTO n, producto
    FROM pantry_lot WHERE id IN (lote_nuevo, lote_viejo);
  IF n <> 1 THEN RAISE EXCEPTION 'Las dos compras deberían ser del mismo producto'; END IF;
  IF (SELECT count(*) FROM inventory_movement WHERE kind = 'entrada_manual') <> 2 THEN
    RAISE EXCEPTION 'Cada lote debe tener su movimiento de entrada';
  END IF;

  -- CA-03: consumir 1/4 de 1 kg (250 g) deja 750 g en el lote que caduca antes, que pasa a abierto.
  r := public.registrar_salida(producto, 250, '11111111-1111-1111-1111-111111111111');
  IF (SELECT available_quantity FROM pantry_lot WHERE id = lote_viejo) <> 750
     OR (SELECT status FROM pantry_lot WHERE id = lote_viejo) <> 'abierto'
     OR (SELECT available_quantity FROM pantry_lot WHERE id = lote_nuevo) <> 1000 THEN
    RAISE EXCEPTION 'El consumo no se ha aplicado al lote que caduca antes: %', r;
  END IF;

  -- Idempotencia: repetir la misma petición no descuenta dos veces.
  r := public.registrar_salida(producto, 250, '11111111-1111-1111-1111-111111111111');
  IF NOT (r ->> 'repetido')::boolean OR (SELECT available_quantity FROM pantry_lot WHERE id = lote_viejo) <> 750 THEN
    RAISE EXCEPTION 'La petición repetida ha descontado otra vez';
  END IF;

  -- Reparto entre lotes: 900 g agotan el lote abierto (750) y toman 150 del otro.
  r := public.registrar_salida(producto, 900, '22222222-2222-2222-2222-222222222222');
  IF (SELECT status FROM pantry_lot WHERE id = lote_viejo) <> 'agotado'
     OR (SELECT available_quantity FROM pantry_lot WHERE id = lote_nuevo) <> 850
     OR jsonb_array_length(r -> 'movimientos') <> 2 THEN
    RAISE EXCEPTION 'Reparto entre lotes incorrecto: %', r;
  END IF;
  IF (SELECT kind FROM inventory_movement WHERE lot_id = lote_viejo ORDER BY created_at DESC LIMIT 1) <> 'consumo_total' THEN
    RAISE EXCEPTION 'El lote agotado debería tener un movimiento de consumo total';
  END IF;

  -- No se puede consumir más de lo disponible.
  BEGIN
    PERFORM public.registrar_salida(producto, 851, gen_random_uuid());
    RAISE EXCEPTION 'FALLO: consumo superior a lo disponible';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'CONSUMO_SUPERA_DISPONIBLE' THEN RAISE; END IF;
  END;

  -- Deshacer el reparto devuelve ambas cantidades y el lote agotado vuelve a estar abierto.
  PERFORM public.deshacer_evento((r ->> 'evento_id')::uuid);
  IF (SELECT available_quantity FROM pantry_lot WHERE id = lote_viejo) <> 750
     OR (SELECT status FROM pantry_lot WHERE id = lote_viejo) <> 'abierto'
     OR (SELECT available_quantity FROM pantry_lot WHERE id = lote_nuevo) <> 1000 THEN
    RAISE EXCEPTION 'Deshacer no ha restaurado las cantidades';
  END IF;
  BEGIN
    PERFORM public.deshacer_evento((r ->> 'evento_id')::uuid);
    RAISE EXCEPTION 'FALLO: se ha deshecho dos veces';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'YA_DESHECHO' THEN RAISE; END IF;
  END;

  -- Desperdicio de un lote concreto.
  r := public.registrar_salida(producto, 100, gen_random_uuid(), 'desperdicio', lote_nuevo, p_motivo => 'en mal estado');
  IF (SELECT kind FROM consumption_event WHERE id = (r ->> 'evento_id')::uuid) <> 'desperdicio'
     OR (SELECT available_quantity FROM pantry_lot WHERE id = lote_nuevo) <> 900 THEN
    RAISE EXCEPTION 'Desperdicio mal registrado';
  END IF;

  -- Residuo: queda menos del 2 % del envase; se señala y se marca como agotado solo a petición.
  r := public.registrar_salida(producto, 735, gen_random_uuid(), p_lote_id => lote_viejo);
  IF NOT ((r -> 'movimientos' -> 0 ->> 'residuo')::boolean) THEN
    RAISE EXCEPTION 'Debería señalarse un residuo de 15 g: %', r;
  END IF;
  IF (SELECT status FROM pantry_lot WHERE id = lote_viejo) = 'agotado' THEN
    RAISE EXCEPTION 'Un residuo no debe agotar el lote automáticamente';
  END IF;
  r := public.ajustar_cantidad(lote_viejo, 0, 'residuo', gen_random_uuid());
  IF (SELECT status FROM pantry_lot WHERE id = lote_viejo) <> 'agotado' THEN
    RAISE EXCEPTION 'Marcar el residuo debería agotar el lote';
  END IF;

  -- Ajuste al alza y consumo de otra persona (no cuenta para el usuario).
  PERFORM public.ajustar_cantidad(lote_nuevo, 950, 'recuento', gen_random_uuid());
  r := public.registrar_salida(producto, 50, gen_random_uuid(), p_consumidor => 'otros');
  IF (SELECT user_share FROM consumption_event WHERE id = (r ->> 'evento_id')::uuid) <> 0 THEN
    RAISE EXCEPTION 'Un consumo de otras personas no debe asignarse al usuario';
  END IF;
  BEGIN
    PERFORM public.registrar_salida(producto, 10, gen_random_uuid(), p_consumidor => 'reparto', p_parte_usuario => 1.5);
    RAISE EXCEPTION 'FALLO: reparto con parte no válida';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PARTE_USUARIO_NO_VALIDA' THEN RAISE; END IF;
  END;

  -- CA-02: para todo lote, cantidad disponible = suma de sus movimientos, y nunca negativa.
  IF EXISTS (
    SELECT 1 FROM pantry_lot l
     WHERE l.available_quantity <> (SELECT sum(delta) FROM inventory_movement m WHERE m.lot_id = l.id)
        OR l.available_quantity < 0
  ) THEN
    RAISE EXCEPTION 'Algún lote no cuadra con su libro de movimientos';
  END IF;
END $$;

-- Validaciones de alta (RN-INV-12, RN-INV-13).
DO $$
DECLARE
  casos text[][] := ARRAY[
    ['NOMBRE_OBLIGATORIO',                        $q$SELECT public.alta_lote('   ', 'Otros', 'g', current_date, 'despensa', 'pendiente', NULL, 1, 100)$q$],
    ['CANTIDAD_NO_POSITIVA',                      $q$SELECT public.alta_lote('Sal', 'Otros', 'g', current_date, 'despensa', 'pendiente', NULL, 1, NULL, 0)$q$],
    ['FECHA_COMPRA_FUTURA',                       $q$SELECT public.alta_lote('Sal', 'Otros', 'g', current_date + 5, 'despensa', 'pendiente', NULL, 1, 100)$q$],
    ['CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR', $q$SELECT public.alta_lote('Leche', 'Lácteos', 'ml', current_date, 'frigorifico', 'caducidad', current_date - 1, 1, 1000)$q$],
    ['FECHA_INCOHERENTE',                         $q$SELECT public.alta_lote('Leche', 'Lácteos', 'ml', current_date, 'frigorifico', 'caducidad', NULL, 1, 1000)$q$],
    ['UNIDAD_NO_PERMITIDA',                       $q$SELECT public.alta_lote('Sobras', 'Otros', 'racion', current_date, 'frigorifico', 'pendiente', NULL, 1, 2)$q$]
  ];
  i integer;
BEGIN
  FOR i IN 1 .. array_length(casos, 1) LOOP
    BEGIN
      EXECUTE casos[i][2];
      RAISE EXCEPTION 'FALLO: se esperaba %', casos[i][1];
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> casos[i][1] THEN RAISE; END IF;
    END;
  END LOOP;
  -- Con confirmación explícita, un producto comprado ya caducado se admite.
  PERFORM public.alta_lote('Yogur de oferta', 'Lácteos', 'g', current_date, 'frigorifico', 'caducidad',
                           current_date - 1, 4, 125, p_confirma_fecha_anterior => true);
END $$;
COMMIT;

-- ---------------------------------------------------------------------------
-- Usuario D no puede operar sobre la despensa de C
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';
DO $$
DECLARE
  producto_c uuid;
  lote_c uuid;
  evento_c uuid;
BEGIN
  -- D no ve nada de C, así que toma los identificadores como lo haría un atacante que los conociera.
  RESET ROLE;
  SELECT id INTO producto_c FROM user_product WHERE user_id = '00000000-0000-0000-0000-0000000000c1' LIMIT 1;
  SELECT id INTO lote_c FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-0000000000c1' LIMIT 1;
  SELECT id INTO evento_c FROM consumption_event WHERE user_id = '00000000-0000-0000-0000-0000000000c1' AND kind = 'individual' LIMIT 1;
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM pantry_lot) <> 0 THEN RAISE EXCEPTION 'D ve lotes de C'; END IF;
  BEGIN
    PERFORM public.registrar_salida(producto_c, 1, gen_random_uuid());
    RAISE EXCEPTION 'FALLO: D ha consumido de la despensa de C';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PRODUCTO_NO_ENCONTRADO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.alta_lote('Intruso', 'Otros', 'g', current_date, 'despensa', 'pendiente', NULL, 1, 10, NULL, NULL, producto_c);
    RAISE EXCEPTION 'FALLO: D ha añadido un lote a un producto de C';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PRODUCTO_NO_ENCONTRADO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ajustar_cantidad(lote_c, 0, 'intruso', gen_random_uuid());
    RAISE EXCEPTION 'FALLO: D ha ajustado un lote de C';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'LOTE_NO_ENCONTRADO' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.deshacer_evento(evento_c);
    RAISE EXCEPTION 'FALLO: D ha deshecho un evento de C';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'EVENTO_NO_ENCONTRADO' THEN RAISE; END IF;
  END;
END $$;
COMMIT;

-- El rol anónimo no puede usar las funciones de la despensa.
BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.alta_lote('Sal', 'Otros', 'g', current_date, 'despensa', 'pendiente', NULL, 1, 100);
    RAISE EXCEPTION 'FALLO: el rol anónimo ha dado de alta un lote';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

SELECT 'OK: todas las comprobaciones de la despensa han pasado' AS resultado;
