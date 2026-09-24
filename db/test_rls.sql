-- Pruebas del esquema: aislamiento entre usuarios, consumo parcial y libro de movimientos.
-- Ejecutar sobre una base vacía después de schema.sql con un superusuario:
--   psql -v ON_ERROR_STOP=1 -f schema.sql -f test_rls.sql
-- Cada bloque DO lanza una excepción si una comprobación falla.

\set ON_ERROR_STOP 1

-- Datos de partida creados por el superusuario (migraciones / alta de cuenta).
INSERT INTO app_user (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

INSERT INTO user_product (id, user_id, name, category, unit, default_package_size, portion_size) VALUES
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Arroz redondo', 'Cereales', 'g', 1000, 80),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Leche semidesnatada', 'Lácteos', 'ml', 1000, 250);

INSERT INTO pantry_lot (id, user_id, user_product_id, unit, package_count, package_size, initial_quantity, available_quantity, purchased_on, date_kind, date_value) VALUES
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'g', 1, 1000, 1000, 1000, '2026-09-20', 'consumo_preferente', '2027-06-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'ml', 1, 1000, 1000, 1000, '2026-09-20', 'caducidad', '2026-09-30');

INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after) VALUES
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'entrada_compra', 1000, 0, 1000),
  ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'entrada_compra', 1000, 0, 1000);

-- A partir de aquí, se actúa como el rol de la aplicación en nombre del usuario A.
BEGIN;
SET LOCAL ROLE app_user_role;
SET LOCAL app.user_id = '00000000-0000-0000-0000-00000000000a';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pantry_lot;
  IF n <> 1 THEN RAISE EXCEPTION 'A debería ver 1 lote y ve %', n; END IF;

  SELECT count(*) INTO n FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'A puede ver lotes de B'; END IF;

  SELECT count(*) INTO n FROM app_user;
  IF n <> 1 THEN RAISE EXCEPTION 'A debería ver solo su cuenta y ve %', n; END IF;

  UPDATE pantry_lot SET location = 'congelador' WHERE id = '20000000-0000-0000-0000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'A ha modificado un lote de B'; END IF;

  -- Consumo parcial: 1/4 de 1000 g deja 750 g y el lote pasa a abierto.
  INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
  VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'consumo_parcial', -250, 1000, 750);

  IF (SELECT available_quantity FROM pantry_lot WHERE id = '20000000-0000-0000-0000-00000000000a') <> 750 THEN
    RAISE EXCEPTION 'Tras consumir 250 g deberían quedar 750 g';
  END IF;
  IF (SELECT status FROM pantry_lot WHERE id = '20000000-0000-0000-0000-00000000000a') <> 'abierto' THEN
    RAISE EXCEPTION 'El lote debería estar abierto';
  END IF;
END $$;

-- Insertar un movimiento en nombre de B debe fallar por la política WITH CHECK.
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
    VALUES ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'consumo_parcial', -100, 1000, 900);
    RAISE EXCEPTION 'FALLO: A ha insertado un movimiento de B';
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN
    IF SQLERRM LIKE 'FALLO:%' THEN RAISE; END IF;
  END;
END $$;

-- Consumir más de lo disponible debe fallar.
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
    VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'consumo_parcial', -800, 750, -50);
    RAISE EXCEPTION 'FALLO: se ha aceptado un consumo superior a lo disponible';
  EXCEPTION WHEN check_violation OR raise_exception THEN
    IF SQLERRM LIKE 'FALLO:%' THEN RAISE; END IF;
  END;
END $$;

-- Una cantidad previa desactualizada (concurrencia) debe fallar.
DO $$
BEGIN
  BEGIN
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
    VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'consumo_parcial', -100, 1000, 900);
    RAISE EXCEPTION 'FALLO: se ha aceptado una cantidad previa desactualizada';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'CANTIDAD_DESACTUALIZADA%' THEN RAISE; END IF;
  END;
END $$;

-- Los movimientos son inmutables.
DO $$
BEGIN
  BEGIN
    DELETE FROM inventory_movement WHERE lot_id = '20000000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'FALLO: se ha podido borrar un movimiento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Consumo total: el lote pasa a agotado solo cuando la cantidad llega a cero.
DO $$
BEGIN
  INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
  VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'consumo_total', -750, 750, 0);
  IF (SELECT status FROM pantry_lot WHERE id = '20000000-0000-0000-0000-00000000000a') <> 'agotado' THEN
    RAISE EXCEPTION 'El lote debería estar agotado';
  END IF;
  IF (SELECT sum(delta) FROM inventory_movement WHERE lot_id = '20000000-0000-0000-0000-00000000000a') <> 0 THEN
    RAISE EXCEPTION 'La suma de movimientos no coincide con la cantidad disponible';
  END IF;
END $$;

COMMIT;

-- Usuario B no ve nada de A.
BEGIN;
SET LOCAL ROLE app_user_role;
SET LOCAL app.user_id = '00000000-0000-0000-0000-00000000000b';
DO $$
BEGIN
  IF (SELECT count(*) FROM inventory_movement) <> 1 THEN
    RAISE EXCEPTION 'B debería ver solo su movimiento';
  END IF;
  IF (SELECT available_quantity FROM pantry_lot) <> 1000 THEN
    RAISE EXCEPTION 'El lote de B no debería haber cambiado';
  END IF;
END $$;
COMMIT;

-- Sin usuario fijado no se ve nada.
BEGIN;
SET LOCAL ROLE app_user_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM pantry_lot) <> 0 THEN
    RAISE EXCEPTION 'Sin usuario autenticado no debería verse ningún lote';
  END IF;
END $$;
COMMIT;

-- Purga de la cuenta A: desaparecen sus datos y los de B permanecen.
SELECT app.purge_user('00000000-0000-0000-0000-00000000000a');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM app_user WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Quedan datos de A tras la purga';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'La purga de A ha borrado datos de B';
  END IF;
END $$;

SELECT 'OK: todas las comprobaciones del esquema han pasado' AS resultado;
