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

BEGIN;

-- 1. Las vistas se evaluan con los permisos de quien consulta ------------
ALTER VIEW public.customer_segments          SET (security_invoker = on);
ALTER VIEW public.inventory_movement_summary SET (security_invoker = on);
ALTER VIEW public.inventory_from_variants    SET (security_invoker = on);
ALTER VIEW public.inventory_for_pricing      SET (security_invoker = on);

-- 2. `anon` no tiene nada que hacer en ninguna de las cuatro -------------
REVOKE SELECT ON
  public.customer_segments,
  public.inventory_movement_summary,
  public.inventory_from_variants,
  public.inventory_for_pricing
FROM anon;

-- `PUBLIC` incluye a `anon` por herencia: si alguna vista lo tuviera, el
-- REVOKE de arriba no bastaria.
REVOKE SELECT ON
  public.customer_segments,
  public.inventory_movement_summary,
  public.inventory_from_variants,
  public.inventory_for_pricing
FROM PUBLIC;

-- 3. El staff autenticado si debe seguir viendolas -----------------------
-- Su politica en `customers` es `Approved employees can manage customers`
-- (ALL, `auth.role() = 'authenticated'` + `profiles.approved`), asi que con
-- security_invoker un empleado aprobado sigue viendo lo mismo que antes.
GRANT SELECT ON
  public.customer_segments,
  public.inventory_movement_summary,
  public.inventory_from_variants,
  public.inventory_for_pricing
TO authenticated;

-- 4. Verificacion DENTRO de la misma transaccion ------------------------
-- Si algo de lo anterior no surtio efecto, esto aborta y no se aplica nada.
DO $$
DECLARE
  v_vista   text;
  v_fallos  int := 0;
BEGIN
  FOREACH v_vista IN ARRAY ARRAY[
    'customer_segments','inventory_movement_summary',
    'inventory_from_variants','inventory_for_pricing'
  ] LOOP
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

  RAISE NOTICE '030 OK: 4 vistas con security_invoker, anon sin SELECT, authenticated conserva acceso';
END $$;

COMMIT;
