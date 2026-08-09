-- 041_permitir_stock_negativo.sql
--
-- **El sistema deja de bloquear una venta por falta de stock.** Decision del
-- dueno el 2026-08-09, y no es una concesion: es como funciona el negocio.
--
-- ===========================================================================
-- Por que
-- ===========================================================================
--
-- Aqui primero se vende y despues se registra. El cafe se entrega en mano, y la
-- venta entra al CRM horas o dias mas tarde — la de Ruth del 6 de agosto se
-- registro el 9. Cuando eso pasa, el inventario del sistema va por detras de la
-- realidad, y bloquear la venta con «Stock insuficiente» no protege nada:
-- impide registrar algo que **ya ocurrio**.
--
-- Y lo que se pierde no es poco. Una venta que no entra no descuenta inventario,
-- no cuenta en las metricas, no actualiza `last_purchase_date` y no aparece en
-- la cartera. El sistema no evita el descuadre: lo esconde.
--
-- Con esto, un stock negativo pasa a ser lo que debe ser: **una senal**. Dice
-- «vendiste 500 g que el sistema no sabia que tenias» y se corrige registrando
-- la entrada que falta. Es informacion, no un error.
--
-- ===========================================================================
-- Que cambia y que NO
-- ===========================================================================
--
-- Se retira la validacion de:
--
--   * `process_coffee_sale(uuid,jsonb,timestamptz,text,integer)` — la que usa
--     la app (`new-sale-modal.tsx` y `/ventas/nueva`).
--   * `process_coffee_sale(uuid,jsonb,timestamptz,text)` — la hermana, para que
--     las dos se comporten igual y nadie herede la version vieja.
--   * `register_inventory_movement` — salidas manuales: mermas, devoluciones,
--     traslados. Mismo motivo: una merma que ya ocurrio no se puede prohibir.
--
-- ⚠️ **NO se toca `create_customer_order`, y es a proposito.** Esa es la unica
-- de las seis donde quien pide **no es el dueno sino un cliente**, desde el
-- portal publico. Ahi el aviso de «no hay» no bloquea un registro: evita
-- prometerle a alguien un cafe que no se le va a poder entregar. Cambiarlo es
-- una decision de producto distinta —aceptar pedidos por encargo— y no se
-- resuelve de paso en una migracion sobre otra cosa.
--
-- Las sobrecargas de dos y tres argumentos se quedan como estan: no las llama
-- nadie (BACKLOG A19) y tocarlas seria dar por vivo lo que esta muerto.
--
-- ===========================================================================
-- Lo que hay que vigilar a partir de ahora
-- ===========================================================================
--
-- El dashboard de «stock bajo» y el Kardex empezaran a mostrar negativos. Es
-- correcto y hay que leerlo como «falta registrar una entrada», pero conviene
-- que la pantalla lo distinga de un stock en cero, que significa otra cosa:
-- anotado en el BACKLOG.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. La RPC que usa la app
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_coffee_sale(
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

        -- El producto TIENE que existir: sin fila de inventario no hay a que
        -- imputar la venta ni de donde sacar el costo. Eso se sigue rechazando.
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto % no existe en inventario', v_product_id;
        END IF;

        -- Aqui iba «Stock insuficiente». Ver la cabecera de 041: la venta ya
        -- ocurrio, y el stock negativo resultante es la senal de que falta
        -- registrar una entrada.

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

-- ---------------------------------------------------------------------------
-- 2. Salidas manuales de inventario (mermas, devoluciones, traslados)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_inventory_movement(
    p_product_id uuid,
    p_movement_type character varying,
    p_quantity_grams integer,
    p_reference_id uuid DEFAULT NULL::uuid,
    p_reference_type character varying DEFAULT NULL::character varying,
    p_reason text DEFAULT NULL::text,
    p_unit_cost numeric DEFAULT NULL::numeric,
    p_batch_number character varying DEFAULT NULL::character varying
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    SELECT total_grams_available INTO v_stock_before
      FROM inventory
     WHERE product_id = p_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado en inventario', p_product_id;
    END IF;

    v_stock_after := v_stock_before + p_quantity_grams;

    -- Antes, un movimiento que dejara el stock en negativo se rechazaba salvo
    -- que fuera 'adjustment'. Ya no: una merma o una salida que ya ocurrio no
    -- se puede prohibir a posteriori, y el negativo es la senal de que falta
    -- registrar la entrada correspondiente. Ver 041.

    INSERT INTO inventory_movements (
        product_id, movement_type, quantity_grams,
        stock_before, stock_after,
        reference_id, reference_type, reason, unit_cost, batch_number, performed_by
    ) VALUES (
        p_product_id, p_movement_type, p_quantity_grams,
        v_stock_before, v_stock_after,
        p_reference_id, p_reference_type, p_reason, p_unit_cost, p_batch_number, auth.uid()
    ) RETURNING id INTO v_movement_id;

    UPDATE inventory
       SET total_grams_available = v_stock_after,
           last_updated = NOW()
     WHERE product_id = p_product_id;

    RETURN v_movement_id;
END;
$function$;

-- Los permisos se recrean: `CREATE OR REPLACE` conserva los de la funcion que
-- ya existia, pero declararlos deja el estado por escrito en vez de heredado.
REVOKE ALL ON FUNCTION public.process_coffee_sale(uuid, jsonb, timestamptz, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_coffee_sale(uuid, jsonb, timestamptz, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.register_inventory_movement(uuid, character varying, integer, uuid, character varying, text, numeric, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_inventory_movement(uuid, character varying, integer, uuid, character varying, text, numeric, character varying) TO authenticated;

COMMIT;

-- ===========================================================================
-- Comprobacion (con ROLLBACK: no deja rastro)
-- ===========================================================================
--
--   BEGIN;
--     -- con el inventario en 0, vender una libra debe FUNCIONAR y dejar -500
--     SELECT process_coffee_sale(
--       (SELECT id FROM customers LIMIT 1),
--       jsonb_build_array(jsonb_build_object(
--         'product_id', (SELECT product_id FROM inventory WHERE product_name='Café Molido Medio'),
--         'quantity', 1, 'unit', 'libra', 'price', 45000)),
--       NOW(), 'Efectivo', NULL);
--     SELECT total_grams_available FROM inventory WHERE product_name='Café Molido Medio';  -- -500
--   ROLLBACK;
