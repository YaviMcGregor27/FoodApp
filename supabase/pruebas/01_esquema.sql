-- Pruebas de cuentas y aislamiento: alta de cuentas, edad mínima, consentimientos,
-- aislamiento entre usuarios, privilegios y purga de cuenta. Las reglas de inventario se
-- prueban con las funciones de la despensa en 02_despensa.sql.
-- Ejecutar sobre una base vacía con un superusuario (ver supabase/pruebas/ejecutar.sh).
-- Cada bloque DO lanza una excepción si una comprobación falla.

\set ON_ERROR_STOP 1

-- ---------------------------------------------------------------------------
-- Alta de cuentas (lo que hace Supabase Auth al registrarse)
-- ---------------------------------------------------------------------------

-- A: registro con correo y datos completos en los metadatos.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com', now(),
   '{"fecha_nacimiento": "1990-05-10", "version_terminos": "2026-09", "acepta_datos_salud": true, "version_datos_salud": "2026-09"}');

-- B: alta con Apple o Google, sin metadatos; completa el registro después.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

DO $$
BEGIN
  IF (SELECT registration_completed_at IS NULL FROM app_user WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'El registro de A debería estar completo';
  END IF;
  IF (SELECT count(*) FROM consent WHERE user_id = '00000000-0000-0000-0000-00000000000a') <> 2 THEN
    RAISE EXCEPTION 'A debería tener 2 consentimientos (términos y datos de salud)';
  END IF;
  IF (SELECT registration_completed_at IS NOT NULL FROM app_user WHERE id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'El registro de B no debería estar completo todavía';
  END IF;
END $$;

-- Un menor de 18 años no puede darse de alta.
DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('00000000-0000-0000-0000-00000000000c', 'c@example.com',
       jsonb_build_object('fecha_nacimiento', (current_date - interval '17 years')::date, 'version_terminos', '2026-09'));
    RAISE EXCEPTION 'FALLO: se ha dado de alta a un menor de 18 años';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'EDAD_MINIMA' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000c') THEN
    RAISE EXCEPTION 'El alta fallida no debería dejar usuario';
  END IF;
END $$;

-- Sin aceptar los términos vigentes no se completa el alta.
DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('00000000-0000-0000-0000-00000000000d', 'd@example.com',
       '{"fecha_nacimiento": "1985-01-01", "version_terminos": "2020-01"}');
    RAISE EXCEPTION 'FALLO: alta sin términos vigentes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TERMINOS_NO_ACEPTADOS' THEN RAISE; END IF;
  END;
END $$;

-- La verificación del correo se sincroniza.
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '00000000-0000-0000-0000-00000000000b';
DO $$
BEGIN
  IF (SELECT email_verified_at IS NULL FROM app_user WHERE id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'La verificación del correo de B no se ha sincronizado';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- B completa el registro desde la app
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

DO $$
DECLARE r record;
BEGIN
  BEGIN
    PERFORM public.completar_registro((current_date - interval '10 years')::date, '2026-09', false);
    RAISE EXCEPTION 'FALLO: registro completado con 10 años';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'EDAD_MINIMA' THEN RAISE; END IF;
  END;

  PERFORM public.completar_registro('1992-03-15', '2026-09', false);
  SELECT * INTO r FROM public.estado_cuenta();
  IF NOT r.registro_completo OR NOT r.correo_verificado OR r.consentimiento_datos_salud THEN
    RAISE EXCEPTION 'Estado de cuenta de B incorrecto: %', r;
  END IF;

  -- Idempotente: una segunda llamada no duplica consentimientos.
  PERFORM public.completar_registro('1992-03-15', '2026-09', false);
  IF (SELECT count(*) FROM consent) <> 1 THEN
    RAISE EXCEPTION 'B debería ver exactamente 1 consentimiento';
  END IF;
END $$;

-- El usuario no puede fabricar consentimientos ni cambiar su fecha de nacimiento.
DO $$
BEGIN
  BEGIN
    INSERT INTO consent (user_id, purpose, text_version) VALUES ('00000000-0000-0000-0000-00000000000b', 'datos_salud', 'x');
    RAISE EXCEPTION 'FALLO: consentimiento insertado directamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE app_user SET birth_date = '2015-01-01';
    RAISE EXCEPTION 'FALLO: fecha de nacimiento modificada directamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE app_user SET unit_system = 'imperial';
END $$;
COMMIT;

-- ---------------------------------------------------------------------------
-- Datos de despensa de A y de B (creados por el sistema)
-- ---------------------------------------------------------------------------

INSERT INTO user_product (id, user_id, name, category, unit, default_package_size, portion_size) VALUES
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Arroz redondo', 'Cereales', 'g', 1000, 80),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'Leche semidesnatada', 'Lácteos', 'ml', 1000, 250);

INSERT INTO pantry_lot (id, user_id, user_product_id, unit, package_count, package_size, initial_quantity, available_quantity, purchased_on, date_kind, date_value) VALUES
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'g', 1, 1000, 1000, 1000, '2026-09-20', 'consumo_preferente', '2027-06-01'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'ml', 1, 1000, 1000, 1000, '2026-09-20', 'caducidad', '2026-09-30');

INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after) VALUES
  ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'entrada_compra', 1000, 0, 1000),
  ('00000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'entrada_compra', 1000, 0, 1000);

-- ---------------------------------------------------------------------------
-- Usuario A: aislamiento, privilegios e inmutabilidad
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pantry_lot;
  IF n <> 1 THEN RAISE EXCEPTION 'A debería ver 1 lote y ve %', n; END IF;

  SELECT count(*) INTO n FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000b';
  IF n <> 0 THEN RAISE EXCEPTION 'A puede ver lotes de B'; END IF;

  SELECT count(*) INTO n FROM app_user;
  IF n <> 1 THEN RAISE EXCEPTION 'A debería ver solo su cuenta y ve %', n; END IF;

  SELECT count(*) INTO n FROM consent;
  IF n <> 2 THEN RAISE EXCEPTION 'A debería ver solo sus 2 consentimientos y ve %', n; END IF;

  UPDATE pantry_lot SET location = 'congelador' WHERE id = '20000000-0000-0000-0000-00000000000b';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'A ha modificado un lote de B'; END IF;

  -- Datos descriptivos del lote propio sí se pueden cambiar.
  UPDATE pantry_lot SET location = 'frigorifico' WHERE id = '20000000-0000-0000-0000-00000000000a';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'A debería poder cambiar la ubicación de su lote'; END IF;
END $$;

-- Las cantidades solo cambian mediante movimientos registrados por las funciones.
DO $$
BEGIN
  BEGIN
    UPDATE pantry_lot SET available_quantity = 5 WHERE id = '20000000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'FALLO: se ha cambiado la cantidad de un lote sin movimiento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO inventory_movement (user_id, lot_id, kind, delta, quantity_before, quantity_after)
    VALUES ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'consumo_parcial', -250, 1000, 750);
    RAISE EXCEPTION 'FALLO: se ha insertado un movimiento directamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO pantry_lot (user_id, user_product_id, unit, initial_quantity, available_quantity, purchased_on)
    VALUES ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'g', 10, 10, current_date);
    RAISE EXCEPTION 'FALLO: se ha creado un lote sin movimiento de entrada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Vaciar una tabla entera saltándose la seguridad por filas está prohibido.
