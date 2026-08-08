-- 030_cerrar_vistas_security_definer.sql
--
-- Cierra una fuga de datos personales VERIFICADA CONTRA PRODUCCION el
-- 2026-08-07, no deducida de leer los .sql.
--
-- ===========================================================================
-- Que estaba pasando
-- ===========================================================================
--
-- Las cuatro vistas de `public` se crearon sin `security_invoker`, asi que
-- Postgres las evalua con los permisos de su PROPIETARIO (postgres), no con
-- los de quien consulta. Eso salta el RLS de las tablas base. Y `anon` tenia
-- SELECT sobre las cuatro.
--
-- Resultado medido con la clave publishable —la que viaja en el bundle de
-- produccion y por tanto tiene cualquiera— contra
-- https://inszvqzpxfqibkjsptsm.supabase.co/rest/v1/:
--
--   customers                  -> []          (RLS cerrado en 027: bien)
--   sales                      -> []          (bien)
--   inventory                  -> []          (bien)
--   profiles                   -> []          (bien)
--   customer_segments          -> 2 FILAS  <- full_name, phone, email,
--                                             last_purchase_date, lifetime_value
--   inventory_movement_summary -> 2 FILAS
--   inventory_from_variants    -> 3 FILAS  <- cost_per_gram, supplier
--   inventory_for_pricing      -> 3 FILAS
--
-- Control negativo de esa medicion: la misma peticion con una clave rota
-- devuelve 401, asi que las filas no son un artefacto de la sonda. Control
-- positivo: la misma clave sobre las tablas devuelve `[]`, o sea que la clave
-- es valida y lo que cambia es el objeto consultado.
--
-- ===========================================================================
-- Por que 027 y 029 no lo cerraron
-- ===========================================================================
--
-- Las dos trabajaron sobre TABLAS: 027 activo RLS y retiro politicas abiertas,
-- 029 cerro las funciones ejecutables por `anon` (de 62 a 13). Ninguna miro
-- las VISTAS, que no tienen RLS propio y por eso no aparecen en
-- `pg_class.relrowsecurity` ni en `pg_policies`.
--
-- Es el mismo patron que el repo ya tiene escrito para las politicas
-- inertes: **revisar el mecanismo que conoces no prueba nada sobre el que no
-- estas mirando.** Aqui el objeto olvidado no era una politica, era un tipo de
-- objeto entero.
--
-- ===========================================================================
-- Por que revocar a `anon` no rompe nada
-- ===========================================================================
--
-- Comprobado en el codigo antes de escribir esto:
--
--   customer_segments          -> solo `app/clientes/page.tsx`, staff
--                                 AUTENTICADO, y ya trae fallback a la tabla
--                                 `customers` si la vista falla
--   inventory_movement_summary -> ningun consumidor
--   inventory_from_variants    -> ningun consumidor
--   inventory_for_pricing      -> ningun consumidor, y ademas no la crea
--                                 ninguna migracion de este repo: se creo a
--                                 mano en el dashboard en algun momento
--
-- El portal de cliente llega como `anon`, pero NO consulta vistas: solo
-- invoca RPC (`grep "\.from('" app/portal` no devuelve nada). Por eso la
-- lista blanca de 13 funciones de 029 sigue siendo suficiente para el portal.
--
-- ===========================================================================
-- Que hace esta migracion
-- ===========================================================================
--
-- Dos capas, a proposito:
--   1. `security_invoker = on`  -> la vista pasa a evaluarse con los permisos
--      de quien consulta, asi que el RLS de las tablas base vuelve a aplicar.
--      Requiere PG15+; produccion corre PG17.6.
--   2. `REVOKE SELECT ... FROM anon` -> aunque manana alguien reintroduzca una
--      vista definer, `anon` ya no tiene por donde entrar.
--
-- Probada entera en TRANSACCION REVERTIDA contra produccion antes de
-- escribirla (`BEGIN; ... ROLLBACK;`), con verificacion posterior de que el
-- rollback dejo las cuatro vistas exactamente como estaban.

