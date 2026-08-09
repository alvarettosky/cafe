-- 038_la_rpc_de_ventas_que_usa_la_app_estaba_rota.sql
--
-- Segunda mitad de «no se podía vender». `037` arregló el trigger; al volver a
-- probar la venta completa apareció esto, debajo.
--
-- ===========================================================================
-- Hay CUATRO `process_coffee_sale`, y la app llama a la única rota
-- ===========================================================================
--
-- | Firma                                    | Estado                              |
-- |------------------------------------------|-------------------------------------|
-- | (uuid, jsonb)                            | vieja, sin llamador                 |
-- | (uuid, jsonb, timestamptz)               | vieja, sin llamador                 |
-- | (uuid, jsonb, timestamptz, text)         | **la buena**: gramos, Kardex, stock |
-- | (uuid, jsonb, timestamptz, text, integer)| **la que llama la app — ROTA**      |
--
-- La de cinco argumentos se creó para añadir `p_customer_recurrence_days`, pero
-- se escribió partiendo de una versión **anterior** del código, no de la que
-- estaba viva. Habla de un esquema que no existe:
--
--     cost_per_kg, cost_per_unit          -> inventory tiene `cost_per_gram`
--     stock_kg, stock_units               -> inventory tiene `total_grams_available`
--     inventory.updated_at                -> se llama `last_updated`
--     sale_items.cost_per_unit, .profit   -> los calcula un trigger
--
-- Se cae en la primera línea útil:
--
--     ERROR 42703: column "cost_per_kg" does not exist
--
-- Y **es la que resuelve PostgREST**, porque `components/new-sale-modal.tsx:308`
-- y `app/ventas/nueva/page.tsx:180` mandan los cinco parámetros con nombre,
-- `p_customer_recurrence_days` incluido. O sea: desde que se añadió la
-- recurrencia, **el POS no ha podido registrar una sola venta**. Tampoco se
-- descontaba inventario ni se escribía el Kardex, porque nunca llegó a hacerlo.
--
-- ===========================================================================
-- Por qué ninguna puerta lo vio
-- ===========================================================================
--
-- `npm run check:rpc` comprueba que la función **exista**. Existe. Cuatro veces.
-- Lo que no comprueba es **cuál de las cuatro** resuelve una llamada, ni si el
-- cuerpo habla del esquema real. Es exactamente el pendiente **B4** del BACKLOG
-- —«que sus parámetros cuadren»— y esta es su factura: sobrecargar una RPC crea
-- un dispatch que ningún tipo de TypeScript ve, y el ganador puede ser la copia
-- vieja.
--
-- Los 889 tests unitarios usan mocks: comprueban que el componente **llama** a
-- `process_coffee_sale` con ciertos argumentos, no que exista una función capaz
-- de atenderlos.
--
-- ===========================================================================
-- La corrección
-- ===========================================================================
--
-- Se reemplaza el cuerpo de la de cinco argumentos por el de la buena, más la
-- recurrencia. Lo que se conserva de la buena y la rota no tenía:
--
--   * valida stock antes de vender (`RAISE EXCEPTION` si no alcanza),
--   * `FOR UPDATE` sobre la fila de inventario: dos ventas simultáneas del
--     mismo producto no pueden pasarse el stock por delante,
--   * escribe el Kardex (`inventory_movements`) con stock antes/después,
--   * descuenta **500 g** la libra y **250 g** la media —la libra comercial del
--     negocio, no la avoirdupois—,
--   * `app.is_sale_operation` para que el trigger de inventario no duplique el
--     movimiento.
--
-- ⚠️ **Lo que esta migración NO hace, a propósito:** propagar la recurrencia a
-- `customers.typical_recurrence_days`. La versión rota solo la guardaba en
-- `sales.customer_recurrence_days`, así que eso es lo que se replica. Pero el
-- modal deja **ajustar** la recurrencia de un cliente que ya existe, y ese
-- ajuste hoy se pierde: solo se guarda en el cliente cuando se crea uno nuevo
-- (`new-sale-modal.tsx:286`). Como `customers.typical_recurrence_days` es lo que
-- alimenta `/contactos`, decidirlo es de producto, no de esquema. Queda anotado
-- en el BACKLOG en vez de resuelto a ojo aquí.

BEGIN;

-- El tipo de retorno cambia de `uuid` a `jsonb` —el de la versión buena—, así
-- que hay que soltarla antes. Ningún llamador usa el valor devuelto: los dos
-- hacen `const { error } = await supabase.rpc(...)`.
DROP FUNCTION IF EXISTS public.process_coffee_sale(uuid, jsonb, timestamptz, text, integer);

