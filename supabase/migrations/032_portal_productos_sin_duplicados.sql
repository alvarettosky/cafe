-- 032_portal_productos_sin_duplicados.sql
--
-- BACKLOG A21. El portal listaba **10 entradas para 4 productos**.
--
-- ===========================================================================
-- Que pasaba
-- ===========================================================================
--
-- `031` dejo la RPC funcionando (antes devolvia SQL invalido), y al verla
-- responder por primera vez salio el defecto que estaba debajo: `inventory`
-- guarda **una fila por lote**, no por producto. Medido el 2026-08-07:
--
--   Cafe en Grano                 2 filas   5000 + 6000 g
--   Cafe Molido Medio             3 filas   2500 x3
--   Cafe Tostado (Grano)          3 filas   5000 x3
--   Cafe Tostado (Tostion Media)  2 filas   4500 + 5000 g
--
-- El cliente veia el mismo cafe repetido dos y tres veces, sin forma de saber
-- cual elegir. Las 10 filas estan ademas **migradas al modelo de variantes**
-- (`migrated_to_product_id` no nulo en todas), asi que la duplicidad es un
-- residuo de esa migracion, no informacion util para quien compra.
--
-- ===========================================================================
-- Por que se agrupa aqui y no se cambia el modelo
-- ===========================================================================
--
-- La solucion de fondo es que el portal lea `products`/`product_variants`,
-- como ya hace el POS interno con `get_variants_for_sale`. Eso obliga a tocar
-- tambien `create_customer_order`, `confirm_customer_order` y la pantalla del
-- portal: es una migracion de modelo, no un arreglo, y merece su propio ciclo.
--
-- Lo que SI se puede cerrar hoy sin romper contratos: agrupar por producto.
--
-- ⚠️ El `id` que se devuelve **tiene que seguir siendo un `inventory.product_id`
-- real**, porque `create_customer_order` valida asi:
--
--     SELECT * INTO v_product FROM inventory WHERE product_id = v_item.product_id;
--     IF v_product.total_grams_available < 500 THEN ... 'Stock insuficiente' ...
--
-- Por eso se elige **la fila con mas stock** de cada producto y se informa su
-- disponibilidad, no la suma de los lotes: asi lo que el cliente ve coincide
-- exactamente con lo que la validacion del pedido va a permitir. Sumar los
-- lotes daria un `available` mas generoso que el pedido rechazaria despues,
-- que es peor que mostrar de menos.

CREATE OR REPLACE FUNCTION public.get_products_for_customer_order()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN (
    WITH por_producto AS (
      SELECT
        product_name,
        -- La fila con mas stock: es contra la que validara create_customer_order.
        (array_agg(product_id            ORDER BY total_grams_available DESC))[1] AS product_id,
        (array_agg(total_grams_available ORDER BY total_grams_available DESC))[1] AS gramos_del_lote,
        count(*)                                                                  AS lotes
      FROM inventory
      WHERE total_grams_available > 0
      GROUP BY product_name
    )
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id',        product_id,
          'name',      product_name,
          'available', gramos_del_lote > 500
        )
        ORDER BY product_name
      ),
      '[]'::json
    )
    FROM por_producto
  );
END;
$function$;

-- --- Comprobacion -----------------------------------------------------------
-- Un array sin nombres repetidos. Si vuelve a haber duplicados, esto aborta.
DO $$
DECLARE
  v_json    json;
  v_total   int;
  v_unicos  int;
BEGIN
  v_json := public.get_products_for_customer_order();
  IF json_typeof(v_json) <> 'array' THEN
    RAISE EXCEPTION '032: la RPC no devolvio un array, devolvio %', json_typeof(v_json);
  END IF;

  SELECT count(*), count(DISTINCT elem->>'name')
    INTO v_total, v_unicos
    FROM json_array_elements(v_json) AS elem;

  IF v_total <> v_unicos THEN
    RAISE EXCEPTION '032: la RPC sigue devolviendo duplicados (% entradas, % nombres)', v_total, v_unicos;
  END IF;

  RAISE NOTICE '032 OK: % productos, sin nombres repetidos', v_total;
END $$;
