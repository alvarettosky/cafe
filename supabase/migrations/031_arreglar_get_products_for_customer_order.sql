-- 031_arreglar_get_products_for_customer_order.sql
--
-- BACKLOG A15. La página de nuevo pedido del portal **no podía listar
-- productos**: la RPC devolvía HTTP 400 en cada carga.
--
-- ===========================================================================
-- El fallo, reproducido antes de tocar nada
-- ===========================================================================
--
--   POST /rest/v1/rpc/get_products_for_customer_order   (clave publishable)
--   -> 400  {"code":"42803","message":"column \"inventory.product_name\"
--            must appear in the GROUP BY clause or be used in an aggregate
--            function"}
--
-- La versión de `022_fase2_portal_cliente.sql` ponía el `ORDER BY` **fuera**
-- del agregado:
--
--   SELECT json_agg(json_build_object(...))
--   FROM inventory
--   WHERE total_grams_available > 0
--   ORDER BY product_name        <-- ordena el resultado de la agregación,
--                                    que es UNA fila, por una columna que ya
--                                    no existe a ese nivel
--
-- No es un error de tipos ni de permisos: es SQL que nunca pudo ejecutarse.
-- Y por eso ninguna puerta lo vio — `npm run check:rpc` comprueba que la
-- función **exista**, no que funcione, y los tests del portal mockean
-- `supabase.rpc`, así que responden lo que se les pida.
--
-- ===========================================================================
-- Qué cambia
-- ===========================================================================
--
-- 1. `ORDER BY product_name` pasa DENTRO de `json_agg(...)`, que es donde
--    ordena lo que se agrega. Se conserva el orden alfabético que la función
--    pretendía dar, verificado: el primero es "Café en Grano".
--
-- 2. `COALESCE(..., '[]'::json)`. Sin filas, `json_agg` devuelve NULL, no un
--    array vacío. El consumidor (`app/portal/nuevo-pedido/page.tsx`) ya hace
--    `setProducts(data || [])`, así que no cambia nada visible; lo que cambia
--    es que el contrato deja de depender de que el cliente adivine.
--
-- 3. `SET search_path = public, pg_temp`. Es `SECURITY DEFINER`, y sin
--    `search_path` fijo aparece en `get_advisors` como
--    `function_search_path_mutable` (BACKLOG A17, 62 casos). Se cierra aquí el
--    de esta función, que es la que se estaba tocando.
--
-- NO se cambia el criterio de disponibilidad (`total_grams_available > 500`)
-- aunque sea sospechoso: con la libra comercial de 500 g, un producto con
-- exactamente 500 g queda marcado como NO disponible. Cambiarlo es una
-- decisión de negocio, no una corrección, y va aparte.
--
-- Probada en transacción revertida contra producción antes de aplicarla:
-- devolvió 10 productos ordenados, y el ROLLBACK dejó la función rota como
-- estaba (comprobado volviendo a llamarla).

CREATE OR REPLACE FUNCTION public.get_products_for_customer_order()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', product_id,
          'name', product_name,
          'available', total_grams_available > 500
        )
        ORDER BY product_name
      ),
      '[]'::json
    )
    FROM inventory
    WHERE total_grams_available > 0
  );
END;
$function$;

-- Verificación: si la función sigue sin poder ejecutarse, esto lanza y la
-- migración no se da por buena.
DO $$
DECLARE v_json json;
BEGIN
  v_json := public.get_products_for_customer_order();
  IF json_typeof(v_json) <> 'array' THEN
    RAISE EXCEPTION '031: la RPC no devolvio un array, devolvio %', json_typeof(v_json);
  END IF;
  RAISE NOTICE '031 OK: la RPC devuelve % productos', json_array_length(v_json);
END $$;
