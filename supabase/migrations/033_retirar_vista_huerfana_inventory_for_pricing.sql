-- 033_retirar_vista_huerfana_inventory_for_pricing.sql
--
-- Cierra el ultimo objeto de produccion que no existia en ninguna migracion.
--
-- ===========================================================================
-- Por que se BORRA en vez de versionarse
-- ===========================================================================
--
-- `inventory_for_pricing` aparecio dos veces en el mismo dia, las dos como
-- problema:
--
--   · era una de las cuatro vistas que filtraban datos a cualquier anonimo
--     (`030`), y
--   · era el unico objeto que no crea ninguna migracion, lo que hacia que
--     `030` —que la alteraba directamente— **abortara entera en cualquier base
--     nueva**, dejando sin endurecer tambien a las otras tres.
--
-- Al mirar que era, la decision se volvio obvia. Esta es su definicion completa
-- en produccion, leida con `pg_get_viewdef` el 2026-08-07:
--
--     SELECT product_id AS id,
--            product_name AS name,
--            10.00 AS price_per_pound      <-- precio FIJO, inventado
--       FROM inventory;
--
-- Un precio por libra **hardcodeado a 10.00** para todos los productos, en un
-- negocio cuyos precios reales viven en `price_lists` / `price_list_items` y
-- dependen del tipo de cliente. No es una vista incompleta: es un placeholder
-- que quedo olvidado. Y **no la consulta nadie**: `grep -rn inventory_for_pricing`
-- sobre `app/`, `components/`, `lib/`, `context/` y `scripts/` no devuelve una
-- sola llamada.
--
-- Versionarla habria sido dejar por escrito, y para siempre, un precio falso.
-- Se retira. Su definicion queda arriba por si alguna vez hiciera falta
-- reconstruirla, que es todo lo que un objeto asi merece.
--
-- Con esto, **todos los objetos de `public` en produccion salen de alguna
-- migracion versionada**, que es lo que el ensayo de restauracion necesita para
-- poder afirmar que reconstruye la base y no solo algo parecido.

DROP VIEW IF EXISTS public.inventory_for_pricing;

-- --- Comprobacion -----------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.inventory_for_pricing') IS NOT NULL THEN
    RAISE EXCEPTION '033: la vista sigue existiendo';
  END IF;
  RAISE NOTICE '033 OK: inventory_for_pricing retirada';
END $$;
