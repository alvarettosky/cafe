-- 028_dashboard_stats_corregida.sql
--
-- Restaura `get_dashboard_stats()` y corrige tres defectos de `004_dashboard_stats.sql`.
--
-- EL FALLO PRINCIPAL: la funcion NO EXISTIA en produccion.
--
--   POST /rest/v1/rpc/get_dashboard_stats
--   -> HTTP 404  PGRST202  "Could not find the function public.get_dashboard_stats"
--
-- Y `app/page.tsx` la llama en cada carga del dashboard. Los cuatro KPIs de la
-- pantalla principal llevaban mostrando el marcador `...` en produccion, sin que
-- nada lo reportara: el codigo hacia
--
--   const { data: statsData } = await supabase.rpc('get_dashboard_stats');
--
-- descartando el `error` de la desestructuracion. Un 404 y una respuesta vacia
-- son indistinguibles para ese llamador.
--
-- Es exactamente el modo de fallo que `docs/BLUEPRINT.md` §3 anticipaba —«cambiar
-- una migracion rompe el frontend en silencio»— y el mismo patron del bug
-- `5ce639e` (enlaces de backups): un contrato que TypeScript no ve, fallando
-- callado porque nadie mira el error.
--
-- Auditoria completa hecha al descubrirlo: de las **37 RPC que el codigo invoca**,
-- 36 existen en produccion. Esta era la unica rota. No es un problema sistemico.
--
-- ---------------------------------------------------------------------------
-- LOS TRES DEFECTOS DE 004, corregidos aqui
-- ---------------------------------------------------------------------------
--
-- 1. UMBRAL MAGICO. Usaba `total_grams_available < 2500`, con el comentario
--    "arbitrary threshold for demo". Pero la tabla `inventory` TIENE una columna
--    `reorder_point`, poblada en los 12 productos. Medido el 2026-07-27:
--
--      Cafe en Grano              6000 g   reorder_point=2500
--      Cafe Molido Medio          2500 g   reorder_point=2500   <-- justo en el limite
--      Cafe Tostado (Grano)       5000 g   reorder_point=2500
--      Cafe Tostado (Tostion Alta)   0 g   reorder_point=2500
--
--    **Hay 3 productos exactamente en 2500 g.** Con `< 2500` no se marcan; con
--    `<= reorder_point` si. El limite no es hipotetico: afecta a 3 de 12 hoy.
--    Ahora se usa la columna, con 2500 solo como respaldo si viniera NULL.
--
-- 2. VENTAS PENDIENTES CONTADAS COMO INGRESO. `sales_today` sumaba TODAS las
--    ventas del dia sin mirar `status`. Pero `create_customer_order` inserta los
--    pedidos del portal con `status = 'pending_confirmation'`, y esos todavia no
--    tienen precio confirmado. Hoy no se nota (hay 0 pendientes), pero en cuanto
--    un cliente pida por el portal, el KPI de ventas del dia se infla solo.
--    Se excluyen los estados que no son ingreso. `NULL` se cuenta como ingreso:
--    el DEFAULT de la columna es 'completed' y las filas antiguas sin estado son
--    ventas reales.
--
-- 3. COMENTARIO QUE CONTRADICE AL CODIGO. Decia "converting grams to lbs
--    (approx / 453.59)" mientras dividia por 500.0.
--
--    **La division por 500 es la CORRECTA**, y el comentario era el error:
--    `process_coffee_sale` usa `v_grams_per_unit := 500` para libra y `:= 250`
--    para media libra. 500 g es la libra real de este negocio.
--
--    (Descubierto al revisar esto: `CLAUDE.md`, `docs/BLUEPRINT.md` §1 y
--    `manual-de-usuario-no-tecnico.md` afirmaban 453,6 g y 226,8 g. Los tres
--    estaban mal y se corrigen en el mismo commit.)
--
-- El contrato de salida NO cambia: mismas 4 claves del JSONB, que son las que
-- `types/index.ts` declara en `DashboardStats`. Esta migracion arregla como se
-- calculan, no lo que se devuelve.

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_inventory_grams INTEGER;
    v_sales_today NUMERIC(10,2);
    v_low_stock_count INTEGER;
    v_roasted_coffee_lbs NUMERIC(10,2);
BEGIN
    SELECT COALESCE(SUM(total_grams_available), 0)
    INTO v_total_inventory_grams
    FROM inventory;

    -- Solo ingreso real: se excluyen los pedidos del portal sin confirmar y los
    -- cancelados. NULL cuenta (DEFAULT de la columna = 'completed').
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_sales_today
    FROM sales
    WHERE created_at >= CURRENT_DATE
      AND (status IS NULL
           OR status NOT IN ('pending_confirmation', 'pending', 'cancelled'));

    -- Umbral por producto, no constante global. `<=` para que un producto que
    -- esta JUSTO en su punto de reposicion se marque: es cuando hay que pedir.
    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM inventory
    WHERE total_grams_available <= COALESCE(reorder_point, 2500);

    -- 500 g = 1 libra, igual que `process_coffee_sale`. No es la libra
    -- avoirdupois (453,59 g): es la libra comercial que usa este negocio.
    SELECT COALESCE(SUM(total_grams_available), 0) / 500.0
    INTO v_roasted_coffee_lbs
    FROM inventory
    WHERE product_name ILIKE '%Tostado%';

    RETURN jsonb_build_object(
        'total_inventory_grams', v_total_inventory_grams,
        'sales_today',           v_sales_today,
        'low_stock_count',       v_low_stock_count,
        'roasted_coffee_lbs',    v_roasted_coffee_lbs
    );
END;
$$;

-- Solo usuarios autenticados. La funcion es SECURITY DEFINER y lee `sales` e
-- `inventory` enteras, saltandose RLS: dejarla accesible a `anon` reabriria por
-- la puerta de atras la fuga que cerro `027_cerrar_rls_publico.sql`.
REVOKE ALL ON FUNCTION get_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