CREATE FUNCTION public.process_coffee_sale(
    p_customer_id uuid,
    p_items jsonb,
    p_created_at timestamptz DEFAULT NULL,
    p_payment_method text DEFAULT 'Efectivo',
    p_customer_recurrence_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_total_amount NUMERIC(10, 2) := 0;
    v_total_cost NUMERIC(10, 2) := 0;
    v_total_profit NUMERIC(10, 2) := 0;
    v_grams_to_deduct INTEGER;
    v_cost_per_gram NUMERIC(10, 4);
    v_item_cost NUMERIC(10, 2);
    v_item_profit NUMERIC(10, 2);
    v_current_stock INTEGER;
BEGIN
    -- Evita que el trigger de inventario duplique el movimiento del Kardex.
    PERFORM set_config('app.is_sale_operation', 'true', true);

    INSERT INTO sales (customer_id, created_at, payment_method, customer_recurrence_days)
    VALUES (
        p_customer_id,
        COALESCE(p_created_at, NOW()),
        p_payment_method,
        p_customer_recurrence_days
    )
    RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;

        -- La libra del negocio son 500 g y la media 250 g. NO es la libra
        -- avoirdupois (453,6): los documentos lo afirmaron durante meses y el
        -- código nunca lo hizo.
        v_grams_to_deduct := CASE
            WHEN v_item->>'unit' = 'libra' THEN 500 * (v_item->>'quantity')::INTEGER
            WHEN v_item->>'unit' = 'media_libra' THEN 250 * (v_item->>'quantity')::INTEGER
            ELSE 0
        END;

        SELECT total_grams_available, cost_per_gram
          INTO v_current_stock, v_cost_per_gram
          FROM inventory
         WHERE product_id = v_product_id
           FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto % no existe en inventario', v_product_id;
        END IF;

        IF v_current_stock < v_grams_to_deduct THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %g, Requerido: %g',
                v_product_id, v_current_stock, v_grams_to_deduct;
        END IF;

        v_item_cost := v_grams_to_deduct * COALESCE(v_cost_per_gram, 0);
        v_item_profit := (v_item->>'price')::NUMERIC - v_item_cost;

        INSERT INTO inventory_movements (
            product_id, movement_type, quantity_grams,
            stock_before, stock_after,
            reference_id, reference_type, reason, unit_cost, performed_by
        ) VALUES (
            v_product_id, 'sale', -v_grams_to_deduct,
            v_current_stock, v_current_stock - v_grams_to_deduct,
            v_sale_id, 'sale', 'Venta procesada', v_cost_per_gram, auth.uid()
        );

        INSERT INTO sale_items (
            sale_id, product_id, unit, quantity, price_per_unit, total_price
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_item->>'unit',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC / (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC
        );

        UPDATE inventory
           SET total_grams_available = total_grams_available - v_grams_to_deduct,
               last_updated = NOW()
         WHERE product_id = v_product_id;

        v_total_amount := v_total_amount + (v_item->>'price')::NUMERIC;
        v_total_cost := v_total_cost + v_item_cost;
        v_total_profit := v_total_profit + v_item_profit;
    END LOOP;

    UPDATE sales
       SET total_amount = v_total_amount,
           total_cost = v_total_cost,
           total_profit = v_total_profit,
           profit_margin = CASE
               WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
               ELSE 0
           END
     WHERE id = v_sale_id;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'total_profit', v_total_profit,
        'profit_margin', CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
            ELSE 0
        END
    );
END;
$function$;

-- Solo el staff aprobado vende. `029` dejó una lista blanca de 13 RPC para
-- `anon` (el portal); esta no está en ella y no debe estarlo.
REVOKE ALL ON FUNCTION public.process_coffee_sale(uuid, jsonb, timestamptz, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_coffee_sale(uuid, jsonb, timestamptz, text, integer) TO authenticated;

COMMIT;

-- ===========================================================================
-- Comprobación (ejecutando, con ROLLBACK: no deja rastro)
-- ===========================================================================
--
--   BEGIN;
--     UPDATE inventory SET total_grams_available = 5000
--      WHERE product_name = 'Café Tostado (Grano)';
--     SELECT process_coffee_sale(
--       (SELECT id FROM customers LIMIT 1),
--       jsonb_build_array(jsonb_build_object(
--         'product_id', (SELECT product_id FROM inventory WHERE product_name='Café Tostado (Grano)'),
--         'quantity', 1, 'unit', 'libra', 'price', 45000)),
--       NOW(), 'EFECTIVO', 15);
--     -- stock 4500, 1 fila en inventory_movements, sales.customer_recurrence_days = 15
--   ROLLBACK;