-- ⚠️ POR QUE ESTO NO ES UNA LISTA DE `ALTER VIEW` A SECAS
--
-- `inventory_for_pricing` **no la crea ninguna migracion de este repo**: se
-- creo a mano en el dashboard. Una version anterior de este archivo la
-- alteraba directamente, y eso convertia la migracion en una bomba: en una
-- base NUEVA (proyecto nuevo, rama de Supabase, restore desde backup) la
-- sentencia lanza `relation "public.inventory_for_pricing" does not exist` y,
-- como todo va en una sola transaccion, **se revierte tambien el endurecimiento
-- de las otras tres**. El entorno reconstruido se quedaba con
-- `customer_segments` legible por `anon` mientras la migracion figuraba como
-- aplicada.
--
-- Por eso se itera sobre las vistas que EXISTEN y se deja constancia de las que
-- falten. Endurecer una vista ausente no tiene sentido; abortar por ella,
-- tampoco.

BEGIN;

DO $$
DECLARE
  v_vista      text;
  v_ausentes   text[] := '{}';
  v_tocadas    int := 0;
  v_fallos     int := 0;
BEGIN
  FOREACH v_vista IN ARRAY ARRAY[
    'customer_segments','inventory_movement_summary',
    'inventory_from_variants','inventory_for_pricing'
  ] LOOP
    -- `to_regclass` devuelve NULL en vez de lanzar cuando el objeto no existe.
    IF to_regclass('public.'||v_vista) IS NULL THEN
      v_ausentes := v_ausentes || v_vista;
      CONTINUE;
    END IF;

    -- 1. La vista se evalua con los permisos de quien consulta.
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v_vista);

    -- 2. `anon` no tiene nada que hacer aqui. `PUBLIC` incluye a `anon` por
    --    herencia, asi que revocar solo a `anon` no bastaria.
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', v_vista);
    EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC', v_vista);

    -- 3. El staff autenticado si debe seguir viendolas. Su politica en
    --    `customers` es `Approved employees can manage customers` (ALL,
    --    `auth.role() = 'authenticated'` + `profiles.approved`), asi que con
    --    security_invoker un empleado aprobado ve lo mismo que antes.
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_vista);

    v_tocadas := v_tocadas + 1;

    -- 4. Verificacion inmediata: si algo no surtio efecto, se aborta y no se
    --    aplica NADA. Una migracion de seguridad a medias es peor que ninguna.
    IF has_table_privilege('anon', 'public.'||v_vista, 'SELECT') THEN
      RAISE WARNING 'anon TODAVIA puede leer %', v_vista;
      v_fallos := v_fallos + 1;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = ('public.'||v_vista)::regclass
        AND reloptions @> ARRAY['security_invoker=on']
    ) THEN
      RAISE WARNING '% sigue SIN security_invoker', v_vista;
      v_fallos := v_fallos + 1;
    END IF;
    IF NOT has_table_privilege('authenticated', 'public.'||v_vista, 'SELECT') THEN
      RAISE WARNING 'authenticated PERDIO el acceso a %', v_vista;
      v_fallos := v_fallos + 1;
    END IF;
  END LOOP;

  IF v_fallos > 0 THEN
    RAISE EXCEPTION '030 aborta: % comprobaciones fallidas', v_fallos;
  END IF;

  -- Que falten todas es sospechoso: significa que se esta aplicando sobre una
  -- base sin las vistas, o sobre el schema equivocado.
  IF v_tocadas = 0 THEN
    RAISE EXCEPTION '030 aborta: no existe NINGUNA de las cuatro vistas (ausentes: %)',
      array_to_string(v_ausentes, ', ');
  END IF;

  IF array_length(v_ausentes, 1) > 0 THEN
    RAISE NOTICE '030: % vista(s) no existen en esta base y se omiten: %',
      array_length(v_ausentes, 1), array_to_string(v_ausentes, ', ');
  END IF;

  RAISE NOTICE '030 OK: % vista(s) con security_invoker, sin SELECT para anon, authenticated conserva acceso', v_tocadas;
END $$;

COMMIT;