DO $$
BEGIN
  BEGIN
    TRUNCATE pantry_lot CASCADE;
    RAISE EXCEPTION 'FALLO: un usuario ha podido vaciar la tabla de lotes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- El catálogo compartido es de solo lectura.
DO $$
BEGIN
  BEGIN
    INSERT INTO food (name, category, source) VALUES ('Falso', 'Otros', 'usuario');
    RAISE EXCEPTION 'FALLO: un usuario ha modificado el catálogo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
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

COMMIT;

-- ---------------------------------------------------------------------------
-- B no ve nada de A; sin sesión o como anónimo no se ve nada
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
DO $$
BEGIN
  IF (SELECT count(*) FROM inventory_movement) <> 1 THEN
    RAISE EXCEPTION 'B debería ver solo su movimiento';
  END IF;
  IF (SELECT available_quantity FROM pantry_lot) <> 1000 OR (SELECT location FROM pantry_lot) <> 'despensa' THEN
    RAISE EXCEPTION 'El lote de B no debería haber cambiado';
  END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM pantry_lot) <> 0 THEN
    RAISE EXCEPTION 'Sin usuario autenticado no debería verse ningún lote';
  END IF;
END $$;
COMMIT;

BEGIN;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM pantry_lot;
    RAISE EXCEPTION 'FALLO: el rol anónimo puede leer lotes';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.completar_registro('1990-01-01', '2026-09', false);
    RAISE EXCEPTION 'FALLO: el rol anónimo puede completar un registro';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
COMMIT;

-- ---------------------------------------------------------------------------
-- Purga de la cuenta A (proceso de eliminación): se borran sus datos, no los de B
-- ---------------------------------------------------------------------------

SELECT app.purge_user('00000000-0000-0000-0000-00000000000a');
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-00000000000a';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM consent WHERE user_id = '00000000-0000-0000-0000-00000000000a')
     OR EXISTS (SELECT 1 FROM app_user WHERE id = '00000000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'Quedan datos de A tras la purga';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pantry_lot WHERE user_id = '00000000-0000-0000-0000-00000000000b') THEN
    RAISE EXCEPTION 'La purga de A ha borrado datos de B';
  END IF;
END $$;

SELECT 'OK: todas las comprobaciones del esquema han pasado' AS resultado;
